"""
models.py — SQLAlchemy ORM models for q7-forms2apex.

Models:
- User: application users with JWT auth
- Organization: multi-tenant organizations
- Project: projects scoped to an organization
- Migration: form-to-APEX migration lifecycle
- FormFile: uploaded .txt files stored in MinIO
"""

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Enum,
    Float,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utc_now() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


class MigrationStatus(str, enum.Enum):
    """Lifecycle status for a migration."""
    PENDING = "PENDING"
    PARSING = "PARSING"
    PARSED = "PARSED"
    REVIEWING = "REVIEWING"
    GENERATING = "GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Organization(Base):
    """Multi-tenant organization."""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    schema_name = Column(String(63), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    users = relationship("User", back_populates="organization")
    projects = relationship("Project", back_populates="organization")


class User(Base):
    """Application user with JWT-based authentication."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="users")


class Project(Base):
    """Project that groups migrations."""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    organization = relationship("Organization", back_populates="projects")
    migrations = relationship("Migration", back_populates="project")


class Migration(Base):
    """Form-to-APEX migration lifecycle tracker."""
    __tablename__ = "migrations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(
        Enum(MigrationStatus),
        default=MigrationStatus.PENDING,
        nullable=False,
    )
    form_file_path = Column(String(512), nullable=True)
    parsed_json_path = Column(String(512), nullable=True)
    generated_sql_path = Column(String(512), nullable=True)
    error_message = Column(Text, nullable=True)
    progress_percent = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="migrations")
    form_files = relationship("FormFile", back_populates="migration")


class FormFile(Base):
    """Metadata for an uploaded Oracle Forms .txt file."""
    __tablename__ = "form_files"

    id = Column(Integer, primary_key=True, index=True)
    migration_id = Column(Integer, ForeignKey("migrations.id"), nullable=False)
    original_filename = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(255), nullable=False)
    minio_key = Column(String(512), nullable=False)
    minio_bucket = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    migration = relationship("Migration", back_populates="form_files")
