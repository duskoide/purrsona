from __future__ import annotations

import asyncio
import io
from typing import TYPE_CHECKING, Any

import torch
from PIL import Image
from timm import create_model
from timm.data import resolve_data_config  # type: ignore[attr-defined]
from timm.data.transforms_factory import create_transform

from app.core.config import settings

if TYPE_CHECKING:
    import asyncpg

MODEL_ID = "hf-hub:BVRA/MegaDescriptor-T-224"
EMBEDDING_DIM = 768


class EmbeddingService:
    """Cat fur pattern embedding extraction and similarity search."""

    def __init__(self) -> None:
        self._model: torch.nn.Module | None = None
        self._transform: Any = None

    def load_model(self) -> None:
        """Load MegaDescriptor model. Call at startup."""
        model = create_model(
            MODEL_ID,
            pretrained=True,
            num_classes=0,  # remove classification head
        )
        model.eval()
        model.to(settings.EMBEDDING_DEVICE)
        self._model = model

        data_config = resolve_data_config(model.pretrained_cfg)  # type: ignore[no-untyped-call]
        self._transform = create_transform(**data_config, is_training=False)

    def _extract_sync(self, image_bytes: bytes) -> list[float]:
        """Synchronous embedding extraction. Runs in thread pool."""
        # Not `assert` — assertions are stripped when Python runs in
        # optimized mode (PYTHONOPTIMIZE=1 / `python -O`), which is common
        # in production, and this check must always run.
        if self._model is None or self._transform is None:
            raise RuntimeError("Model not loaded — call load_model() first")

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self._transform(image).unsqueeze(0).to(settings.EMBEDDING_DEVICE)

        with torch.no_grad():
            output = self._model(tensor)

        embedding: list[float] = output.squeeze(0).cpu().tolist()
        if len(embedding) != EMBEDDING_DIM:
            raise ValueError(f"Expected {EMBEDDING_DIM}-dim embedding, got {len(embedding)}")
        return embedding

    async def extract_embedding(self, image_bytes: bytes) -> list[float]:
        """Extract 768-dim embedding from image bytes."""
        return await asyncio.to_thread(self._extract_sync, image_bytes)

    async def find_matches(
        self,
        db: asyncpg.Pool,
        embedding: list[float],
        coat_color: str | None = None,
        pattern_type: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """Two-stage search: metadata filter -> pgvector cosine similarity.

        Returns list of dicts with cat_id, name, similarity, coat_color, pattern_type,
        notable_markings. Filtered by SIMILARITY_THRESHOLD.
        """
        if limit is None:
            limit = settings.MAX_MATCH_CANDIDATES

        # ponytail: cast embedding to vector string inline, pgvector handles it
        embedding_str = f"[{','.join(str(x) for x in embedding)}]"

        rows = await db.fetch(
            """
            SELECT
                id,
                name,
                coat_color,
                pattern_type,
                notable_markings,
                1 - (embedding <=> $1::vector) AS similarity
            FROM cat_profiles
            WHERE embedding IS NOT NULL
              AND ($2::text IS NULL OR coat_color::text = $2)
              AND ($3::text IS NULL OR pattern_type::text = $3)
            ORDER BY embedding <=> $1::vector
            LIMIT $4
            """,
            embedding_str,
            coat_color,
            pattern_type,
            limit,
        )

        candidates = []
        for row in rows:
            similarity = float(row["similarity"])
            if similarity < settings.SIMILARITY_THRESHOLD:
                continue
            candidates.append(
                {
                    "cat_id": str(row["id"]),
                    "name": row["name"] or "Unknown",
                    "similarity": round(similarity, 4),
                    "coat_color": row["coat_color"],
                    "pattern_type": row["pattern_type"],
                    "notable_markings": row["notable_markings"],
                }
            )

        return candidates


# Singleton -- loaded once at startup
embedding_service = EmbeddingService()
