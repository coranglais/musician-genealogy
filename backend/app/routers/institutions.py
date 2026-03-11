from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Institution
from ..schemas import InstitutionRead, InstitutionSummary

router = APIRouter(prefix="/api/v1/institutions", tags=["institutions"])


@router.get("", response_model=list[InstitutionSummary])
def list_institutions(
    q: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Institution).order_by(Institution.name)
    if q:
        stmt = stmt.where(Institution.name.ilike(f"%{q}%"))
    result = db.execute(stmt)
    return result.scalars().all()


@router.get("/{institution_id}", response_model=InstitutionRead)
def get_institution(institution_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Institution)
        .options(selectinload(Institution.historical_names))
        .where(Institution.id == institution_id)
    )
    institution = db.execute(stmt).scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    return institution
