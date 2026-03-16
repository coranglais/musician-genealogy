from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auth import require_admin
from ..database import get_db
from ..models import Lineage, LineageSource
from ..schemas import LineageCreate, LineageRead, LineageUpdate

router = APIRouter(prefix="/api/v1/lineage", tags=["lineage"])


@router.get("", response_model=list[LineageRead])
def list_lineage(
    teacher_id: int | None = None,
    student_id: int | None = None,
    relationship_type: str | None = None,
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * per_page
    stmt = (
        select(Lineage)
        .options(
            selectinload(Lineage.teacher),
            selectinload(Lineage.student),
            selectinload(Lineage.institution),
            selectinload(Lineage.sources).selectinload(LineageSource.source),
        )
        .where(Lineage.status == "active")
    )

    if teacher_id:
        stmt = stmt.where(Lineage.teacher_id == teacher_id)
    if student_id:
        stmt = stmt.where(Lineage.student_id == student_id)
    if relationship_type:
        stmt = stmt.where(Lineage.relationship_type == relationship_type)

    stmt = stmt.offset(offset).limit(per_page)
    result = db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=LineageRead, status_code=201)
def create_lineage(
    body: LineageCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    lineage = Lineage(
        teacher_id=body.teacher_id,
        student_id=body.student_id,
        institution_id=body.institution_id,
        start_year=body.start_year,
        end_year=body.end_year,
        relationship_type=body.relationship_type,
        notes=body.notes,
    )
    db.add(lineage)
    db.commit()
    db.refresh(lineage)

    stmt = (
        select(Lineage)
        .options(
            selectinload(Lineage.teacher),
            selectinload(Lineage.student),
            selectinload(Lineage.institution),
            selectinload(Lineage.sources).selectinload(LineageSource.source),
        )
        .where(Lineage.id == lineage.id)
    )
    return db.execute(stmt).scalar_one()


@router.put("/{lineage_id}", response_model=LineageRead)
def update_lineage(
    lineage_id: int,
    body: LineageUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    lineage = db.get(Lineage, lineage_id)
    if not lineage:
        raise HTTPException(status_code=404, detail="Lineage record not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lineage, field, value)

    db.commit()
    db.refresh(lineage)

    stmt = (
        select(Lineage)
        .options(
            selectinload(Lineage.teacher),
            selectinload(Lineage.student),
            selectinload(Lineage.institution),
            selectinload(Lineage.sources).selectinload(LineageSource.source),
        )
        .where(Lineage.id == lineage.id)
    )
    return db.execute(stmt).scalar_one()


@router.delete("/{lineage_id}", status_code=204)
def delete_lineage(
    lineage_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    lineage = db.get(Lineage, lineage_id)
    if not lineage:
        raise HTTPException(status_code=404, detail="Lineage record not found")
    db.delete(lineage)
    db.commit()
