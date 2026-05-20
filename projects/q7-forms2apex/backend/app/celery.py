"""
celery.py — Celery app configuration and async tasks.

Tasks:
- parse_form_file: Download .txt from MinIO, parse, upload JSON, update DB.
- generate_apex_sql: Download JSON from MinIO, generate SQL, upload .sql, update DB.

Note: Celery tasks use synchronous SQLAlchemy because Celery doesn't
play well with async SQLAlchemy natively.
"""

import json
from typing import Optional

from celery import Celery
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models import Migration, MigrationStatus
from app.services.storage_service import StorageService
from app.services.parser_service import ParserService
from app.services.generator_service import GeneratorService

settings = get_settings()

# Convert asyncpg URL to sync psycopg2 URL for Celery
def _get_sync_db_url() -> str:
    url = settings.DATABASE_URL
    return url.replace("+asyncpg", "").replace("postgresql://", "postgresql+psycopg2://")


SYNC_DATABASE_URL = _get_sync_db_url()
sync_engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=sync_engine)

celery_app = Celery(
    "forms2apex",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.celery"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    worker_prefetch_multiplier=1,
)


def _get_db():
    """Yield a synchronous DB session for Celery tasks."""
    session = SyncSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _update_migration_status(
    session,
    migration_id: int,
    status: MigrationStatus,
    progress: float = 0.0,
    error_message: Optional[str] = None,
    file_path_key: Optional[str] = None,
    file_path_value: Optional[str] = None,
) -> None:
    """Update a migration's status and optional fields."""
    result = session.execute(select(Migration).where(Migration.id == migration_id))
    migration = result.scalar_one_or_none()
    if migration is None:
        return

    migration.status = status
    migration.progress_percent = progress
    if error_message is not None:
        migration.error_message = error_message
    if file_path_key and file_path_value:
        setattr(migration, file_path_key, file_path_value)
    if status in (MigrationStatus.COMPLETED, MigrationStatus.FAILED):
        from datetime import datetime, timezone
        migration.completed_at = datetime.now(timezone.utc)
    session.commit()


@celery_app.task(bind=True, max_retries=3)
def parse_form_file(self, migration_id: int, minio_key: str, bucket: str) -> dict:
    """
    Celery task: parse an Oracle Forms .txt file and store the JSON result.

    Args:
        migration_id: ID of the Migration record.
        minio_key: MinIO object key for the .txt file.
        bucket: MinIO bucket name.

    Returns:
        Dict with success status and output key.
    """
    storage = StorageService()
    parser = ParserService()
    db = next(_get_db())

    try:
        _update_migration_status(
            db, migration_id, MigrationStatus.PARSING, progress=10.0
        )

        # Download from MinIO
        raw_bytes = storage.download_file(minio_key, bucket)
        text = raw_bytes.decode("utf-8", errors="ignore")
        _update_migration_status(db, migration_id, MigrationStatus.PARSING, progress=40.0)

        # Parse
        parsed_data = parser.parse_form_text(text)
        _update_migration_status(db, migration_id, MigrationStatus.PARSING, progress=70.0)

        # Upload JSON back to MinIO
        json_bytes = json.dumps(parsed_data, indent=2, ensure_ascii=False).encode("utf-8")
        json_key = f"parsed/{migration_id}_parsed.json"
        storage.upload_file(json_bytes, json_key, "application/json", bucket)
        _update_migration_status(
            db,
            migration_id,
            MigrationStatus.PARSED,
            progress=100.0,
            file_path_key="parsed_json_path",
            file_path_value=json_key,
        )

        return {"success": True, "output_key": json_key}

    except Exception as exc:
        _update_migration_status(
            db, migration_id, MigrationStatus.FAILED, error_message=str(exc)
        )
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def generate_apex_sql(
    self,
    migration_id: int,
    json_minio_key: str,
    bucket: str,
    page_id: int = 100,
    app_id: int = 100,
) -> dict:
    """
    Celery task: generate APEX SQL from parsed JSON.

    Args:
        migration_id: ID of the Migration record.
        json_minio_key: MinIO object key for the parsed JSON.
        bucket: MinIO bucket name.
        page_id: APEX page ID.
        app_id: APEX application ID.

    Returns:
        Dict with success status and output key.
    """
    storage = StorageService()
    generator = GeneratorService()
    db = next(_get_db())

    try:
        _update_migration_status(
            db, migration_id, MigrationStatus.GENERATING, progress=10.0
        )

        # Download parsed JSON
        json_bytes = storage.download_file(json_minio_key, bucket)
        parsed_data = json.loads(json_bytes.decode("utf-8"))
        _update_migration_status(
            db, migration_id, MigrationStatus.GENERATING, progress=40.0
        )

        # Generate SQL
        sql_content = generator.generate_sql(parsed_data, page_id=page_id, app_id=app_id)
        _update_migration_status(
            db, migration_id, MigrationStatus.GENERATING, progress=70.0
        )

        # Upload SQL to MinIO
        sql_bytes = sql_content.encode("utf-8")
        sql_key = f"sql/{migration_id}_generated.sql"
        storage.upload_file(sql_bytes, sql_key, "text/plain", bucket)
        _update_migration_status(
            db,
            migration_id,
            MigrationStatus.COMPLETED,
            progress=100.0,
            file_path_key="generated_sql_path",
            file_path_value=sql_key,
        )

        return {"success": True, "output_key": sql_key}

    except Exception as exc:
        _update_migration_status(
            db, migration_id, MigrationStatus.FAILED, error_message=str(exc)
        )
        raise self.retry(exc=exc, countdown=60)
