# Purrsona

Community cat tracker for stray and community cat identification, welfare mapping, and TNR coordination.

## Overview

Purrsona lets the public browse a live map of cat-related activity while signed-in users contribute sightings, feeding spots, and TNR records. Cat recognition is assistive — the system suggests up to 3 likely matches for each sighting, and the user confirms or creates a new profile.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, React 18, Tailwind CSS, Leaflet |
| Backend | Python 3.11, FastAPI, Pydantic, asyncpg |
| Database | PostgreSQL 16 + pgvector + PostGIS |
| Image Storage | MinIO (dev) / S3 (prod) |
| Cat Matching | MegaDescriptor (Swin-Tiny) — 768-dim fur pattern embeddings + cosine similarity |
| Auth | JWT via httpOnly cookies, bcrypt password hashing |

## Project Structure

```
purrsona/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI route handlers
│   │   │   ├── auth.py     # Register, login, logout, verify-request
│   │   │   └── admin.py    # Verification request management
│   │   ├── core/           # Config, security, RBAC, middleware
│   │   │   ├── config.py   # Env-var-based settings
│   │   │   ├── security.py # JWT encode/decode, password hashing
│   │   │   ├── rbac.py     # Role-based access control
│   │   │   ├── rate_limit.py
│   │   │   └── error_handlers.py
│   │   ├── db/             # Connection pool (asyncpg)
│   │   ├── models/         # Dataclasses (User, TokenClaims)
│   │   ├── services/       # Business logic
│   │   │   └── auth_service.py
│   │   └── main.py         # FastAPI app entrypoint
│   ├── migrations/
│   │   ├── init-extensions.sql
│   │   ├── 001_initial.sql # Full schema (8 tables, enums, indexes)
│   │   └── seed.sql        # Dev test data
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js app router pages
│   │   ├── components/     # (ready for implementation)
│   │   ├── hooks/          # (ready for implementation)
│   │   ├── lib/            # (ready for implementation)
│   │   └── styles/
│   │       ├── tokens.ts   # Design system tokens (colors, typography, spacing)
│   │       └── globals.css
│   ├── Dockerfile
│   ├── tailwind.config.ts
│   └── package.json
├── docs/
│   └── superpowers/specs/  # Functional spec and design docs
├── .kiro/specs/            # Requirements, design, tasks
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
| `JWT_SECRET` | dev-secret-key | JWT signing secret (change in production) |
| `BOOTSTRAP_ADMIN_EMAIL` | admin@purrsona.local | Auto-promote this user to verified on startup |
| `SIMILARITY_THRESHOLD` | 0.65 | Min cosine similarity for cat matching |
| `RATE_LIMIT_PER_MINUTE` | 60 | Per-IP rate limit on mutation endpoints |

## Access Tiers

| Role | Capabilities |
|------|-------------|
| **Public** | Browse map, view cat profiles, view sightings |
| **Signed-in** | + Submit sightings, create feeding spots, create TNR records, report content |
| **Verified** | + Update TNR status on cat profiles, approve verification requests |

## Implementation Progress

### Completed

- [x] Project scaffolding and infrastructure
- [x] Backend: FastAPI project structure, config, middleware
- [x] Frontend: Next.js + TypeScript + Tailwind + design tokens
- [x] Docker Compose (frontend, backend, db, MinIO)
- [x] Database schema (8 tables, enums, indexes)
- [x] Seed data
- [x] Authentication (register, login, JWT via httpOnly cookie)
- [x] RBAC (role hierarchy, require_role dependency)
- [x] Verification workflow (submit, list, approve/reject)
- [x] Bootstrap admin mechanism

### Planned (see `.kiro/specs/purrsona-v1-implementation/tasks.md`)

- [ ] Image handling and coordinate blurring
- [ ] Two-stage matching pipeline (metadata filter + MegaDescriptor embeddings)
- [ ] Sighting submission flow with draft expiration
- [ ] Cat profile service (CRUD, TNR status, editing)
- [ ] Map service with PostGIS spatial queries
- [ ] Feeding spots, TNR records, content reports endpoints
- [ ] Frontend: design system components
- [ ] Frontend: auth pages, map, cat profiles
- [ ] Frontend: sighting submission wizard
- [ ] Frontend: cat editing, feeding spots, TNR, reports
- [ ] Integration testing and Docker validation

## Branching Strategy

One feature per branch, one PR per feature:

| Branch | Feature | Status |
|--------|---------|--------|
| `feature/project-scaffolding` | Backend + frontend + Docker + DB schema | PR ready |
| `feature/auth-and-rbac` | Authentication, RBAC, verification workflow | PR ready |
| `feature/image-and-coordinates` | Image upload/validation, coordinate blurring | Not started |
| `feature/matching-pipeline` | Metadata filter + MegaDescriptor embeddings | Not started |
| `feature/sighting-submission` | Sighting lifecycle, draft expiration, cat profile creation | Not started |
| `feature/map-and-cat-endpoints` | Map markers, cat profile CRUD | Not started |
| `feature/feeding-tnr-reports` | Feeding spots, TNR records, content reports | Not started |
| `feature/frontend-design-system` | Design tokens, base components | Not started |
| `feature/frontend-auth-pages` | Login, register pages | Not started |
| `feature/frontend-map-and-cats` | Live map, cat listing, cat profile detail | Not started |
| `feature/frontend-sighting-wizard` | Multi-step sighting submission | Not started |
| `feature/frontend-cat-editing` | Cat profile edit form | Not started |
| `feature/frontend-feeding-tnr-reports` | Feeding spot, TNR, report forms | Not started |
| `feature/frontend-error-handling` | Error boundary, offline states | Not started |
| `feature/integration-testing` | Integration + E2E tests | Not started |

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | No | Register new user |
| POST | `/api/v1/auth/login` | No | Login |
| POST | `/api/v1/auth/logout` | No | Clear cookie |
| POST | `/api/v1/auth/verify-request` | Yes | Submit verification request |

### Admin (Verified role)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/verification-requests` | Verified | List requests |
| PATCH | `/api/v1/admin/verification-requests/{id}` | Verified | Approve/reject |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |

## License

See [LICENSE](LICENSE).
