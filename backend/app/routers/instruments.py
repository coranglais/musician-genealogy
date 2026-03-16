from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Instrument, Musician, MusicianInstrument
from ..schemas import InstrumentRead, MusicianSummary

router = APIRouter(prefix="/api/v1/instruments", tags=["instruments"])


@router.get("", response_model=list[InstrumentRead])
def list_instruments(db: Session = Depends(get_db)):
    result = db.execute(select(Instrument).order_by(Instrument.name))
    return result.scalars().all()


@router.get("/{instrument_id}/musicians", response_model=list[MusicianSummary])
def musicians_for_instrument(
    instrument_id: int,
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
):
    offset = (page - 1) * per_page
    stmt = (
        select(Musician)
        .join(MusicianInstrument)
        .where(MusicianInstrument.instrument_id == instrument_id, Musician.status == "active")
        .order_by(Musician.last_name, Musician.first_name)
        .offset(offset)
        .limit(per_page)
    )
    result = db.execute(stmt)
    return result.scalars().all()
