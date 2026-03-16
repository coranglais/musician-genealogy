from fastapi import APIRouter, Depends
from sqlalchemy import select, func, union_all, literal, case
from sqlalchemy.orm import Session
from unidecode import unidecode

from ..database import get_db
from ..models import Musician, MusicianName, Institution
from ..schemas import SearchResult, AutocompleteResult

router = APIRouter(prefix="/api/v1/search", tags=["search"])


def normalize(text: str) -> str:
    return unidecode(text).lower().strip()


@router.get("", response_model=list[SearchResult])
def global_search(
    q: str,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
):
    """Global search across musicians and institutions."""
    normalized = normalize(q)
    offset = (page - 1) * per_page
    results = []

    # Search musicians
    musician_stmt = (
        select(Musician)
        .where(Musician.status == "active", Musician.name_search.ilike(f"%{normalized}%"))
        .order_by(
            # Rank: exact > starts-with > contains
            case(
                (Musician.name_search == normalized, 0),
                (Musician.name_search.ilike(f"{normalized}%"), 1),
                else_=2,
            ),
            Musician.last_name,
        )
        .limit(per_page)
        .offset(offset)
    )
    musicians = db.execute(musician_stmt).scalars().all()
    for m in musicians:
        score = 1.0
        if m.name_search == normalized:
            score = 1.0
        elif m.name_search and m.name_search.startswith(normalized):
            score = 0.8
        else:
            score = 0.5
        results.append(SearchResult(
            id=m.id,
            display_name=f"{m.first_name} {m.last_name}",
            birth_date=m.birth_date,
            death_date=m.death_date,
            result_type="musician",
            match_score=score,
            matched_via="canonical",
        ))

    # Search musician alternate names
    alt_stmt = (
        select(MusicianName)
        .where(MusicianName.name_search.ilike(f"%{normalized}%"))
        .limit(per_page)
    )
    alt_names = db.execute(alt_stmt).scalars().all()
    seen_ids = {r.id for r in results}
    for an in alt_names:
        if an.musician_id in seen_ids:
            continue
        seen_ids.add(an.musician_id)
        m = db.get(Musician, an.musician_id)
        if m and m.status == "active":
            results.append(SearchResult(
                id=m.id,
                display_name=f"{m.first_name} {m.last_name}",
                birth_date=m.birth_date,
                death_date=m.death_date,
                result_type="musician",
                match_score=0.4,
                matched_via=f"alternate_name ({an.name})",
            ))

    # Search institutions
    inst_stmt = (
        select(Institution)
        .where(Institution.status == "active", Institution.name.ilike(f"%{q}%"))
        .order_by(Institution.name)
        .limit(per_page)
        .offset(offset)
    )
    institutions = db.execute(inst_stmt).scalars().all()
    for inst in institutions:
        results.append(SearchResult(
            id=inst.id,
            display_name=inst.name,
            result_type="institution",
            match_score=0.6,
        ))

    results.sort(key=lambda r: -r.match_score)
    return results


@router.get("/autocomplete", response_model=list[AutocompleteResult])
def autocomplete(
    q: str,
    limit: int = 8,
    db: Session = Depends(get_db),
):
    """Autocomplete for search bar and submission form."""
    if len(q) < 2:
        return []

    normalized = normalize(q)
    results: dict[int, AutocompleteResult] = {}

    # 1. Prefix match on canonical name
    prefix_stmt = (
        select(Musician)
        .where(Musician.status == "active", Musician.name_search.ilike(f"{normalized}%"))
        .limit(limit)
    )
    for m in db.execute(prefix_stmt).scalars().all():
        if m.id not in results:
            results[m.id] = AutocompleteResult(
                musician_id=m.id,
                display_name=f"{m.first_name} {m.last_name}",
                birth_date=m.birth_date,
                death_date=m.death_date,
                match_score=0.9,
                matched_via="canonical",
            )

    # 2. Contains match on canonical name
    contains_stmt = (
        select(Musician)
        .where(Musician.status == "active", Musician.name_search.ilike(f"%{normalized}%"))
        .limit(limit)
    )
    for m in db.execute(contains_stmt).scalars().all():
        if m.id not in results:
            results[m.id] = AutocompleteResult(
                musician_id=m.id,
                display_name=f"{m.first_name} {m.last_name}",
                birth_date=m.birth_date,
                death_date=m.death_date,
                match_score=0.6,
                matched_via="canonical",
            )

    # 3. Search alternate names
    alt_stmt = (
        select(MusicianName)
        .where(MusicianName.name_search.ilike(f"%{normalized}%"))
        .limit(limit)
    )
    for an in db.execute(alt_stmt).scalars().all():
        if an.musician_id not in results:
            m = db.get(Musician, an.musician_id)
            if m and m.status == "active":
                results[an.musician_id] = AutocompleteResult(
                    musician_id=m.id,
                    display_name=f"{m.first_name} {m.last_name}",
                    birth_date=m.birth_date,
                    death_date=m.death_date,
                    match_score=0.4,
                    matched_via=f"alternate_name ({an.name})",
                )

    sorted_results = sorted(results.values(), key=lambda r: -r.match_score)
    return sorted_results[:limit]
