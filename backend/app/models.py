from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Instrument(Base):
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    family = Column(String(50), nullable=False)
    parent_id = Column(Integer, ForeignKey("instruments.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    parent = relationship("Instrument", remote_side=[id], back_populates="companions")
    companions = relationship("Instrument", back_populates="parent")
    musician_instruments = relationship("MusicianInstrument", back_populates="instrument")


class Musician(Base):
    __tablename__ = "musicians"

    id = Column(Integer, primary_key=True, index=True)
    last_name = Column(String(200), nullable=False)
    first_name = Column(String(200), nullable=False)
    birth_date = Column(String(50), nullable=True)
    death_date = Column(String(50), nullable=True)
    nationality = Column(String(100), nullable=True)
    bio_notes = Column(Text, nullable=True)
    name_search = Column(String(500), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="active", server_default="active")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    alternate_names = relationship("MusicianName", back_populates="musician", cascade="all, delete-orphan")
    musician_instruments = relationship("MusicianInstrument", back_populates="musician", cascade="all, delete-orphan")
    teacher_lineages = relationship("Lineage", foreign_keys="Lineage.student_id", back_populates="student")
    student_lineages = relationship("Lineage", foreign_keys="Lineage.teacher_id", back_populates="teacher")


class MusicianName(Base):
    __tablename__ = "musician_names"

    id = Column(Integer, primary_key=True, index=True)
    musician_id = Column(Integer, ForeignKey("musicians.id"), nullable=False)
    name = Column(String(400), nullable=False)
    name_search = Column(String(400), nullable=True, index=True)
    name_type = Column(String(50), nullable=False)

    musician = relationship("Musician", back_populates="alternate_names")


class MusicianInstrument(Base):
    __tablename__ = "musician_instruments"

    id = Column(Integer, primary_key=True, index=True)
    musician_id = Column(Integer, ForeignKey("musicians.id"), nullable=False)
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=False)
    is_primary = Column(Boolean, default=True)

    musician = relationship("Musician", back_populates="musician_instruments")
    instrument = relationship("Instrument", back_populates="musician_instruments")


class Lineage(Base):
    __tablename__ = "lineage"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("musicians.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("musicians.id"), nullable=False)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    start_year = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)
    relationship_type = Column(String(50), nullable=False, default="formal_study")
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active", server_default="active")
    created_at = Column(DateTime, default=utcnow)

    teacher = relationship("Musician", foreign_keys=[teacher_id], back_populates="student_lineages")
    student = relationship("Musician", foreign_keys=[student_id], back_populates="teacher_lineages")
    institution = relationship("Institution")
    sources = relationship("LineageSource", back_populates="lineage", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("teacher_id", "student_id", "institution_id", name="uq_lineage_teacher_student_institution"),
    )


class Institution(Base):
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    founded_year = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="active", server_default="active")
    created_at = Column(DateTime, default=utcnow)

    historical_names = relationship("InstitutionName", back_populates="institution", cascade="all, delete-orphan")


class InstitutionName(Base):
    __tablename__ = "institution_names"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False)
    name = Column(String(300), nullable=False)
    start_year = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)
    locale = Column(String(10), nullable=True)

    institution = relationship("Institution", back_populates="historical_names")


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    author = Column(String(300), nullable=True)
    source_type = Column(String(50), nullable=False)
    url = Column(String(500), nullable=True)
    isbn = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)

    lineage_sources = relationship("LineageSource", back_populates="source")


class LineageSource(Base):
    __tablename__ = "lineage_sources"

    id = Column(Integer, primary_key=True, index=True)
    lineage_id = Column(Integer, ForeignKey("lineage.id"), nullable=False)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    page_reference = Column(String(100), nullable=True)

    lineage = relationship("Lineage", back_populates="sources")
    source = relationship("Source", back_populates="lineage_sources")


class SubmissionMetadata(Base):
    __tablename__ = "submission_metadata"

    id = Column(Integer, primary_key=True, index=True)
    submitter_name = Column(String(200), nullable=False)
    submitter_email = Column(String(200), nullable=False)
    submission_type = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    verification_info = Column(Text, nullable=True)
    original_text = Column(Text, nullable=True)
    verification_token = Column(String(100), nullable=True, unique=True, index=True)
    status = Column(String(20), nullable=False, default="submitted")
    editor_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    records = relationship("SubmissionRecord", back_populates="submission", cascade="all, delete-orphan")


class SubmissionRecord(Base):
    __tablename__ = "submission_records"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submission_metadata.id"), nullable=False)
    record_type = Column(String(50), nullable=False)
    record_id = Column(Integer, nullable=False)

    submission = relationship("SubmissionMetadata", back_populates="records")
