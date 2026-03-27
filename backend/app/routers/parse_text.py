import json
import logging
import os

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from unidecode import unidecode

from ..database import get_db
from ..models import Institution, InstitutionName, Musician, MusicianName
from ..rate_limit import check_parse_text_rate
from ..schemas import (
    CandidateLineage,
    CandidateMusician,
    ParseTextRequest,
    ParseTextResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/submissions", tags=["submissions"])

SYSTEM_PROMPT = """You are a data extraction tool for a musician genealogy database. Your job
is to parse free-text descriptions of musical education into structured
records.

Extract teacher-student relationships from the text below. For each
relationship, identify:
- Teacher name
- Institution name (expand abbreviations ONLY for well-known music
  institutions, e.g., CIM → Cleveland Institute of Music,
  NEC → New England Conservatory)
- Relationship type: one of formal_study, private_study, apprenticeship,
  festival, masterclass, workshop, informal
- Start year and end year if explicitly stated
- Any notes about the relationship

The submitter's name is: {submitter_name}
Unless stated otherwise, assume the submitter is the student in each
relationship described.

Return ONLY a JSON object matching this exact schema, with no other text:
{{
  "lineages": [
    {{
      "teacher_name": "Name exactly as given in text",
      "institution_name": "Full Institution Name or null",
      "relationship_type": "formal_study",
      "start_year": 1990,
      "end_year": 1994,
      "notes": "any additional context or null"
    }}
  ],
  "parse_notes": "any caveats about ambiguous or unclear information, or null"
}}

Rules:
- If the text does not contain any teacher-student relationships, return
  {{"lineages": [], "parse_notes": "No relationships found"}}
- If information is ambiguous, include it with a note in parse_notes
- Do not invent information not present in the text
- Extract ONLY names that appear in the text. If the text says "Holliger",
  return "Holliger" — do NOT expand to a full name unless the full name
  is explicitly stated. Never guess a first name.
- If only a city or country is mentioned without a specific institution,
  set institution_name to null and include the location in the notes
  field (e.g., "in Bern" → institution_name: null, notes: "in Bern").
- For vague time references like "in the 1970s", "sometime in the 80s",
  or "around 1960", do NOT convert these to start_year/end_year. Set
  both to null and include the time reference in the notes field. Only
  extract specific years when they are explicitly stated (e.g., "from
  1990 to 1994").
- Expand institution abbreviations ONLY where the expansion is
  unambiguous in a musical context. If unsure, return the abbreviation
  as-is and note the ambiguity in parse_notes."""


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


@router.post("/parse-text", response_model=ParseTextResponse,
              dependencies=[Depends(check_parse_text_rate)])
def parse_free_text(body: ParseTextRequest, db: Session = Depends(get_db)):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI parsing not configured")

    # Call Claude Sonnet — no DB context in prompt
    prompt = SYSTEM_PROMPT.format(submitter_name=body.submitter_name)
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
            institution_name=inst_canonical or institution_name,
            institution_existing_id=inst_id,
            relationship_type=rel.get("relationship_type", "formal_study"),
            start_year=rel.get("start_year"),
            end_year=rel.get("end_year"),
            notes=rel.get("notes"),
            confidence=confidence,
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

    return ParseTextResponse(
        candidate_lineages=candidate_lineages,
        candidate_musicians=list(new_musicians.values()),
        raw_text=body.text,
        parse_notes=parsed.get("parse_notes"),
    )
