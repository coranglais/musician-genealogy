import json
import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Musician, Institution
from ..schemas import (
    FreeTextSubmission,
    ParsedMusician,
    ParsedRelationship,
    ParsedSubmissionPreview,
)

router = APIRouter(prefix="/api/v1/submissions", tags=["submissions"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


@router.post("/parse-text", response_model=ParsedSubmissionPreview)
def parse_free_text(
    body: FreeTextSubmission,
    db: Session = Depends(get_db),
):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI parsing not configured")

    # Honeypot check
    if body.honeypot:
        return ParsedSubmissionPreview(
            student=ParsedMusician(first_name="", last_name=""),
            relationships=[],
        )

    # Build context: existing active musicians and institutions for name matching
    musicians = db.execute(
        select(Musician.id, Musician.first_name, Musician.last_name)
        .where(Musician.status == "active")
        .order_by(Musician.last_name)
    ).all()
    musician_list = [
        f"{m.first_name} {m.last_name} (id={m.id})"
        for m in musicians
    ]

    institutions = db.execute(
        select(Institution.id, Institution.name, Institution.city)
        .where(Institution.status == "active")
        .order_by(Institution.name)
    ).all()
    institution_list = [
        f"{i.name}{f', {i.city}' if i.city else ''} (id={i.id})"
        for i in institutions
    ]

    system_prompt = f"""You are a data extraction assistant for a musician genealogy project. Parse the user's free-text description of their music education into structured data.

Known musicians in the database:
{chr(10).join(musician_list)}

Known institutions in the database:
{chr(10).join(institution_list)}

Extract:
1. The student (the person who studied)
2. Each teacher-student relationship described

For each person and institution, check if they match an existing record above. If so, include the existing_id. If not, leave existing_id as null.

Relationship types: formal_study, private_study, apprenticeship, festival, masterclass, workshop, informal

Respond with ONLY valid JSON in this exact format:
{{
  "student": {{
    "first_name": "...",
    "last_name": "...",
    "existing_id": null or integer,
    "instrument": "..." or null
  }},
  "relationships": [
    {{
      "teacher": {{
        "first_name": "...",
        "last_name": "...",
        "existing_id": null or integer,
        "instrument": null
      }},
      "institution_name": "..." or null,
      "institution_city": "..." or null,
      "relationship_type": "formal_study",
      "start_year": null or integer,
      "end_year": null or integer
    }}
  ]
}}"""

    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=[
            {"role": "user", "content": body.text},
        ],
    )

    # Parse the response
    try:
        response_text = message.content[0].text
        # Strip markdown code fences if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        parsed = json.loads(response_text)
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {e}")

    # Build the response
    student_data = parsed.get("student", {})
    student = ParsedMusician(
        first_name=student_data.get("first_name", ""),
        last_name=student_data.get("last_name", ""),
        existing_id=student_data.get("existing_id"),
        instrument=student_data.get("instrument"),
    )

    relationships = []
    for rel_data in parsed.get("relationships", []):
        teacher_data = rel_data.get("teacher", {})
        relationships.append(ParsedRelationship(
            teacher=ParsedMusician(
                first_name=teacher_data.get("first_name", ""),
                last_name=teacher_data.get("last_name", ""),
                existing_id=teacher_data.get("existing_id"),
                instrument=teacher_data.get("instrument"),
            ),
            institution_name=rel_data.get("institution_name"),
            institution_city=rel_data.get("institution_city"),
            relationship_type=rel_data.get("relationship_type", "formal_study"),
            start_year=rel_data.get("start_year"),
            end_year=rel_data.get("end_year"),
        ))

    return ParsedSubmissionPreview(student=student, relationships=relationships)
