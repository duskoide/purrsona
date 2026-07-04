# Purrsona

Community cat tracker for stray and community cat identification, welfare mapping, and TNR coordination.

## Overview

Purrsona lets the public browse a live map of cat-related activity while signed-in users contribute sightings, feeding spots, and TNR records. Cat recognition is assistive — the system suggests up to 3 likely matches for each sighting, and the user confirms or creates a new profile.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, React 18, Tailwind CSS, Leaflet |
| Backend | Python 3.11, FastAPI, Pydantic v2, asyncpg |
| Database | PostgreSQL 16 + pgvector + PostGIS |
| Image Storage | MinIO (dev) / S3 (prod) |
| Cat Matching | MegaDescriptor Swin-Tiny — 768-dim fur pattern embeddings + cosine similarity |
| Auth | JWT via httpOnly cookies, bcrypt, 3-tier RBAC |
| Design System | Sega arcade theme (VT323, 0px corners, hard shadows, pill buttons) |
| Testing | pytest, pytest-asyncio, httpx |

## Project Structure

```
purrsona/
├── backend/
│   ├── app/
│   │   ├── api/                    # FastAPI route handlers
│   │   │   ├── auth.py             # Register, login, logout, me, verify-request
│   │   │   ├── admin.py            # Verification request management
│   │   │   ├── cats.py             # Cat list, detail, update
│   │   │   ├── matching.py         # Image-based cat matching
│   │   │   ├── sightings.py        # Sighting initiate + confirm
│   │   │   ├── map.py              # Map markers (bbox query)
│   │   │   └── feeding.py          # Feeding spots, TNR records, reports
│   │   ├── core/                   # Config, security, RBAC, middleware
│   │   │   ├── config.py           # Env-var-based settings
│   │   │   ├── security.py         # JWT encode/decode, password hashing
│   │   │   ├── rbac.py             # Role-based access control
│   │   │   ├── rate_limit.py       # Per-IP rate limiter
│   │   │   └── error_handlers.py   # Unified error responses
│   │   ├── db/                     # Connection pool (asyncpg)
│   │   ├── models/                 # Dataclasses (User, UserRole)
│   │   ├── services/               # Business logic
│   │   │   ├── auth_service.py     # Register, login, verification
│   │   │   ├── cat_service.py      # Cat profile updates
│   │   │   ├── sighting_service.py # Sighting initiate + confirm
│   │   │   ├── matching_service.py # Embedding search
│   │   │   ├── map_service.py      # Map markers, cat list, cat profile
│   │   │   ├── feeding_service.py  # Feeding spots, TNR, reports
│   │   │   ├── image_service.py    # S3 upload + validation
│   │   │   ├── embedding_service.py# MegaDescriptor ML model
│   │   │   └── coordinate_service.py# Privacy-preserving blurring
│   │   └── main.py                 # FastAPI app entrypoint
│   ├── migrations/
│   │   ├── 001_initial.sql         # Full schema (8 tables, enums, indexes)
│   │   └── seed.sql                # Dev test data
│   ├── tests/                      # Integration tests (55 tests)
│   │   ├── conftest.py             # Shared fixtures
│   │   ├── test_health.py
│   │   ├── test_auth.py
│   │   ├── test_cats.py
│   │   ├── test_map.py
│   │   ├── test_feeding.py
│   │   ├── test_admin.py
│   │   ├── test_sightings.py
│   │   └── test_matching.py
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js app router pages
│   │   │   ├── auth/login/         # Login form
│   │   │   ├── auth/register/      # Registration form
│   │   │   ├── dashboard/          # Player profile + RBAC testing
│   │   │   ├── map/                # Leaflet map with markers
│   │   │   ├── cats/               # Cat list + profile + edit
│   │   │   ├── sightings/new/      # 4-step sighting wizard
│   │   │   └── feeding-spots/new/  # Feeding spot creation
│   │   ├── components/             # 20+ components (Button, Card, Modal, etc.)
│   │   ├── contexts/               # AuthContext
│   │   ├── hooks/                  # useAuth
│   │   └── styles/
│   │       └── tokens.ts           # Design system tokens
│   ├── Dockerfile
│   ├── tailwind.config.ts
│   └── package.json
├── docs/
│   └── superpowers/                # Specs and implementation plans
├── STATUS.md                       # Feature tracking
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Docker + Docker Compose
- Git

### Quick Start

```bash
git clone https://github.com/duskoide/purrsona.git
cd purrsona
docker compose up --build
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs
- MinIO Console: http://localhost:9001
- PostgreSQL: localhost:5432

### Seed Data

The database auto-seeds with:
- **Users:** admin (verified), caretaker (verified), user (signed_in), volunteer (signed_in)
- **Cats:** Whiskers, Shadow, Luna, Marmalade (with sample sightings and TNR records)
- **Password for all users:** `password123`

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql://purrsona:purrsona@localhost:5432/purrsona | PostgreSQL connection string |
| `S3_ENDPOINT` | http://localhost:9000 | S3-compatible storage endpoint |
| `JWT_SECRET` | change-me-in-production | JWT signing secret |
| `BOOTSTRAP_ADMIN_EMAIL` | admin@purrsona.local | Auto-promote this user to verified on startup |
| `SIMILARITY_THRESHOLD` | 0.65 | Min cosine similarity for cat matching |
| `RATE_LIMIT_PER_MINUTE` | 60 | Per-IP rate limit on mutation endpoints |

### Running Tests

```bash
cd backend
pytest tests/ -v
```

55 integration tests covering all API endpoints with happy paths and error cases.

## Access Tiers

| Role | Capabilities |
|------|-------------|
| **Public** | Browse map, view cat profiles, view sightings |
| **Signed-in** | + Submit sightings, create feeding spots, create TNR records, report content |
| **Verified** | + Update TNR status on cat profiles, approve verification requests |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/api/v1/auth/register` | No | Register new user |
| POST | `/api/v1/auth/login` | No | Login |
| POST | `/api/v1/auth/logout` | No | Logout |
| GET | `/api/v1/auth/me` | Yes | Current user |
| POST | `/api/v1/auth/verify-request` | Yes | Submit verification request |
| GET | `/api/v1/admin/verification-requests` | Verified | List requests |
| PATCH | `/api/v1/admin/verification-requests/{id}` | Verified | Approve/reject |
| GET | `/api/v1/cats` | No | Paginated cat list with filters |
| GET | `/api/v1/cats/{id}` | No | Full cat profile with history |
| PATCH | `/api/v1/cats/{id}` | signed_in | Update cat metadata |
| POST | `/api/v1/matching/match` | signed_in | Cat fur pattern matching |
| POST | `/api/v1/sightings/initiate` | signed_in | Create sighting draft + find matches |
| POST | `/api/v1/sightings/confirm` | signed_in | Confirm draft into sighting |
| GET | `/api/v1/map` | No | Map markers (bbox query) |
| POST | `/api/v1/feeding-spots` | signed_in | Create feeding spot |
| POST | `/api/v1/tnr-records` | signed_in | Create TNR record |
| POST | `/api/v1/reports` | signed_in | Report content |

## Frontend Pages

| Route | Purpose |
|-------|---------|
| `/` | Redirect (dashboard or login) |
| `/auth/login` | Login form |
| `/auth/register` | Registration form |
| `/dashboard` | Player profile + RBAC testing |
| `/map` | Leaflet map with sighting/feeding spot markers |
| `/cats` | Paginated cat list with coat/pattern/TNR filters |
| `/cats/[id]` | Cat profile with history, TNR records, report buttons |
| `/cats/[id]/edit` | Cat metadata edit form |
| `/sightings/new` | 4-step sighting wizard (photo, location, description, confirm) |
| `/feeding-spots/new` | Feeding spot creation with location picker |

## License

See [LICENSE](LICENSE).
