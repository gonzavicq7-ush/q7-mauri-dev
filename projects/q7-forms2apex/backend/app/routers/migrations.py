"""
migrations.py — Migration lifecycle routes.

Routes:
- POST /projects/{project_id}/migrations — create migration
- POST /migrations/{migration_id}/upload — upload .txt file
- POST /migrations/{migration_id}/parse — trigger async parse
- GET /migrations/{migration_id}/status — get status + progress
- GET /migrations/{migration_id}/parsed — get parsed JSON
- POST /migrations/{migration_id}/generate — trigger async generate
- GET /migrations/{migration_id}/download — download generated SQL
- GET /projects/{project_id}/migrations — list all migrations
"""

import json
import uuid
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.celery import parse_form_file, generate_apex_sql
from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Migration, MigrationStatus, Project, FormFile, User
from app.schemas import (
    MigrationCreate,
    MigrationResponse,
    MigrationUpdate,
    FormFileCreate,
    FormFileResponse,
    ParsedDataResponse,
    GeneratedSQLResponse,
)
from app.services.storage_service import StorageService, get_storage_service

settings = get_settings()
router = APIRouter(prefix="/migrations", tags=["migrations"])


def _check_project_access(user: User, project: Project) -> None:
    """Raise 403 if user cannot access the project."""
    if user.is_superuser:
        return
    if user.org_id != project.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project",
        )


@router.post(
    "/projects/{project_id}/migrations",
    response_model=MigrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_migration(
    project_id: int,
    payload: MigrationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Migration:
    """Create a new migration under a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    _check_project_access(current_user, project)

    migration = Migration(
        project_id=project_id,
        name=payload.name,
        status=MigrationStatus.PENDING,
        progress_percent=0.0,
    )
    db.add(migration)
    await db.commit()
    await db.refresh(migration)
    return migration


@router.post("/{migration_id}/upload", response_model=FormFileResponse)
async def upload_form_file(
    migration_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageService = Depends(get_storage_service),
) -> FormFile:
    """Upload a .txt Oracle Forms file for a migration."""
    result = await db.execute(
        select(Migration, Project)
        .join(Project, Migration.project_id == Project.id)
        .where(Migration.id == migration_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Migration not found",
        )
    migration, project = row
    _check_project_access(current_user, project)

    if not file.filename or not file.filename.lower().endswith(".txt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .txt files are accepted",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    # Upload to MinIO
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "txt"
    minio_key = f"uploads/{migration_id}/{uuid.uuid4()}.{ext}"
    storage.upload_file(
        content,
        minio_key,
        content_type=file.content_type or "text/plain",
        bucket=settings.MINIO_BUCKET,
    )

    # Create FormFile record
    form_file = FormFile(
        migration_id=migration_id,
        original_filename=file.filename,
        file_size=len(content),
        mime_type=file.content_type or "text/plain",
        minio_key=minio_key,
        minio_bucket=settings.MINIO_BUCKET,
    )
    db.add(form_file)

    # Update migration
    migration.status = MigrationStatus.PENDING
    migration.form_file_path = minio_key
    migration.progress_percent = 0.0

    await db.commit()
    await db.refresh(form_file)
    return form_file


@router.post("/{migration_id}/parse")
async def trigger_parse(
    migration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Trigger async parsing of the uploaded .txt file."""
    result = await db.execute(
        select(Migration, Project)
        .join(Project, Migration.project_id == Project.id)
        .where(Migration.id == migration_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Migration not found",
        )
    migration, project = row
    _check_project_access(current_user, project)

    if not migration.form_file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file uploaded for this migration",
        )

    migration.status = MigrationStatus.PARSING
    migration.progress_percent = 5.0
    await db.commit()

    task = parse_form_file.delay(
        migration_id=migration_id,
        minio_key=migration.form_file_path,
        bucket=settings.MINIO_BUCKET,
    )

    return {"task_id": task.id, "status": "PARSING_STARTED"}


@router.get("/{migration_id}/status", response_model=MigrationResponse)
async def get_migration_status(
    migration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Migration:
    """Get current status and progress of a migration."""
    result = await db.execute(
        select(Migration, Project)
        .join(Project, Migration.project_id == Project.id)
        .where(Migration.id == migration_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Migration not found",
        )
    migration, project = row
    _check_project_access(current_user, project)
    return migration


@router.get("/{migration_id}/parsed")
async def get_parsed_data(
    migration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageService = Depends(get_storage_service),
) -> ParsedDataResponse:
    """Get the parsed JSON data for a migration."""
    result = await db.execute(
        select(Migration, Project)
        .join(Project, Migration.project_id == Project.id)
        .where(Migration.id == migration_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Migration not found",
        )
    migration, project = row
    _check_project_access(current_user, project)

    if not migration.parsed_json_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Migration has not been parsed yet",
        )

    import json
    if migration.form_files:
        bucket = migration.form_files[0].minio_bucket
    else:
        bucket = settings.MINIO_BUCKET
    raw = storage.download_file(migration.parsed_json_path, bucket)
    data = json.loads(raw.decode("utf-8"))

    return ParsedDataResponse(migration_id=migration_id, data=data)


@router.post("/{migration_id}/generate")
async def trigger_generate(
    migration_id: int,
    page_id: Optional[int] = Form(100),
    app_id: Optional[int] = Form(100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Trigger async SQL generation from parsed data."""
    result = await db.execute(
        select(Migration, Project)
        .join(Project, Migration.project_id == Project.id)
        .where(Migration.id == migration_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Migration not found",
        )
    migration, project = row
    _check_project_access(current_user, project)

    if not migration.parsed_json_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Migration has not been parsed yet",
        )

    migration.status = MigrationStatus.GENERATING
    migration.progress_percent = 5.0
    await db.commit()

    task = generate_apex_sql.delay(
        migration_id=migration_id,
        json_minio_key=migration.parsed_json_path,
        bucket=settings.MINIO_BUCKET,
        page_id=page_id or 100,
        app_id=app_id or 100,
    )

    return {"task_id": task.id, "status": "GENERATION_STARTED"}


@router.get("/{migration_id}/download")
async def download_sql(
    migration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageService = Depends(get_storage_service),
) -> StreamingResponse:
    """Download the generated SQL file."""
    result = await db.execute(
        select(Migration, Project)
        .join(Project, Migration.project_id == Project.id)
        .where(Migration.id == migration_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Migration not found",
        )
    migration, project = row
    _check_project_access(current_user, project)

    if not migration.generated_sql_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SQL has not been generated yet",
        )

    if migration.form_files:
        bucket = migration.form_files[0].minio_bucket
    else:
        bucket = settings.MINIO_BUCKET
    raw = storage.download_file(migration.generated_sql_path, bucket)

    return StreamingResponse(
        iter([raw]),
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="{migration.name}_generated.sql"'
        },
    )


@router.get("/projects/{project_id}/migrations", response_model=List[MigrationResponse])
async def list_migrations(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Migration]:
    """List all migrations for a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    _check_project_access(current_user, project)

    result = await db.execute(
        select(Migration).where(Migration.project_id == project_id)
    )
    return result.scalars().all()


@router.put("/{migration_id}", response_model=MigrationResponse)
async def update_migration(
    migration_id: int,
    payload: MigrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Migration:
    """Update migration metadata."""
    result = await db.execute(
        select(Migration, Project)
        .join(Project, Migration.project_id == Project.id)
        .where(Migration.id == migration_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Migration not found",
        )
    migration, project = row
    _check_project_access(current_user, project)

    if payload.name is not None:
        migration.name = payload.name
    if payload.status is not None:
        migration.status = payload.status
    if payload.progress_percent is not None:
        migration.progress_percent = payload.progress_percent
    if payload.error_message is not None:
        migration.error_message = payload.error_message

    await db.commit()
    await db.refresh(migration)
    return migration


@router.delete("/{migration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_migration(
    migration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    storage: StorageService = Depends(get_storage_service),
) -> None:
    """Delete a migration and its associated MinIO files."""
    result = await db.execute(
        select(Migration, Project)
        .join(Project, Migration.project_id == Project.id)
        .where(Migration.id == migration_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Migration not found",
        )
    migration, project = row
    _check_project_access(current_user, project)

    # Clean up MinIO files
    bucket = settings.MINIO_BUCKET
    if migration.form_file_path:
        try:
            storage.delete_file(migration.form_file_path, bucket)
        except Exception:
            pass
    if migration.parsed_json_path:
        try:
            storage.delete_file(migration.parsed_json_path, bucket)
        except Exception:
            pass
    if migration.generated_sql_path:
        try:
            storage.delete_file(migration.generated_sql_path, bucket)
        except Exception:
            pass

    await db.delete(migration)
    await db.commit()
