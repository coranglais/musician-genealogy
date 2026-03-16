from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from unidecode import unidecode

from ..auth import require_admin
from ..database import get_db
from ..models import (
    Instrument,
    Musician,
    MusicianInstrument,
    MusicianName,
    Lineage,
    LineageSource,
    Institution,
)
from ..schemas import (
    MusicianCreate,
    MusicianRead,
    MusicianSummary,
    MusicianUpdate,
    LineageRead,
)

router = APIRouter(prefix="/api/v1/musicians", tags=["musicians"])


def normalize(text: str) -> str:
    return unidecode(text).lower().strip()


@router.get("", response_model=list[MusicianSummary])
def list_musicians(
    q: str | None = None,
    instrument: int | None = None,
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * per_page
    stmt = select(Musician).where(Musician.status == "active")

    if instrument:
        # Include companion instruments (parent + siblings) by default
        inst = db.get(Instrument, instrument)
        if inst:
            parent_id = inst.parent_id if inst.parent_id else inst.id
            family_stmt = select(Instrument.id).where(
                (Instrument.id == parent_id) | (Instrument.parent_id == parent_id)
            )
            family_ids = [row[0] for row in db.execute(family_stmt).all()]
        else:
            family_ids = [instrument]
        stmt = stmt.join(MusicianInstrument).where(MusicianInstrument.instrument_id.in_(family_ids))

    if q:
        normalized_q = normalize(q)
        stmt = stmt.where(Musician.name_search.ilike(f"%{normalized_q}%"))

    stmt = stmt.order_by(Musician.last_name, Musician.first_name).offset(offset).limit(per_page)
    result = db.execute(stmt)
    return result.scalars().all()


@router.get("/{musician_id}", response_model=MusicianRead)
def get_musician(musician_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Musician)
        .options(
            selectinload(Musician.alternate_names),
            selectinload(Musician.musician_instruments).selectinload(MusicianInstrument.instrument),
        )
        .where(Musician.id == musician_id, Musician.status == "active")
    )
    musician = db.execute(stmt).scalar_one_or_none()
    if not musician:
        raise HTTPException(status_code=404, detail="Musician not found")
    return musician


@router.get("/{musician_id}/teachers", response_model=list[LineageRead])
def get_teachers(musician_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Lineage)
        .options(
            selectinload(Lineage.teacher),
            selectinload(Lineage.student),
            selectinload(Lineage.institution),
            selectinload(Lineage.sources).selectinload(LineageSource.source),
        )
        .where(Lineage.student_id == musician_id, Lineage.status == "active")
    )
    result = db.execute(stmt)
    return result.scalars().all()


@router.get("/{musician_id}/students", response_model=list[LineageRead])
def get_students(musician_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Lineage)
        .options(
            selectinload(Lineage.teacher),
            selectinload(Lineage.student),
            selectinload(Lineage.institution),
            selectinload(Lineage.sources).selectinload(LineageSource.source),
        )
        .where(Lineage.teacher_id == musician_id, Lineage.status == "active")
    )
    result = db.execute(stmt)
    return result.scalars().all()


@router.get("/{musician_id}/lineage")
def get_lineage_tree(
    musician_id: int,
    depth: int = 3,
    include_secondary: bool = False,
    db: Session = Depends(get_db),
):
    """Recursive lineage tree: ancestors (teachers) and descendants (students)."""
    musician = db.execute(
        select(Musician).where(Musician.id == musician_id, Musician.status == "active")
    ).scalar_one_or_none()
    if not musician:
        raise HTTPException(status_code=404, detail="Musician not found")

    primary_types = ("formal_study", "private_study", "apprenticeship")

    def get_visual_weight(rel_type: str) -> str:
        if rel_type in primary_types:
            return "primary"
        if rel_type in ("festival", "informal"):
            return "secondary"
        return "tertiary"

    def build_ancestors(mid: int, current_depth: int, visited: set) -> list[dict]:
        if current_depth > depth or mid in visited:
            return []
        visited.add(mid)

        stmt = (
            select(Lineage)
            .options(
                selectinload(Lineage.teacher),
                selectinload(Lineage.institution),
                selectinload(Lineage.sources).selectinload(LineageSource.source),
            )
            .where(Lineage.student_id == mid, Lineage.status == "active")
        )
        if not include_secondary:
            stmt = stmt.where(Lineage.relationship_type.in_(primary_types))

        lineages = db.execute(stmt).scalars().all()
        nodes = []
        for lin in lineages:
            t = lin.teacher
            node = {
                "musician": {
                    "id": t.id,
                    "last_name": t.last_name,
                    "first_name": t.first_name,
                    "birth_date": t.birth_date,
                    "death_date": t.death_date,
                    "nationality": t.nationality,
                },
                "relationship_type": lin.relationship_type,
                "institution": {
                    "id": lin.institution.id,
                    "name": lin.institution.name,
                    "city": lin.institution.city,
                    "country": lin.institution.country,
                } if lin.institution else None,
                "sources": [
                    {
                        "id": ls.id,
                        "source": {
                            "id": ls.source.id,
                            "title": ls.source.title,
                            "author": ls.source.author,
                            "source_type": ls.source.source_type,
                            "url": ls.source.url,
                            "isbn": ls.source.isbn,
                            "notes": ls.source.notes,
                        },
                        "page_reference": ls.page_reference,
                    }
                    for ls in lin.sources
                ],
                "depth": current_depth,
                "visual_weight": get_visual_weight(lin.relationship_type),
                "children": build_ancestors(t.id, current_depth + 1, visited),
            }
            nodes.append(node)
        return nodes

    def build_descendants(mid: int, current_depth: int, visited: set) -> list[dict]:
        if current_depth > depth or mid in visited:
            return []
        visited.add(mid)

        stmt = (
            select(Lineage)
            .options(
                selectinload(Lineage.student),
                selectinload(Lineage.institution),
                selectinload(Lineage.sources).selectinload(LineageSource.source),
            )
            .where(Lineage.teacher_id == mid, Lineage.status == "active")
        )
        if not include_secondary:
            stmt = stmt.where(Lineage.relationship_type.in_(primary_types))

        lineages = db.execute(stmt).scalars().all()
        nodes = []
        for lin in lineages:
            s = lin.student
            node = {
                "musician": {
                    "id": s.id,
                    "last_name": s.last_name,
                    "first_name": s.first_name,
                    "birth_date": s.birth_date,
                    "death_date": s.death_date,
                    "nationality": s.nationality,
                },
                "relationship_type": lin.relationship_type,
                "institution": {
                    "id": lin.institution.id,
                    "name": lin.institution.name,
                    "city": lin.institution.city,
                    "country": lin.institution.country,
                } if lin.institution else None,
                "sources": [
                    {
                        "id": ls.id,
                        "source": {
                            "id": ls.source.id,
                            "title": ls.source.title,
                            "author": ls.source.author,
                            "source_type": ls.source.source_type,
                            "url": ls.source.url,
                            "isbn": ls.source.isbn,
                            "notes": ls.source.notes,
                        },
                        "page_reference": ls.page_reference,
                    }
                    for ls in lin.sources
                ],
                "depth": current_depth,
                "visual_weight": get_visual_weight(lin.relationship_type),
                "children": build_descendants(s.id, current_depth + 1, visited),
            }
            nodes.append(node)
        return nodes

    return {
        "root": {
            "id": musician.id,
            "last_name": musician.last_name,
            "first_name": musician.first_name,
            "birth_date": musician.birth_date,
            "death_date": musician.death_date,
            "nationality": musician.nationality,
        },
        "ancestors": build_ancestors(musician_id, 1, set()),
        "descendants": build_descendants(musician_id, 1, set()),
    }


@router.post("", response_model=MusicianRead, status_code=201)
def create_musician(
    body: MusicianCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    musician = Musician(
        last_name=body.last_name,
        first_name=body.first_name,
        birth_date=body.birth_date,
        death_date=body.death_date,
        nationality=body.nationality,
        bio_notes=body.bio_notes,
        name_search=normalize(f"{body.first_name} {body.last_name}"),
    )
    db.add(musician)
    db.flush()

    for inst_id in body.instrument_ids:
        mi = MusicianInstrument(musician_id=musician.id, instrument_id=inst_id, is_primary=True)
        db.add(mi)

    db.commit()
    db.refresh(musician)

    # Re-query with eager loading
    stmt = (
        select(Musician)
        .options(
            selectinload(Musician.alternate_names),
            selectinload(Musician.musician_instruments).selectinload(MusicianInstrument.instrument),
        )
        .where(Musician.id == musician.id)
    )
    return db.execute(stmt).scalar_one()


@router.put("/{musician_id}", response_model=MusicianRead)
def update_musician(
    musician_id: int,
    body: MusicianUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    musician = db.get(Musician, musician_id)
    if not musician:
        raise HTTPException(status_code=404, detail="Musician not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(musician, field, value)

    # Regenerate name_search if name fields changed
    if "first_name" in update_data or "last_name" in update_data:
        musician.name_search = normalize(f"{musician.first_name} {musician.last_name}")

    db.commit()
    db.refresh(musician)

    stmt = (
        select(Musician)
        .options(
            selectinload(Musician.alternate_names),
            selectinload(Musician.musician_instruments).selectinload(MusicianInstrument.instrument),
        )
        .where(Musician.id == musician.id)
    )
    return db.execute(stmt).scalar_one()
