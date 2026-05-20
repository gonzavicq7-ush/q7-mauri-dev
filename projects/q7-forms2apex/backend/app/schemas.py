"""
schemas.py — Pydantic models for request/response validation.

Provides Create, Response, and Update schemas for all entities.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

from app.models import MigrationStatus


# ──────────────────────────────────────────────────────────────────
# Organization
# ──────────────────────────────────────────────────────────────────

class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    slug: str = Field(..., min_length=1, max_length=255)
    schema_name: Optional[str] = Field(None, max_length=63)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    schema_name: Optional[str] = Field(None, max_length=63)


class OrganizationResponse(OrganizationBase):
    id: int
    slug: str
    schema_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────
# User
# ──────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_superuser: bool
    org_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserInDB(UserResponse):
    hashed_password: str


# ──────────────────────────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ──────────────────────────────────────────────────────────────────
# Project
# ──────────────────────────────────────────────────────────────────

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: int
    org_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────
# Migration
# ──────────────────────────────────────────────────────────────────

class MigrationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class MigrationCreate(MigrationBase):
    pass


class MigrationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[MigrationStatus] = None
    progress_percent: Optional[float] = Field(None, ge=0, le=100)
    error_message: Optional[str] = None


class MigrationResponse(MigrationBase):
    id: int
    project_id: int
    status: MigrationStatus
    form_file_path: Optional[str]
    parsed_json_path: Optional[str]
    generated_sql_path: Optional[str]
    error_message: Optional[str]
    progress_percent: float
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class MigrationListResponse(BaseModel):
    items: List[MigrationResponse]
    total: int


# ──────────────────────────────────────────────────────────────────
# FormFile
# ──────────────────────────────────────────────────────────────────

class FormFileBase(BaseModel):
    original_filename: str
    file_size: int
    mime_type: str


class FormFileCreate(FormFileBase):
    migration_id: int
    minio_key: str
    minio_bucket: str


class FormFileResponse(FormFileBase):
    id: int
    migration_id: int
    minio_key: str
    minio_bucket: str
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────
# Parsed JSON / Generation output
# ──────────────────────────────────────────────────────────────────

class ParsedDataResponse(BaseModel):
    migration_id: int
    data: dict


class GeneratedSQLResponse(BaseModel):
    migration_id: int
    sql_content: str
    download_url: Optional[str] = None
