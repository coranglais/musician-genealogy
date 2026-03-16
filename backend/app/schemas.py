from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# --- Instruments ---

class InstrumentBase(BaseModel):
    name: str
    family: str

class InstrumentCreate(InstrumentBase):
    pass

class InstrumentRead(InstrumentBase):
    id: int
    model_config = {"from_attributes": True}


# --- Musicians ---

class MusicianNameRead(BaseModel):
    id: int
    name: str
    name_type: str
    model_config = {"from_attributes": True}

class MusicianInstrumentRead(BaseModel):
    id: int
    instrument_id: int
    instrument: InstrumentRead
    is_primary: bool
    model_config = {"from_attributes": True}

class MusicianBase(BaseModel):
    last_name: str
    first_name: str
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    nationality: Optional[str] = None
    bio_notes: Optional[str] = None

class MusicianCreate(MusicianBase):
    instrument_ids: list[int] = []

class MusicianUpdate(BaseModel):
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    nationality: Optional[str] = None
    bio_notes: Optional[str] = None

class MusicianSummary(BaseModel):
    id: int
    last_name: str
    first_name: str
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    nationality: Optional[str] = None
    model_config = {"from_attributes": True}

class MusicianRead(MusicianBase):
    id: int
    alternate_names: list[MusicianNameRead] = []
    musician_instruments: list[MusicianInstrumentRead] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# --- Institutions ---

class InstitutionNameRead(BaseModel):
    id: int
    name: str
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    locale: Optional[str] = None
    model_config = {"from_attributes": True}

class InstitutionBase(BaseModel):
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    founded_year: Optional[int] = None

class InstitutionCreate(InstitutionBase):
    pass

class InstitutionRead(InstitutionBase):
    id: int
    historical_names: list[InstitutionNameRead] = []
    model_config = {"from_attributes": True}

class InstitutionSummary(BaseModel):
    id: int
    name: str
    city: Optional[str] = None
    country: Optional[str] = None
    model_config = {"from_attributes": True}


# --- Sources ---

class SourceBase(BaseModel):
    title: str
    author: Optional[str] = None
    source_type: str
    url: Optional[str] = None
    isbn: Optional[str] = None
    notes: Optional[str] = None

class SourceCreate(SourceBase):
    pass

class SourceUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    source_type: Optional[str] = None
    url: Optional[str] = None
    isbn: Optional[str] = None
    notes: Optional[str] = None

class SourceRead(SourceBase):
    id: int
    model_config = {"from_attributes": True}

class LineageSourceBase(BaseModel):
    lineage_id: int
    source_id: int
    page_reference: Optional[str] = None

class LineageSourceCreate(BaseModel):
    page_reference: Optional[str] = None

class LineageSourceRead(BaseModel):
    id: int
    source: SourceRead
    page_reference: Optional[str] = None
    model_config = {"from_attributes": True}


# --- Lineage ---

class LineageBase(BaseModel):
    teacher_id: int
    student_id: int
    institution_id: Optional[int] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    relationship_type: str = "formal_study"
    notes: Optional[str] = None

class LineageCreate(LineageBase):
    pass

class LineageUpdate(BaseModel):
    institution_id: Optional[int] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    relationship_type: Optional[str] = None
    notes: Optional[str] = None

class LineageRead(LineageBase):
    id: int
    teacher: MusicianSummary
    student: MusicianSummary
    institution: Optional[InstitutionSummary] = None
    sources: list[LineageSourceRead] = []
    model_config = {"from_attributes": True}


# --- Lineage Tree ---

class LineageTreeNode(BaseModel):
    musician: MusicianSummary
    relationship_type: Optional[str] = None
    institution: Optional[InstitutionSummary] = None
    depth: int = 0
    visual_weight: str = "primary"
    children: list["LineageTreeNode"] = []


# --- Search ---

class SearchResult(BaseModel):
    id: int
    display_name: str
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    result_type: str  # "musician" or "institution"
    match_score: float = 0.0
    matched_via: Optional[str] = None


class AutocompleteResult(BaseModel):
    musician_id: int
    display_name: str
    birth_date: Optional[str] = None
    death_date: Optional[str] = None
    match_score: float = 0.0
    matched_via: str = "canonical"


# --- Submissions ---

class SubmissionRecordRead(BaseModel):
    id: int
    record_type: str
    record_id: int
    model_config = {"from_attributes": True}

class SubmissionStatusCheck(BaseModel):
    id: int
    status: str
    created_at: Optional[datetime] = None

class SubmissionRead(BaseModel):
    id: int
    submitter_name: str
    submitter_email: str
    submission_type: str
    notes: Optional[str] = None
    verification_info: Optional[str] = None
    original_text: Optional[str] = None
    status: str
    editor_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    records: list[SubmissionRecordRead] = []
    model_config = {"from_attributes": True}

class SubmissionUpdate(BaseModel):
    editor_notes: Optional[str] = None


# --- Submission Form Input ---

class StructuredSubmission(BaseModel):
    submitter_name: str
    submitter_email: str
    student_first_name: str
    student_last_name: str
    student_birth_date: Optional[str] = None
    student_death_date: Optional[str] = None
    student_nationality: Optional[str] = None
    student_instrument: Optional[str] = None
    relationships: list["SubmittedRelationship"] = []
    notes: Optional[str] = None
    verification_info: Optional[str] = None
    honeypot: Optional[str] = None

class SubmittedRelationship(BaseModel):
    teacher_first_name: str
    teacher_last_name: str
    institution_name: Optional[str] = None
    institution_city: Optional[str] = None
    institution_country: Optional[str] = None
    relationship_type: str = "formal_study"
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    notes: Optional[str] = None

class FreeTextSubmission(BaseModel):
    submitter_name: str
    submitter_email: str
    text: str
    verification_info: Optional[str] = None
    honeypot: Optional[str] = None

class ParsedSubmissionPreview(BaseModel):
    """Returned by the AI parsing endpoint for submitter review."""
    student: "ParsedMusician"
    relationships: list["ParsedRelationship"] = []

class ParsedMusician(BaseModel):
    first_name: str
    last_name: str
    existing_id: Optional[int] = None
    instrument: Optional[str] = None

class ParsedRelationship(BaseModel):
    teacher: ParsedMusician
    institution_name: Optional[str] = None
    institution_city: Optional[str] = None
    relationship_type: str = "formal_study"
    start_year: Optional[int] = None
    end_year: Optional[int] = None


# --- Auth ---

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    message: str


# --- Pagination ---

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
    pages: int
