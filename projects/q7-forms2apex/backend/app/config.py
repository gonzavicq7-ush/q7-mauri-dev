from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://forms2apex:forms2apex_secret@db:5432/forms2apex"
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    
    # MinIO/S3
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "forms2apex"
    MINIO_SECRET_KEY: str = "forms2apex_secret"
    MINIO_BUCKET: str = "forms2apex-uploads"
    MINIO_SECURE: bool = False
    
    # Security
    SECRET_KEY: str = "super_secret_key_cambiar_en_produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 horas
    
    # App
    DEBUG: bool = True
    APP_NAME: str = "q7-forms2apex"
    APP_VERSION: str = "0.1.0"
    
    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()