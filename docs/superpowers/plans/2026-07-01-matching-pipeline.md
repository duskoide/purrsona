# Matching Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone cat matching service that extracts fur pattern embeddings from images and searches for similar cats via pgvector.

**Architecture:** MegaDescriptor Swin-Tiny loaded eagerly at startup, runs inference in thread pool. Two-stage pgvector query: optional metadata pre-filter, then cosine similarity ranking. Returns up to 3 candidates above configurable threshold.

**Tech Stack:** Python 3.11, FastAPI, asyncpg, torch, timm, huggingface_hub, pgvector

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/core/config.py` | Modify | Add `SIMILARITY_THRESHOLD`, `EMBEDDING_DEVICE`, `MAX_MATCH_CANDIDATES` |
| `backend/app/services/embedding_service.py` | Create | Model loading, embedding extraction, similarity search |
| `backend/app/api/matching.py` | Create | API router with `POST /api/v1/matching/match` |
| `backend/app/main.py` | Modify | Register matching router, add model loading to lifespan |
| `backend/pyproject.toml` | Modify | Add `torch`, `timm`, `huggingface_hub` deps |
| `backend/Dockerfile` | Modify | Add model pre-download step |

---

### Task 1: Config and Dependencies

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add ML config vars to Settings**

```python
# In backend/app/core/config.py, add after BLUR_RADIUS_METERS:

    # Cat matching
    SIMILARITY_THRESHOLD: float = 0.65
    EMBEDDING_DEVICE: str = "cpu"
    MAX_MATCH_CANDIDATES: int = 3
```

- [ ] **Step 2: Add ML dependencies to pyproject.toml**

```toml
# In backend/pyproject.toml, add to dependencies list:
    "torch>=2.2,<3",
    "timm>=0.9,<1",
    "huggingface_hub>=0.20,<1",
```

- [ ] **Step 3: Install deps and verify**

Run: `cd backend && pip install -e ".[dev]"`
Expected: installs without errors, `python -c "import torch; import timm; print('ok')"` prints "ok"

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/config.py backend/pyproject.toml
git commit -m "feat: add ML config and dependencies for matching pipeline"
```

---

### Task 2: Embedding Service

**Files:**
- Create: `backend/app/services/embedding_service.py`

- [ ] **Step 1: Create EmbeddingService class with model loading**

```python
# backend/app/services/embedding_service.py

from __future__ import annotations

import asyncio
import io
from typing import TYPE_CHECKING

import torch
from huggingface_hub import hf_hub_download
from PIL import Image
from timm import create_model
from timm.data import resolve_data_config
from timm.data.transforms_factory import create_transform

from app.core.config import settings

if TYPE_CHECKING:
    import asyncpg

MODEL_ID = "hf-hub:BVRA/MegaDescriptor-T-224"
EMBEDDING_DIM = 768


class EmbeddingService:
    """Cat fur pattern embedding extraction and similarity search."""

    def __init__(self) -> None:
        self._model = None
        self._transform = None

    def load_model(self) -> None:
        """Load MegaDescriptor model. Call at startup."""
        self._model = create_model(
            MODEL_ID,
            pretrained=True,
            num_classes=0,  # remove classification head
        )
        self._model.eval()
        self._model.to(settings.EMBEDDING_DEVICE)

        data_config = resolve_data_config(self._model.pretrained_cfg)
        self._transform = create_transform(**data_config, is_training=False)

    def _extract_sync(self, image_bytes: bytes) -> list[float]:
        """Synchronous embedding extraction. Runs in thread pool."""
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self._transform(image).unsqueeze(0).to(settings.EMBEDDING_DEVICE)

        with torch.no_grad():
            output = self._model(tensor)

        embedding = output.squeeze(0).cpu().tolist()
        assert len(embedding) == EMBEDDING_DIM
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
    ) -> list[dict]:
        """Two-stage search: metadata filter → pgvector cosine similarity.

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


# Singleton — loaded once at startup
embedding_service = EmbeddingService()
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.services.embedding_service import embedding_service; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/embedding_service.py
git commit -m "feat: add embedding service with model loading and similarity search"
```

---

### Task 3: Matching API Endpoint

**Files:**
- Create: `backend/app/api/matching.py`

- [ ] **Step 1: Create matching router**

```python
# backend/app/api/matching.py

import asyncpg
from fastapi import APIRouter, Depends, UploadFile

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
) -> dict:
    """Find cat matches for an uploaded image.

    Accepts multipart form with image file and optional metadata filters.
    Returns up to 3 candidates ranked by similarity.
    """
    contents = await image.read()
    header = contents[:12]

    errors = validate_image(image.content_type, len(contents), header)
    if errors:
        from fastapi import HTTPException

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
```

- [ ] **Step 2: Verify the module imports cleanly**

Run: `cd backend && python -c "from app.api.matching import router; print('ok')"`
Expected: prints "ok"

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/matching.py
git commit -m "feat: add matching API endpoint"
```

---

### Task 4: Wire Up Main App and Docker

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Register matching router and load model at startup**

Edit `backend/app/main.py`:

```python
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.matching import router as matching_router
from app.core.config import settings
from app.core.error_handlers import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.rate_limit import RateLimitMiddleware
from app.db.pool import close_db_pool, init_db_pool
from app.services.auth_service import bootstrap_admin
from app.services.embedding_service import embedding_service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    pool = await init_db_pool()
    await bootstrap_admin(pool, settings.BOOTSTRAP_ADMIN_EMAIL)
    embedding_service.load_model()
    yield
    await close_db_pool()


app = FastAPI(
    title="Purrsona API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(RateLimitMiddleware)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(matching_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 2: Add model pre-download to Dockerfile**

Edit `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY . .
RUN pip install --no-cache-dir .

# Pre-download MegaDescriptor model weights at build time
RUN python -c "from timm import create_model; create_model('hf-hub:BVRA/MegaDescriptor-T-224', pretrained=True)"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Verify app starts (without Docker, quick syntax check)**

Run: `cd backend && python -c "from app.main import app; print('ok')"`
Expected: prints "ok"

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py backend/Dockerfile
git commit -m "feat: wire up matching router and eager model loading at startup"
```

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Start the backend locally**

Run: `cd backend && uvicorn app.main:app --reload`
Expected: server starts, logs show model loading

- [ ] **Step 2: Verify health endpoint**

Run: `curl http://localhost:8000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 3: Verify match endpoint requires auth**

Run: `curl -X POST http://localhost:8000/api/v1/matching/match`
Expected: 401 with authentication required error

- [ ] **Step 4: Run linter**

Run: `cd backend && ruff check .`
Expected: no errors

- [ ] **Step 5: Run type checker**

Run: `cd backend && mypy app/`
Expected: no errors (or only pre-existing errors)

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: linter/type-checker fixes for matching pipeline"
```
