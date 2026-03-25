import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from unidecode import unidecode

from ..auth import require_admin
from ..database import get_db
from ..email_service import send_decision_email, send_verification_email
from ..models import (
    Institution,
    Instrument,
    Lineage,
    Musician,
    MusicianInstrument,
    SubmissionMetadata,
    SubmissionRecord,
)
from ..rate_limit import check_submission_rate
from ..schemas import (
    StructuredSubmission,
    SubmissionAdminRead,
    SubmissionStatusCheck,
    SubmissionUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["submissions"])

EXPIRY_DAYS = int(os.environ.get("VERIFICATION_TOKEN_EXPIRY_DAYS", "7"))
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:5173")


def normalize(text: str) -> str:
    return unidecode(text).lower().strip()


# --- Public endpoints ---


@router.post("/api/v1/submissions", response_model=SubmissionStatusCheck, status_code=202,
              dependencies=[Depends(check_submission_rate)])
def create_submission(
    body: StructuredSubmission,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Honeypot check — silent rejection, return same shape as real submission
    if body.honeypot:
        fake_token = str(uuid.uuid4())
        return SubmissionStatusCheck(
            id=0, status="unverified", verification_token=fake_token,
            created_at=datetime.now(timezone.utc),
            message=f"Submission received. Please check your email to verify. The link expires in {EXPIRY_DAYS} days.",
        )

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=EXPIRY_DAYS)

    # Build a musician name for the verification email subject
    musician_name = f"{body.student_first_name} {body.student_last_name}"

    # Create submission metadata
    submission = SubmissionMetadata(
        submitter_name=body.submitter_name,
        submitter_email=body.submitter_email,
        submission_type="new_relationship",
        notes=body.notes,
        verification_info=body.verification_info,
        verification_token=token,
        token_expires_at=expires_at,
        status="unverified",
    )
    db.add(submission)
    db.flush()

    # Create pending musician (the student)
    # Check if this musician already exists (active)
    existing_student = _find_existing_musician(
        db, body.student_first_name, body.student_last_name
    )

    if existing_student:
        student_id = existing_student.id
    else:
        student = Musician(
            first_name=body.student_first_name,
            last_name=body.student_last_name,
            birth_date=body.student_birth_date,
            death_date=body.student_death_date,
            nationality=body.student_nationality,
            name_search=normalize(f"{body.student_first_name} {body.student_last_name}"),
            status="pending",
        )
        db.add(student)
        db.flush()
        student_id = student.id

        # Link instrument if provided
        if body.student_instrument:
            instrument = db.execute(
                select(Instrument).where(Instrument.name == body.student_instrument)
            ).scalar_one_or_none()
            if instrument:
                db.add(MusicianInstrument(
                    musician_id=student_id,
                    instrument_id=instrument.id,
                    is_primary=True,
                ))

        db.add(SubmissionRecord(
            submission_id=submission.id,
            record_type="musician",
            record_id=student_id,
        ))

    # Create pending lineage records for each relationship
    for rel in body.relationships:
        # Find or create teacher
        existing_teacher = _find_existing_musician(
            db, rel.teacher_first_name, rel.teacher_last_name
        )

        if existing_teacher:
            teacher_id = existing_teacher.id
        else:
            teacher = Musician(
                first_name=rel.teacher_first_name,
                last_name=rel.teacher_last_name,
                name_search=normalize(f"{rel.teacher_first_name} {rel.teacher_last_name}"),
                status="pending",
            )
            db.add(teacher)
            db.flush()
            teacher_id = teacher.id
            db.add(SubmissionRecord(
                submission_id=submission.id,
                record_type="musician",
                record_id=teacher_id,
            ))

        # Find or create institution
        institution_id = None
        if rel.institution_name:
            existing_inst = db.execute(
                select(Institution).where(
                    Institution.name.ilike(rel.institution_name),
                    Institution.status == "active",
                )
            ).scalar_one_or_none()

            if existing_inst:
                institution_id = existing_inst.id
            else:
                inst = Institution(
                    name=rel.institution_name,
                    city=rel.institution_city,
                    country=rel.institution_country,
                    status="pending",
                )
                db.add(inst)
                db.flush()
                institution_id = inst.id
                db.add(SubmissionRecord(
                    submission_id=submission.id,
                    record_type="institution",
                    record_id=institution_id,
                ))

        # Create pending lineage
        lineage = Lineage(
            teacher_id=teacher_id,
            student_id=student_id,
            institution_id=institution_id,
            relationship_type=rel.relationship_type,
            start_year=rel.start_year,
            end_year=rel.end_year,
            notes=rel.notes,
            status="pending",
        )
        db.add(lineage)
        db.flush()
        db.add(SubmissionRecord(
            submission_id=submission.id,
            record_type="lineage",
            record_id=lineage.id,
        ))

    db.commit()
    db.refresh(submission)

    # Queue verification email (sent asynchronously in background)
    background_tasks.add_task(
        send_verification_email,
        to_email=body.submitter_email,
        verification_token=token,
        musician_name=musician_name,
    )

    return SubmissionStatusCheck(
        id=submission.id,
        status=submission.status,
        verification_token=submission.verification_token,
        created_at=submission.created_at,
        message=f"Submission received. Please check your email to verify. The link expires in {EXPIRY_DAYS} days.",
    )


@router.get("/api/v1/submissions/verify/{token}")
def verify_submission(token: str, db: Session = Depends(get_db)):
    """
    Email verification endpoint.
    Flips status from 'unverified' -> 'submitted' so editors can see it.
    Redirects the user to a confirmation page on the frontend.
    """
    submission = db.execute(
        select(SubmissionMetadata).where(
            SubmissionMetadata.verification_token == token,
        )
    ).scalar_one_or_none()

    # Token not found
    if submission is None:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired verification link.",
        )

    # Already verified
    if submission.status != "unverified":
        return RedirectResponse(
            url=f"{APP_BASE_URL}/submissions/already-verified",
            status_code=303,
        )

    # Token expired
    if (
        submission.token_expires_at
        and datetime.now(timezone.utc) > submission.token_expires_at
    ):
        raise HTTPException(
            status_code=410,
            detail="This verification link has expired.",
        )

    # Verify
    submission.status = "submitted"
    submission.verified_at = datetime.now(timezone.utc)
    submission.verification_token = None  # single-use token
    db.commit()

    logger.info("Submission %s verified by %s", submission.id, submission.submitter_email)

    return RedirectResponse(
        url=f"{APP_BASE_URL}/submissions/verified",
        status_code=303,
    )


@router.get("/api/v1/submissions/status/{token}", response_model=SubmissionStatusCheck)
def check_submission_status(
    token: str,
    db: Session = Depends(get_db),
):
    """Public status check using verification token. Never returns submitter email."""
    submission = db.execute(
        select(SubmissionMetadata).where(SubmissionMetadata.verification_token == token)
    ).scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return SubmissionStatusCheck(
        id=submission.id,
        status=submission.status,
        editor_notes=submission.editor_notes,
        created_at=submission.created_at,
    )


# --- Admin endpoints ---


@router.get("/api/v1/admin/submissions", response_model=list[SubmissionAdminRead])
def list_submissions(
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    offset = (page - 1) * per_page
    stmt = (
        select(SubmissionMetadata)
        .options(selectinload(SubmissionMetadata.records))
        .order_by(SubmissionMetadata.created_at.desc())
    )
    if status:
        stmt = stmt.where(SubmissionMetadata.status == status)
    else:
        # By default, hide unverified submissions from admin queue
        stmt = stmt.where(SubmissionMetadata.status != "unverified")
    stmt = stmt.offset(offset).limit(per_page)
    return db.execute(stmt).scalars().all()


@router.get("/api/v1/admin/submissions/{submission_id}", response_model=SubmissionAdminRead)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    stmt = (
        select(SubmissionMetadata)
        .options(selectinload(SubmissionMetadata.records))
        .where(SubmissionMetadata.id == submission_id)
    )
    submission = db.execute(stmt).scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@router.put("/api/v1/admin/submissions/{submission_id}", response_model=SubmissionAdminRead)
def update_submission(
    submission_id: int,
    body: SubmissionUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    submission = db.get(SubmissionMetadata, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if body.editor_notes is not None:
        submission.editor_notes = body.editor_notes

    db.commit()
    db.refresh(submission)

    stmt = (
        select(SubmissionMetadata)
        .options(selectinload(SubmissionMetadata.records))
        .where(SubmissionMetadata.id == submission_id)
    )
    return db.execute(stmt).scalar_one()


@router.put("/api/v1/admin/submissions/{submission_id}/approve", response_model=SubmissionAdminRead)
def approve_submission(
    submission_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    submission = db.execute(
        select(SubmissionMetadata)
        .options(selectinload(SubmissionMetadata.records))
        .where(SubmissionMetadata.id == submission_id)
    ).scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status not in ("submitted", "under_review"):
        raise HTTPException(status_code=400, detail=f"Cannot approve submission with status '{submission.status}'")

    # Approve all linked pending records — musicians first, then institutions, then lineage
    for rec in sorted(submission.records, key=lambda r: {"musician": 0, "institution": 1, "lineage": 2}.get(r.record_type, 3)):
        _activate_record(db, rec.record_type, rec.record_id)

    submission.status = "approved"
    submission.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    # Notify submitter
    musician_name = _get_submission_musician_name(db, submission)
    background_tasks.add_task(
        send_decision_email,
        to_email=submission.submitter_email,
        decision="approved",
        musician_name=musician_name,
    )

    stmt = (
        select(SubmissionMetadata)
        .options(selectinload(SubmissionMetadata.records))
        .where(SubmissionMetadata.id == submission_id)
    )
    return db.execute(stmt).scalar_one()


@router.put("/api/v1/admin/submissions/{submission_id}/reject", response_model=SubmissionAdminRead)
def reject_submission(
    submission_id: int,
    background_tasks: BackgroundTasks,
    body: SubmissionUpdate | None = None,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    submission = db.execute(
        select(SubmissionMetadata)
        .options(selectinload(SubmissionMetadata.records))
        .where(SubmissionMetadata.id == submission_id)
    ).scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status not in ("submitted", "under_review"):
        raise HTTPException(status_code=400, detail=f"Cannot reject submission with status '{submission.status}'")

    # Grab musician name before deleting pending records
    musician_name = _get_submission_musician_name(db, submission)

    # Delete all linked pending records — lineage first (FK deps), then institutions, then musicians
    for rec in sorted(submission.records, key=lambda r: {"lineage": 0, "institution": 1, "musician": 2}.get(r.record_type, 3)):
        _delete_pending_record(db, rec.record_type, rec.record_id)

    submission.status = "rejected"
    submission.reviewed_at = datetime.now(timezone.utc)
    if body and body.editor_notes is not None:
        submission.editor_notes = body.editor_notes
    db.commit()

    # Notify submitter
    background_tasks.add_task(
        send_decision_email,
        to_email=submission.submitter_email,
        decision="rejected",
        musician_name=musician_name,
        editor_notes=submission.editor_notes,
    )

    stmt = (
        select(SubmissionMetadata)
        .options(selectinload(SubmissionMetadata.records))
        .where(SubmissionMetadata.id == submission_id)
    )
    return db.execute(stmt).scalar_one()


@router.put(
    "/api/v1/admin/submissions/{submission_id}/records/{record_id}/approve",
    status_code=200,
)
def approve_single_record(
    submission_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    rec = db.execute(
        select(SubmissionRecord).where(
            SubmissionRecord.submission_id == submission_id,
            SubmissionRecord.id == record_id,
        )
    ).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Submission record not found")

    # Check dependency: if approving lineage, ensure referenced musicians are active
    if rec.record_type == "lineage":
        lineage = db.get(Lineage, rec.record_id)
        if lineage:
            teacher = db.get(Musician, lineage.teacher_id)
            student = db.get(Musician, lineage.student_id)
            if (teacher and teacher.status == "pending") or (student and student.status == "pending"):
                raise HTTPException(
                    status_code=400,
                    detail="Cannot approve lineage record: referenced musician(s) still pending",
                )

    _activate_record(db, rec.record_type, rec.record_id)
    db.commit()
    return {"status": "approved", "record_type": rec.record_type, "record_id": rec.record_id}


@router.put(
    "/api/v1/admin/submissions/{submission_id}/records/{record_id}/reject",
    status_code=200,
)
def reject_single_record(
    submission_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    rec = db.execute(
        select(SubmissionRecord).where(
            SubmissionRecord.submission_id == submission_id,
            SubmissionRecord.id == record_id,
        )
    ).scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Submission record not found")

    _delete_pending_record(db, rec.record_type, rec.record_id)
    db.commit()
    return {"status": "rejected", "record_type": rec.record_type, "record_id": rec.record_id}


# --- Admin pending record endpoints ---


@router.get("/api/v1/admin/pending/musicians")
def list_pending_musicians(
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    offset = (page - 1) * per_page
    stmt = (
        select(Musician)
        .where(Musician.status == "pending")
        .order_by(Musician.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    musicians = db.execute(stmt).scalars().all()
    return [
        {
            "id": m.id,
            "first_name": m.first_name,
            "last_name": m.last_name,
            "birth_date": m.birth_date,
            "death_date": m.death_date,
            "nationality": m.nationality,
            "bio_notes": m.bio_notes,
            "status": m.status,
        }
        for m in musicians
    ]


@router.get("/api/v1/admin/pending/lineage")
def list_pending_lineage(
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    offset = (page - 1) * per_page
    stmt = (
        select(Lineage)
        .options(
            selectinload(Lineage.teacher),
            selectinload(Lineage.student),
            selectinload(Lineage.institution),
        )
        .where(Lineage.status == "pending")
        .order_by(Lineage.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    lineages = db.execute(stmt).scalars().all()
    return [
        {
            "id": lin.id,
            "teacher": {"id": lin.teacher.id, "first_name": lin.teacher.first_name, "last_name": lin.teacher.last_name, "status": lin.teacher.status},
            "student": {"id": lin.student.id, "first_name": lin.student.first_name, "last_name": lin.student.last_name, "status": lin.student.status},
            "institution": {"id": lin.institution.id, "name": lin.institution.name} if lin.institution else None,
            "relationship_type": lin.relationship_type,
            "start_year": lin.start_year,
            "end_year": lin.end_year,
            "notes": lin.notes,
            "status": lin.status,
        }
        for lin in lineages
    ]


@router.put("/api/v1/admin/pending/musicians/{musician_id}")
def edit_pending_musician(
    musician_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    musician = db.get(Musician, musician_id)
    if not musician or musician.status != "pending":
        raise HTTPException(status_code=404, detail="Pending musician not found")

    allowed_fields = {"first_name", "last_name", "birth_date", "death_date", "nationality", "bio_notes"}
    for field, value in body.items():
        if field in allowed_fields:
            setattr(musician, field, value)

    # Regenerate name_search
    musician.name_search = normalize(f"{musician.first_name} {musician.last_name}")

    db.commit()
    db.refresh(musician)
    return {
        "id": musician.id,
        "first_name": musician.first_name,
        "last_name": musician.last_name,
        "birth_date": musician.birth_date,
        "death_date": musician.death_date,
        "nationality": musician.nationality,
        "bio_notes": musician.bio_notes,
        "status": musician.status,
    }


@router.put("/api/v1/admin/pending/lineage/{lineage_id}")
def edit_pending_lineage(
    lineage_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    lineage = db.get(Lineage, lineage_id)
    if not lineage or lineage.status != "pending":
        raise HTTPException(status_code=404, detail="Pending lineage record not found")

    allowed_fields = {"institution_id", "relationship_type", "start_year", "end_year", "notes"}
    for field, value in body.items():
        if field in allowed_fields:
            setattr(lineage, field, value)

    db.commit()
    db.refresh(lineage)
    return {"id": lineage.id, "status": lineage.status}


# --- Purge expired unverified submissions ---


def purge_expired_unverified(db: Session) -> int:
    """
    Delete submission_metadata rows (and their pending records) that are
    still 'unverified' past the expiry window. Called on app startup.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=EXPIRY_DAYS)

    expired = db.execute(
        select(SubmissionMetadata)
        .options(selectinload(SubmissionMetadata.records))
        .where(
            SubmissionMetadata.status == "unverified",
            SubmissionMetadata.created_at < cutoff,
        )
    ).scalars().all()

    for sub in expired:
        # Delete linked pending records (lineage first, then institutions, then musicians)
        for rec in sorted(sub.records, key=lambda r: {"lineage": 0, "institution": 1, "musician": 2}.get(r.record_type, 3)):
            _delete_pending_record(db, rec.record_type, rec.record_id)
        db.delete(sub)

    if expired:
        db.commit()
        logger.info("Purged %d expired unverified submissions", len(expired))

    return len(expired)


# --- Helpers ---


def _get_submission_musician_name(db: Session, submission: SubmissionMetadata) -> str | None:
    """Extract the student musician name from a submission's linked records."""
    for rec in submission.records:
        if rec.record_type == "musician":
            musician = db.get(Musician, rec.record_id)
            if musician:
                return f"{musician.first_name} {musician.last_name}"
    return None


def _find_existing_musician(db: Session, first_name: str, last_name: str) -> Musician | None:
    """Find an active musician by normalized name match."""
    search = normalize(f"{first_name} {last_name}")
    return db.execute(
        select(Musician).where(
            Musician.name_search == search,
            Musician.status == "active",
        )
    ).scalar_one_or_none()


def _activate_record(db: Session, record_type: str, record_id: int):
    """Flip a pending record's status to active."""
    model = {"musician": Musician, "lineage": Lineage, "institution": Institution}.get(record_type)
    if model:
        record = db.get(model, record_id)
        if record and record.status == "pending":
            record.status = "active"


def _delete_pending_record(db: Session, record_type: str, record_id: int):
    """Delete a pending record. Only deletes if still pending."""
    model = {"musician": Musician, "lineage": Lineage, "institution": Institution}.get(record_type)
    if model:
        record = db.get(model, record_id)
        if record and record.status == "pending":
            db.delete(record)
