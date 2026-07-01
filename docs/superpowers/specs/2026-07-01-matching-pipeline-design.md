# Matching Pipeline Design

Date: 2026-07-01
Status: Approved for implementation

## Summary

The matching pipeline provides cat identity matching as a standalone service. Given an image, it extracts a 768-dim fur pattern embedding using MegaDescriptor (Swin-Tiny), then searches `cat_profiles` via a two-stage query: metadata pre-filter (coat color, pattern type) followed by pgvector cosine similarity ranking. Returns up to 3 candidates above a configurable threshold.

## Scope

**In scope:**
- Model loading (eager, at FastAPI startup)
- Embedding extraction service
- Two-stage similarity search (metadata filter + pgvector)
- Standalone API endpoint: `POST /api/v1/matching/match`
- Config additions (threshold, device, max candidates)
- Docker changes (torch, timm, hf-hub deps; model pre-download)

**Out of scope:**
- Sighting draft creation/management → `feature/sighting-submission`
- Cat profile creation from "none of these" → `feature/sighting-submission`
- Embedding storage on cat profiles (already in schema, populated by other features)
- Frontend UI for match results

## Architecture

### Model Loading

- Model: `hf-hub:BVRA/MegaDescriptor-T-224` (Swin-Tiny, 768-dim output)
- Loaded eagerly in FastAPI `lifespan` event (not lazily on first request)
- Model weights pre-downloaded at Docker build time
- Device: configurable via `EMBEDDING_DEVICE` env var, default `cpu`

### Embedding Extraction

File: `backend/app/services/embedding_service.py`

Class `EmbeddingService`:
- `extract_embedding(image_bytes: bytes) -> list[float]`
  - Decode image bytes to PIL Image
  - Apply model's standard preprocessing (resize 224x224, normalize)
  - Run inference in `asyncio.to_thread()` to avoid blocking event loop
  - Return 768-dim float vector

### Similarity Search

Method `find_matches(embedding, metadata, limit) -> list[MatchCandidate]`:

Two-stage query:

```sql
SELECT id, name, coat_color, pattern_type, notable_markings,
       1 - (embedding <=> $1::vector) AS similarity
FROM cat_profiles
WHERE embedding IS NOT NULL
  AND ($2::coat_color_enum IS NULL OR coat_color = $2)
  AND ($3::pattern_type_enum IS NULL OR pattern_type = $3)
ORDER BY embedding <=> $1::vector
LIMIT $4
```

- Metadata filters are optional (NULL param = skip that filter)
- Results filtered in Python by `SIMILARITY_THRESHOLD` (default 0.65)
- Returns max 3 candidates per spec cap
- Name falls back to "Unknown" when NULL (display-layer only, per decisions doc)

### API Endpoint

`POST /api/v1/matching/match`

- Auth: `signed_in` role required
- Request: multipart form
  - `image` (file, required) — validated by existing `image_service.validate_image()`
  - `coat_color` (string, optional) — enum value for pre-filter
  - `pattern_type` (string, optional) — enum value for pre-filter
- Response:
  ```json
  {
    "candidates": [
      {
        "cat_id": "uuid",
        "name": "Whiskers",
        "similarity": 0.82,
        "coat_color": "orange",
        "pattern_type": "tabby",
        "notable_markings": "white chest"
      }
    ]
  }
  ```
- Empty `candidates` array if no matches above threshold

## Config Additions

| Var | Default | Purpose |
|-----|---------|---------|
| `SIMILARITY_THRESHOLD` | `0.65` | Min cosine similarity to include in results |
| `EMBEDDING_DEVICE` | `cpu` | torch device for inference |
| `MAX_MATCH_CANDIDATES` | `3` | Max candidates returned (spec cap) |

## Docker Changes

- Add to `pyproject.toml`: `torch`, `timm`, `huggingface_hub`
- Add `RUN` step in Dockerfile to pre-download model weights at build time
- No GPU passthrough required (CPU inference is sufficient for Swin-Tiny)

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/app/services/embedding_service.py` | Create — model loading + embedding extraction + similarity search |
| `backend/app/api/matching.py` | Create — API router with `/match` endpoint |
| `backend/app/main.py` | Modify — register matching router, add model loading to lifespan |
| `backend/app/core/config.py` | Modify — add `SIMILARITY_THRESHOLD`, `EMBEDDING_DEVICE`, `MAX_MATCH_CANDIDATES` |
| `backend/pyproject.toml` | Modify — add ML dependencies |
| `backend/Dockerfile` | Modify — add model pre-download step |

## Properties (from spec/decisions doc)

- Property 10: Matching is advisory only, never automatic (enforced by sighting-submission feature, not this service)
- Property 14: CV output is advisory only, not a moderation authority
- Per decisions doc #9: Use `hf-hub:BVRA/MegaDescriptor-T-224` (Swin-Tiny), not ViT-B/14
- Per decisions doc #10: Load model eagerly at startup, not lazily
