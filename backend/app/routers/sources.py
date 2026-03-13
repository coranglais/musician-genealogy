from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auth import require_admin
from ..database import get_db
from ..models import Source, LineageSource, Lineage
from ..schemas import (
    LineageSourceCreate,
    LineageSourceRead,
    SourceCreate,
    SourceRead,
    SourceUpdate,
)

router = APIRouter(prefix="/api/v1/sources", tags=["sources"])


@router.get("", response_model=list[SourceRead])
def list_sources(
    q: str | None = None,
    source_type: str | None = None,
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * per_page
    stmt = select(Source)

    if q:
        stmt = stmt.where(
            Source.title.ilike(f"%{q}%") | Source.author.ilike(f"%{q}%")
        )
    if source_type:
        stmt = stmt.where(Source.source_type == source_type)

    stmt = stmt.order_by(Source.title).offset(offset).limit(per_page)
    return db.execute(stmt).scalars().all()


@router.get("/{source_id}", response_model=SourceRead)
def get_source(source_id: int, db: Session = Depends(get_db)):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.post("", response_model=SourceRead, status_code=201)
def create_source(
    body: SourceCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    source = Source(
        title=body.title,
        author=body.author,
        source_type=body.source_type,
        url=body.url,
        isbn=body.isbn,
        notes=body.notes,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.put("/{source_id}", response_model=SourceRead)
def update_source(
    source_id: int,
    body: SourceUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(source, field, value)

    db.commit()
    db.refresh(source)
    return source


@router.delete("/{source_id}", status_code=204)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()


@router.post("/{source_id}/lineage/{lineage_id}", response_model=LineageSourceRead, status_code=201)
def attach_source_to_lineage(
    source_id: int,
    lineage_id: int,
    body: LineageSourceCreate | None = None,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    source = db.get(Source, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    lineage = db.get(Lineage, lineage_id)
    if not lineage:
        raise HTTPException(status_code=404, detail="Lineage record not found")

    # Check for existing link
    existing = db.execute(
        select(LineageSource).where(
            LineageSource.source_id == source_id,
            LineageSource.lineage_id == lineage_id,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Source already attached to this lineage record")

    ls = LineageSource(
        lineage_id=lineage_id,
        source_id=source_id,
        page_reference=body.page_reference if body else None,
    )
    db.add(ls)
    db.commit()
    db.refresh(ls)

    # Re-query with source eager loaded
    stmt = (
        select(LineageSource)
        .options(selectinload(LineageSource.source))
        .where(LineageSource.id == ls.id)
    )
    return db.execute(stmt).scalar_one()


@router.delete("/{source_id}/lineage/{lineage_id}", status_code=204)
def detach_source_from_lineage(
    source_id: int,
    lineage_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    ls = db.execute(
        select(LineageSource).where(
            LineageSource.source_id == source_id,
            LineageSource.lineage_id == lineage_id,
        )
    ).scalar_one_or_none()
    if not ls:
        raise HTTPException(status_code=404, detail="Source-lineage link not found")
    db.delete(ls)
    db.commit()
