"""
Idempotent seed data loader.
Usage: python -m app.seed_data
Loads from CSV files in the project root: seed-musicians.csv, seed-institutions.csv, seed-lineage.csv
"""

import csv
import os
import sys

from unidecode import unidecode
from sqlalchemy import select

# Ensure the backend directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import (
    Instrument,
    Musician,
    MusicianInstrument,
    Institution,
    Lineage,
    Source,
    LineageSource,
)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))


def normalize_search(name: str) -> str:
    return unidecode(name).lower().strip()


def build_name_search(first_name: str, last_name: str) -> str:
    return normalize_search(f"{first_name} {last_name}")


INSTRUMENT_FAMILIES = {
    "Oboe": "Woodwind",
    "Cello": "String",
}


def load_instruments(db):
    """Ensure all required instruments exist."""
    count_new = 0
    for name, family in INSTRUMENT_FAMILIES.items():
        existing = db.execute(select(Instrument).where(Instrument.name == name)).scalar_one_or_none()
        if not existing:
            instrument = Instrument(name=name, family=family)
            db.add(instrument)
            count_new += 1
    db.flush()
    print(f"  Instruments: {count_new} new")


def load_institutions(db):
    csv_path = os.path.join(PROJECT_ROOT, "seed-institutions.csv")
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count_new = 0
        for row in reader:
            inst_id = int(row["id"])
            existing = db.get(Institution, inst_id)
            if existing:
                continue
            institution = Institution(
                id=inst_id,
                name=row["name"].strip(),
                city=row["city"].strip() if row["city"] else None,
                country=row["country"].strip() if row["country"] else None,
            )
            db.add(institution)
            count_new += 1
        db.flush()
        print(f"  Institutions: {count_new} new")


def load_musicians(db):
    csv_path = os.path.join(PROJECT_ROOT, "seed-musicians.csv")

    # Build instrument lookup by name
    instruments = db.execute(select(Instrument)).scalars().all()
    instrument_by_name = {i.name: i for i in instruments}

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count_new = 0
        for row in reader:
            m_id = int(row["id"])
            existing = db.get(Musician, m_id)
            if existing:
                continue

            first = row["first_name"].strip()
            last = row["last_name"].strip()

            musician = Musician(
                id=m_id,
                last_name=last,
                first_name=first,
                birth_date=row["birth_date"].strip() if row["birth_date"].strip() else None,
                death_date=row["death_date"].strip() if row["death_date"].strip() else None,
                nationality=row["nationality"].strip() if row["nationality"].strip() else None,
                bio_notes=row["bio_notes"].strip() if row["bio_notes"].strip() else None,
                name_search=build_name_search(first, last),
            )
            db.add(musician)
            db.flush()

            # Link to instrument from CSV
            inst_name = row["instrument"].strip() if row.get("instrument", "").strip() else "Oboe"
            instrument = instrument_by_name.get(inst_name)
            if instrument:
                existing_link = db.execute(
                    select(MusicianInstrument).where(
                        MusicianInstrument.musician_id == m_id,
                        MusicianInstrument.instrument_id == instrument.id,
                    )
                ).scalar_one_or_none()
                if not existing_link:
                    mi = MusicianInstrument(
                        musician_id=m_id,
                        instrument_id=instrument.id,
                        is_primary=True,
                    )
                    db.add(mi)

            count_new += 1
        db.flush()
        print(f"  Musicians: {count_new} new")


def load_lineage(db):
    csv_path = os.path.join(PROJECT_ROOT, "seed-lineage.csv")
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count_new = 0
        count_skipped = 0
        for row in reader:
            teacher_id = int(row["teacher_id"])
            student_id = int(row["student_id"])
            institution_id = int(row["institution_id"]) if row["institution_id"].strip() else None
            rel_type = row["relationship_type"].strip() if row["relationship_type"].strip() else "formal_study"
            notes = row["notes"].strip() if row["notes"].strip() else None

            # Check for existing (idempotent)
            stmt = select(Lineage).where(
                Lineage.teacher_id == teacher_id,
                Lineage.student_id == student_id,
            )
            if institution_id:
                stmt = stmt.where(Lineage.institution_id == institution_id)
            else:
                stmt = stmt.where(Lineage.institution_id.is_(None))

            existing = db.execute(stmt).scalar_one_or_none()
            if existing:
                count_skipped += 1
                continue

            # Verify both musicians exist
            teacher = db.get(Musician, teacher_id)
            student = db.get(Musician, student_id)
            if not teacher or not student:
                print(f"  WARNING: Skipping lineage row teacher={teacher_id} student={student_id} — musician not found")
                count_skipped += 1
                continue

            lineage = Lineage(
                teacher_id=teacher_id,
                student_id=student_id,
                institution_id=institution_id,
                relationship_type=rel_type,
                notes=notes,
            )
            db.add(lineage)
            count_new += 1
        db.flush()
        print(f"  Lineage: {count_new} new, {count_skipped} skipped")


def load_sources(db):
    csv_path = os.path.join(PROJECT_ROOT, "seed-sources.csv")
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count_new = 0
        for row in reader:
            source_id = int(row["id"])
            existing = db.get(Source, source_id)
            if existing:
                continue
            source = Source(
                id=source_id,
                title=row["title"].strip(),
                author=row["author"].strip() if row["author"].strip() else None,
                source_type=row["source_type"].strip(),
                url=row["url"].strip() if row["url"].strip() else None,
                isbn=row["isbn"].strip() if row["isbn"].strip() else None,
                notes=row["notes"].strip() if row["notes"].strip() else None,
            )
            db.add(source)
            count_new += 1
        db.flush()
        print(f"  Sources: {count_new} new")


def load_lineage_sources(db):
    csv_path = os.path.join(PROJECT_ROOT, "seed-lineage-sources.csv")
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count_new = 0
        count_skipped = 0
        for row in reader:
            teacher_id = int(row["teacher_id"])
            student_id = int(row["student_id"])
            institution_id = int(row["institution_id"]) if row["institution_id"].strip() else None
            source_id = int(row["source_id"])
            page_reference = row["page_reference"].strip() if row["page_reference"].strip() else None

            # Find the lineage record
            stmt = select(Lineage).where(
                Lineage.teacher_id == teacher_id,
                Lineage.student_id == student_id,
            )
            if institution_id:
                stmt = stmt.where(Lineage.institution_id == institution_id)
            else:
                stmt = stmt.where(Lineage.institution_id.is_(None))

            lineage = db.execute(stmt).scalar_one_or_none()
            if not lineage:
                print(f"  WARNING: Skipping lineage-source — lineage not found for teacher={teacher_id} student={student_id}")
                count_skipped += 1
                continue

            # Check for existing link (idempotent)
            existing = db.execute(
                select(LineageSource).where(
                    LineageSource.lineage_id == lineage.id,
                    LineageSource.source_id == source_id,
                )
            ).scalar_one_or_none()
            if existing:
                count_skipped += 1
                continue

            ls = LineageSource(
                lineage_id=lineage.id,
                source_id=source_id,
                page_reference=page_reference,
            )
            db.add(ls)
            count_new += 1
        db.flush()
        print(f"  Lineage sources: {count_new} new, {count_skipped} skipped")


def seed():
    print("Seeding database...")
    db = SessionLocal()
    try:
        load_instruments(db)
        load_institutions(db)
        load_musicians(db)
        load_lineage(db)
        load_sources(db)
        load_lineage_sources(db)
        db.commit()
        print("Seed complete.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
