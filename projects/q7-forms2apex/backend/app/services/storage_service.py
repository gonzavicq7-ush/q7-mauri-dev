"""
storage_service.py — MinIO/S3-compatible storage wrapper.

Uses boto3 to interact with MinIO for file upload, download, and presigned URLs.
"""

import io
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import get_settings

settings = get_settings()


class StorageService:
    """
    MinIO/S3 storage service for file operations.
    """

    def __init__(self) -> None:
        self.endpoint = settings.MINIO_ENDPOINT
        self.access_key = settings.MINIO_ACCESS_KEY
        self.secret_key = settings.MINIO_SECRET_KEY
        self.bucket = settings.MINIO_BUCKET
        self.secure = settings.MINIO_SECURE

        self.s3_client = boto3.client(
            "s3",
            endpoint_url=f"{'https' if self.secure else 'http'}://{self.endpoint}",
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=BotoConfig(signature_version="s3v4"),
        )

    def upload_file(
        self,
        file_data: bytes,
        key: str,
        content_type: str = "application/octet-stream",
        bucket: Optional[str] = None,
    ) -> str:
        """
        Upload a file to MinIO/S3.

        Args:
            file_data: Raw bytes to upload.
            key: Object key (path in bucket).
            content_type: MIME type of the file.
            bucket: Optional override bucket name.

        Returns:
            The object key that was uploaded.

        Raises:
            RuntimeError: If upload fails.
        """
        target_bucket = bucket or self.bucket
        try:
            self.s3_client.put_object(
                Bucket=target_bucket,
                Key=key,
                Body=file_data,
                ContentType=content_type,
            )
            return key
        except ClientError as exc:
            raise RuntimeError(f"Failed to upload file to MinIO: {exc}") from exc

    def download_file(
        self,
        key: str,
        bucket: Optional[str] = None,
    ) -> bytes:
        """
        Download a file from MinIO/S3.

        Args:
            key: Object key to download.
            bucket: Optional override bucket name.

        Returns:
            Raw file bytes.

        Raises:
            RuntimeError: If download fails.
        """
        target_bucket = bucket or self.bucket
        try:
            response = self.s3_client.get_object(Bucket=target_bucket, Key=key)
            return response["Body"].read()
        except ClientError as exc:
            raise RuntimeError(f"Failed to download file from MinIO: {exc}") from exc

    def delete_file(
        self,
        key: str,
        bucket: Optional[str] = None,
    ) -> None:
        """
        Delete a file from MinIO/S3.

        Args:
            key: Object key to delete.
            bucket: Optional override bucket name.

        Raises:
            RuntimeError: If deletion fails.
        """
        target_bucket = bucket or self.bucket
        try:
            self.s3_client.delete_object(Bucket=target_bucket, Key=key)
        except ClientError as exc:
            raise RuntimeError(f"Failed to delete file from MinIO: {exc}") from exc

    def get_presigned_url(
        self,
        key: str,
        expiration: int = 3600,
        bucket: Optional[str] = None,
    ) -> str:
        """
        Generate a presigned URL for temporary access to a file.

        Args:
            key: Object key.
            expiration: URL validity in seconds (default 1 hour).
            bucket: Optional override bucket name.

        Returns:
            Presigned URL string.

        Raises:
            RuntimeError: If URL generation fails.
        """
        target_bucket = bucket or self.bucket
        try:
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": target_bucket, "Key": key},
                ExpiresIn=expiration,
            )
            return url
        except ClientError as exc:
            raise RuntimeError(f"Failed to generate presigned URL: {exc}") from exc


# Singleton instance
_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """Return a singleton StorageService instance."""
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
