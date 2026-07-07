import uuid
from enum import StrEnum

import boto3
from botocore.config import Config
from fastapi import HTTPException, UploadFile

from app.core.config import settings
from app.core.error_handlers import error_response


class ImageFormat(StrEnum):
    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"


MAGIC_BYTES: dict[bytes, ImageFormat] = {
    b"\xff\xd8\xff": ImageFormat.JPEG,
    b"\x89PNG": ImageFormat.PNG,
}

MAX_IMAGE_SIZE_BYTES = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024

EXT_MAP = {
    ImageFormat.JPEG: ".jpg",
    ImageFormat.PNG: ".png",
    ImageFormat.WEBP: ".webp",
}

_s3_client = None


def _get_s3():
    global _s3_client
    if _s3_client is None:
        client_kwargs: dict = {
            "config": Config(signature_version="s3v4"),
            "region_name": settings.S3_REGION,
        }
        # Local dev (MinIO) needs a custom endpoint and static credentials.
        # Real AWS S3 needs neither: boto3 resolves the endpoint from the
        # region, and credentials come from the ECS task's IAM role.
        if settings.S3_ENDPOINT:
            client_kwargs["endpoint_url"] = settings.S3_ENDPOINT
        if settings.S3_ACCESS_KEY and settings.S3_SECRET_KEY:
            client_kwargs["aws_access_key_id"] = settings.S3_ACCESS_KEY
            client_kwargs["aws_secret_access_key"] = settings.S3_SECRET_KEY

        _s3_client = boto3.client("s3", **client_kwargs)
    return _s3_client


def detect_format(header: bytes) -> ImageFormat | None:
    """Detect image format from magic bytes."""
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return ImageFormat.WEBP
    for magic, fmt in MAGIC_BYTES.items():
        if header[: len(magic)] == magic:
            return fmt
    return None


def validate_image(content_type: str | None, size_bytes: int, header: bytes) -> list[str]:
    """Validate image format (by magic bytes) and size. Returns list of errors."""
    errors = []

    if detect_format(header) is None:
        errors.append(
            f"Unsupported image format. Supported: JPEG, PNG, WebP. "
            f"Content-Type was '{content_type}' but magic bytes did not match."
        )

    if size_bytes > MAX_IMAGE_SIZE_BYTES:
        errors.append(
            f"File size {size_bytes} bytes exceeds maximum of {settings.MAX_IMAGE_SIZE_MB} MB"
        )

    return errors


async def upload_image(file: UploadFile) -> str:
    """Validate and upload an image to S3-compatible storage.

    Returns the public URL of the uploaded image.
    """
    contents = await file.read()
    size_bytes = len(contents)

    header = contents[:12]
    errors = validate_image(file.content_type, size_bytes, header)

    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422, "Image validation failed",
                details=[{"field": "photo", "message": e} for e in errors],
            ),
        )

    fmt = detect_format(header)
    key = f"photos/{uuid.uuid4().hex}{EXT_MAP[fmt]}"

    s3 = _get_s3()
    s3.put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=contents,
        ContentType=fmt.value,
    )

    return f"{settings.s3_public_base_url}/{key}"
