import asyncpg  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.core.error_handlers import error_response
from app.core.rbac import require_role
from app.db.pool import get_db
from app.models.user import User, UserRole
from app.services.embedding_service import embedding_service
from app.services.image_service import validate_image

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
