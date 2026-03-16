from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Instrument, Musician, MusicianInstrument
from ..schemas import InstrumentWithCompanionsRead, MusicianSummary

router = APIRouter(prefix="/api/v1/instruments", tags=["instruments"])


def _get_family_ids(db: Session, instrument_id: int) -> list[int]:
    """Get IDs of the instrument and all its companions (parent + siblings)."""
    instrument = db.get(Instrument, instrument_id)
    if not instrument:
        return [instrument_id]
    parent_id = instrument.parent_id if instrument.parent_id else instrument.id
    stmt = select(Instrument.id).where(
        (Instrument.id == parent_id) | (Instrument.parent_id == parent_id)
    )
    return [row[0] for row in db.execute(stmt).all()]


@router.get("", response_model=list[InstrumentWithCompanionsRead])
def list_instruments(db: Session = Depends(get_db)):
    stmt = (
        select(Instrument)
        .options(selectinload(Instrument.companions))
        .order_by(Instrument.name)
    )
    return db.execute(stmt).scalars().all()


@router.get("/{instrument_id}/musicians", response_model=list[MusicianSummary])
def musicians_for_instrument(
    instrument_id: int,
    include_companions: bool = True,
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * per_page

    if include_companions:
        ids = _get_family_ids(db, instrument_id)
    else:
        ids = [instrument_id]

    stmt = (
        select(Musician)
        .join(MusicianInstrument)
        .where(MusicianInstrument.instrument_id.in_(ids), Musician.status == "active")
        .order_by(Musician.last_name, Musician.first_name)
        .offset(offset)
        .limit(per_page)
    )
    return db.execute(stmt).scalars().all()
