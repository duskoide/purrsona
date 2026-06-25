import uuid
from dataclasses import dataclass
from enum import Enum

import boto3
from botocore.config import Config
from fastapi import HTTPException, UploadFile

from app.core.config import settings


class ImageFormat(str, Enum):
    JPEG = "image/jpeg"
    PNG = "image/png"
    WEBP = "image/webp"


MAGIC_BYTES: dict[bytes, ImageFormat] = {
    b"\xff\xd8\xff": ImageFormat.JPEG,
    b"\x89PNG": ImageFormat.PNG,
    b"RIFF": ImageFormat.WEBP,  # WebP starts with RIFF
}

MAX_IMAGE_SIZE_BYTES = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024


@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]


def detect_format(header: bytes) -> ImageFormat | None:
    """Detect image format from magic bytes."""
    for magic, fmt in MAGIC_BYTES.items():
        if header[: len(magic)] == magic:
            return fmt
    return None


def validate_image(content_type: str | None, size_bytes: int, header: bytes) -> ValidationResult:
    """Validate image format (by magic bytes) and size."""
    errors = []

    fmt = detect_format(header)
    if fmt is None:
        errors.append(
            f"Unsupported image format. Supported: JPEG, PNG, WebP. "
            f"Content-Type was '{content_type}' but magic bytes did not match."
        )

    if size_bytes > MAX_IMAGE_SIZE_BYTES:
        errors.append(
            f"File size {size_bytes} bytes exceeds maximum of {settings.MAX_IMAGE_SIZE_MB} MB"
        )

    return ValidationResult(valid=len(errors) == 0, errors=errors)


async def upload_image(file: UploadFile) -> str:
    """Validate and upload an image to S3-compatible storage.

    Returns the public URL of the uploaded image.
    """
    contents = await file.read()
    size_bytes = len(contents)

    header = contents[:8]
    result = validate_image(file.content_type, size_bytes, header)

    if not result.valid:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "status_code": 422,
                    "error_type": "validation_error",
                    "message": "Image validation failed",
                    "details": [{"field": "photo", "message": e} for e in result.errors],
                }
            },
        )

    fmt = detect_format(header)
    ext_map = {
        ImageFormat.JPEG: ".jpg",
        ImageFormat.PNG: ".png",
        ImageFormat.WEBP: ".webp",
    }
    ext = ext_map[fmt]
    key = f"photos/{uuid.uuid4().hex}{ext}"

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )

    content_type_map = {
        ImageFormat.JPEG: "image/jpeg",
        ImageFormat.PNG: "image/png",
        ImageFormat.WEBP: "image/webp",
    }

    s3.put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=contents,
        ContentType=content_type_map[fmt],
    )

    url = f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}/{key}"
    return url
