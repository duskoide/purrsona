import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.core.error_handlers import error_response
from app.core.rbac import require_role
from app.db.pool import get_db
from app.models.user import User, UserRole
from app.services.embedding_service import embedding_service
from app.services.image_service import validate_image

VALID_COAT_COLORS = {
    "black", "white", "orange", "gray", "brown",
    "cream", "mixed_black_white", "mixed_orange_white", "other",
}
VALID_PATTERN_TYPES = {
    "tabby", "calico", "tuxedo", "solid", "bicolor",
    "tortoiseshell", "pointed", "other",
}

router = APIRouter(prefix="/api/v1/matching", tags=["matching"])


@router.post("/match")
async def match_endpoint(
    image: UploadFile,
    coat_color: str | None = None,
    pattern_type: str | None = None,
    user: User = Depends(require_role(UserRole.SIGNED_IN)),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, object]:
    """Find cat matches for an uploaded image.

    Accepts multipart form with image file and optional metadata filters.
    Returns up to 3 candidates ranked by similarity.
    """
    param_errors = []
    if coat_color is not None and coat_color not in VALID_COAT_COLORS:
        valid = ", ".join(sorted(VALID_COAT_COLORS))
        param_errors.append(
            {"field": "coat_color", "message": f"Invalid value. Must be one of: {valid}"}
        )
    if pattern_type is not None and pattern_type not in VALID_PATTERN_TYPES:
        valid = ", ".join(sorted(VALID_PATTERN_TYPES))
        param_errors.append(
            {"field": "pattern_type", "message": f"Invalid value. Must be one of: {valid}"}
        )
    if param_errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(422, "Invalid filter parameters", details=param_errors),
        )

    contents = await image.read()
    header = contents[:12]

    errors = validate_image(image.content_type, len(contents), header)
    if errors:
        raise HTTPException(
            status_code=422,
            detail=error_response(
                422,
                "Image validation failed",
                details=[{"field": "image", "message": e} for e in errors],
            ),
        )

    embedding = await embedding_service.extract_embedding(contents)
    candidates = await embedding_service.find_matches(
        db, embedding, coat_color=coat_color, pattern_type=pattern_type
    )

    return {"candidates": candidates}
