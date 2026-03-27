import json
import logging
import os
from datetime import datetime, timezone

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from unidecode import unidecode

from ..database import get_db
from ..models import Instrument, Institution, InstitutionName, Musician, MusicianName
from ..rate_limit import check_parse_text_rate
from ..schemas import (
    CandidateLineage,
    CandidateMusician,
    ParseTextRequest,
    ParseTextResponse,
    SubmitterInstrument,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/submissions", tags=["submissions"])

# Map internal field names → friendly labels for user-facing text.
# Ordered longest-first so "institution_name" matches before "institution".
_FIELD_DISPLAY_NAMES = {
    "relationship_type": "relationship type",
    "institution_name": "school",
    "instrument": "instrument",
    "start_year": "start year",
    "end_year": "end year",
    "teacher_name": "teacher",
    "inferred_fields": "assumed fields",
    "formal_study": "formal study",
    "private_study": "private lessons",
    "masterclass": "masterclass",
    "informal": "informal mentorship",
}

SYSTEM_PROMPT = """You are a data extraction tool for a musician genealogy database. Your job
is to parse free-text descriptions of musical education into structured
records.

Extract teacher-student relationships from the text below. For each
relationship, identify:
- Teacher name
- Instrument studied (e.g., oboe, piano, violin — if mentioned)
- Institution name (expand abbreviations ONLY for well-known music
  institutions, e.g., CIM → Cleveland Institute of Music,
  NEC → New England Conservatory)
- Relationship type: one of formal_study, private_study, apprenticeship,
  festival, masterclass, workshop, informal
- Start year and end year if explicitly stated
- Any notes about the relationship

Also extract any instrument(s) the submitter mentions playing or studying,
even if not tied to a specific relationship.

Today's date is: {today}
The submitter's name is: {submitter_name}
Unless stated otherwise, assume the submitter is the student in each
relationship described.

Return ONLY a JSON object matching this exact schema, with no other text:
{{
  "lineages": [
    {{
      "teacher_name": "Name exactly as given in text",
      "instrument": "instrument name or null",
      "institution_name": "Full Institution Name or null",
      "relationship_type": "formal_study",
      "start_year": 1990,
      "end_year": 1994,
      "notes": "any additional context or null",
      "inferred_fields": ["relationship_type"]
    }}
  ],
  "submitter_instruments": ["oboe"],
  "parse_notes": "any caveats about ambiguous or unclear information, or null"
}}

Rules:
- If the text does not contain any teacher-student relationships, return
  {{"lineages": [], "submitter_instruments": [], "parse_notes": "No relationships found"}}
- If information is ambiguous, include it with a note in parse_notes
- Do not invent information not present in the text
- For each lineage, include an "inferred_fields" array listing any field
  names where you made an assumption rather than extracting an explicit
  value from the text. For example, if the text says "studied with" but
  does not specify whether it was at a conservatory or private lessons,
  include "relationship_type" in inferred_fields. If the text explicitly
  says "masterclass", relationship_type is NOT inferred. An empty array
  means all fields were explicitly stated.
- Extract ONLY names that appear in the text. If the text says "Holliger",
  return "Holliger" — do NOT expand to a full name unless the full name
  is explicitly stated. Never guess a first name.
- If only a city or country is mentioned without a specific institution,
  set institution_name to null and include the location in the notes
  field (e.g., "in Bern" → institution_name: null, notes: "in Bern").
- For vague decade references like "in the 1970s" or "sometime in the
  80s", do NOT convert these to start_year/end_year. Set both to null
  and include the time reference in the notes field.
- For relative time references like "last week", "last summer", "recently",
  or "a few years ago", use today's date to infer the year and set
  start_year accordingly. Include "inferred from relative reference" in
  the notes and add "start_year" to inferred_fields.
- Only set start_year/end_year to specific years when they are explicitly
  stated (e.g., "from 1990 to 1994") or can be reliably inferred from
  a relative reference.
- Expand institution abbreviations ONLY where the expansion is
  unambiguous in a musical context. If unsure, return the abbreviation
  as-is and note the ambiguity in parse_notes.
- In parse_notes, use plain language a non-technical user would
  understand. Say "school" not "institution_name", "start year" not
  "start_year". Never use the word "null" — say "left blank" or
  "not specified" instead."""


def normalize(text: str) -> str:
    return unidecode(text).lower().strip()


def _split_name(full_name: str) -> tuple[str | None, str | None]:
    """Split 'First Last' into (first, last). Returns (None, None) if empty."""
    parts = full_name.strip().split()
    if not parts:
        return None, None
    if len(parts) == 1:
        return None, parts[0]
    return " ".join(parts[:-1]), parts[-1]


def _fuzzy_match_musician(name: str, db: Session) -> tuple[int | None, str]:
    """Match a name against musicians table. Returns (id_or_none, confidence)."""
    norm = normalize(name)
    if not norm:
        return None, "low"

    # Exact match on name_search
    exact = db.execute(
        select(Musician)
        .where(Musician.status == "active", Musician.name_search == norm)
    ).scalars().first()
    if exact:
        return exact.id, "high"

    # Contains match on canonical name
    contains = db.execute(
        select(Musician)
        .where(Musician.status == "active", Musician.name_search.ilike(f"%{norm}%"))
        .limit(1)
    ).scalars().first()
    if contains:
        return contains.id, "medium"

    # Check alternate names
    alt = db.execute(
        select(MusicianName)
        .where(MusicianName.name_search.ilike(f"%{norm}%"))
        .limit(1)
    ).scalars().first()
    if alt:
        m = db.get(Musician, alt.musician_id)
        if m and m.status == "active":
            return m.id, "medium"

    return None, "low"


def _fuzzy_match_institution(name: str, db: Session) -> tuple[int | None, str | None]:
    """Match an institution name. Returns (id_or_none, canonical_name_or_none)."""
    if not name:
        return None, None
    norm = normalize(name)

    # Exact ilike match
    exact = db.execute(
        select(Institution)
        .where(Institution.status == "active", Institution.name.ilike(f"%{norm}%"))
        .limit(1)
    ).scalars().first()
    if exact:
        return exact.id, exact.name

    # Check historical/alternate institution names
    alt = db.execute(
        select(InstitutionName)
        .where(InstitutionName.name.ilike(f"%{norm}%"))
        .limit(1)
    ).scalars().first()
    if alt:
        inst = db.get(Institution, alt.institution_id)
        if inst and inst.status == "active":
            return inst.id, inst.name

    return None, None


def _fuzzy_match_instrument(name: str, db: Session) -> tuple[int | None, str | None]:
    """Match an instrument name. Returns (id_or_none, canonical_name_or_none)."""
    if not name:
        return None, None
    norm = normalize(name)

    # Case-insensitive exact match
    exact = db.execute(
        select(Instrument).where(Instrument.name.ilike(norm))
        .limit(1)
    ).scalars().first()
    if exact:
        return exact.id, exact.name

    # Contains match
    contains = db.execute(
        select(Instrument).where(Instrument.name.ilike(f"%{norm}%"))
        .limit(1)
    ).scalars().first()
    if contains:
        return contains.id, contains.name

    return None, None


@router.post("/parse-text", response_model=ParseTextResponse,
              dependencies=[Depends(check_parse_text_rate)])
def parse_free_text(body: ParseTextRequest, db: Session = Depends(get_db)):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI parsing not configured")

    # Call Claude Sonnet — no DB context in prompt
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    prompt = SYSTEM_PROMPT.format(submitter_name=body.submitter_name, today=today)
    user_message = f"<untrusted_user_input>\n{body.text}\n</untrusted_user_input>"

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            temperature=0,
            system=prompt,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIError as e:
        logger.error("Claude API error: %s", e)
        raise HTTPException(status_code=502, detail="AI parsing service unavailable")

    # Parse response — strict schema validation
    try:
        response_text = message.content[0].text
        # Strip markdown code fences if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        parsed = json.loads(response_text)
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        logger.warning("Failed to parse Claude response for input: %s", body.text)
        logger.warning("Claude response was: %s", message.content[0].text if message.content else "<empty>")
        raise HTTPException(
            status_code=422,
            detail="Could not extract structured data from text. Try being more specific about teacher names, institutions, and dates.",
        )

    # Validate expected structure
    if not isinstance(parsed, dict) or "lineages" not in parsed:
        logger.warning("Unexpected Claude response structure for input: %s", body.text)
        logger.warning("Claude response was: %s", message.content[0].text if message.content else "<empty>")
        raise HTTPException(
            status_code=422,
            detail="Could not extract structured data from text. Try being more specific about teacher names, institutions, and dates.",
        )

    # Post-process: server-side fuzzy matching
    candidate_lineages = []
    new_musicians: dict[str, CandidateMusician] = {}  # keyed by normalized name

    for rel in parsed.get("lineages", []):
        teacher_name = rel.get("teacher_name", "")
        if not teacher_name:
            continue

        teacher_first, teacher_last = _split_name(teacher_name)
        teacher_id, teacher_confidence = _fuzzy_match_musician(teacher_name, db)

        institution_name = rel.get("institution_name")
        inst_id, inst_canonical = _fuzzy_match_institution(institution_name, db) if institution_name else (None, None)

        # Match instrument
        instrument_name = rel.get("instrument")
        instr_id, instr_canonical = _fuzzy_match_instrument(instrument_name, db) if instrument_name else (None, None)

        # Determine overall confidence
        confidence = teacher_confidence
        if inst_id and teacher_confidence == "medium":
            confidence = "medium"

        candidate_lineages.append(CandidateLineage(
            teacher_name=teacher_name,
            teacher_first_name=teacher_first,
            teacher_last_name=teacher_last,
            teacher_existing_id=teacher_id,
            student_name=body.submitter_name,
            instrument=instr_canonical or instrument_name,
            instrument_existing_id=instr_id,
            institution_name=inst_canonical or institution_name,
            institution_existing_id=inst_id,
            relationship_type=rel.get("relationship_type", "formal_study"),
            start_year=rel.get("start_year"),
            end_year=rel.get("end_year"),
            notes=rel.get("notes"),
            confidence=confidence,
            inferred_fields=rel.get("inferred_fields", []),
        ))

        # Track new musicians (teachers not matched to existing)
        if not teacher_id:
            norm_key = normalize(teacher_name)
            if norm_key not in new_musicians:
                new_musicians[norm_key] = CandidateMusician(
                    name=teacher_name,
                    first_name=teacher_first,
                    last_name=teacher_last,
                    existing_id=None,
                    confidence="low",
                )

    # Match submitter instruments
    submitter_instruments = []
    for instr_name in parsed.get("submitter_instruments", []):
        instr_id, instr_canonical = _fuzzy_match_instrument(instr_name, db)
        submitter_instruments.append(SubmitterInstrument(
            name=instr_canonical or instr_name,
            existing_id=instr_id,
        ))

    # Replace internal field names and jargon with friendly labels in parse_notes
    parse_notes = parsed.get("parse_notes")
    if parse_notes:
        for internal, friendly in _FIELD_DISPLAY_NAMES.items():
            parse_notes = parse_notes.replace(internal, friendly)
        # Catch any remaining "null" — replace with context-appropriate phrasing
        parse_notes = parse_notes.replace(" to null", " to blank")
        parse_notes = parse_notes.replace(" as null", " as blank")
        parse_notes = parse_notes.replace(" is null", " was left blank")
        parse_notes = parse_notes.replace(" set to null", " left blank")
        parse_notes = parse_notes.replace("null", "not specified")

    return ParseTextResponse(
        candidate_lineages=candidate_lineages,
        candidate_musicians=list(new_musicians.values()),
        submitter_instruments=submitter_instruments,
        raw_text=body.text,
        parse_notes=parse_notes,
    )
