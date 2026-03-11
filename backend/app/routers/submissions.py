from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..database import get_db
from ..models import Submission
from ..schemas import SubmissionCreate, SubmissionRead, SubmissionStatusCheck, SubmissionUpdate

router = APIRouter(tags=["submissions"])


# --- Public endpoints ---

@router.post("/api/v1/submissions", response_model=SubmissionStatusCheck, status_code=201)
def create_submission(body: SubmissionCreate, db: Session = Depends(get_db)):
    submission = Submission(
        submitter_name=body.submitter_name,
        submitter_email=body.submitter_email,
        submission_type=body.submission_type,
        teacher_name=body.teacher_name,
        student_name=body.student_name,
        institution_name=body.institution_name,
        relationship_type=body.relationship_type,
        start_year=body.start_year,
        end_year=body.end_year,
        notes=body.notes,
        verification_info=body.verification_info,
        status="submitted",
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return SubmissionStatusCheck(
        id=submission.id,
        status=submission.status,
        created_at=submission.created_at,
    )


@router.get("/api/v1/submissions/{submission_id}/status", response_model=SubmissionStatusCheck)
def check_submission_status(
    submission_id: int,
    email: str = Query(...),
    db: Session = Depends(get_db),
):
    submission = db.get(Submission, submission_id)
    if not submission or submission.submitter_email != email:
        raise HTTPException(status_code=404, detail="Submission not found")
    return SubmissionStatusCheck(
        id=submission.id,
        status=submission.status,
        created_at=submission.created_at,
    )


# --- Admin endpoints ---

@router.get("/api/v1/admin/submissions", response_model=list[SubmissionRead])
def list_submissions(
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    offset = (page - 1) * per_page
    stmt = select(Submission).order_by(Submission.created_at.desc())
    if status:
        stmt = stmt.where(Submission.status == status)
    stmt = stmt.offset(offset).limit(per_page)
    result = db.execute(stmt)
    return result.scalars().all()


@router.put("/api/v1/admin/submissions/{submission_id}", response_model=SubmissionRead)
def update_submission(
    submission_id: int,
    body: SubmissionUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    submission = db.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(submission, field, value)

    if "status" in update_data and update_data["status"] in ("approved", "rejected"):
        submission.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(submission)
    return submission
