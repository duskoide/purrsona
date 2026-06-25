# Implementation Plan: Purrsona v1

## Overview

Full-stack implementation of the Purrsona community cat tracker. The backend is Python/FastAPI with PostgreSQL+pgvector, using a two-stage matching pipeline (SQL metadata filter → MegaDescriptor cosine similarity). The frontend is Next.js/TypeScript with an interactive map. Implementation proceeds from infrastructure and database setup through core services, API endpoints, frontend pages, and integration wiring.

## Tasks

- [ ] 1. Project scaffolding and infrastructure
  - [ ] 1.1 Create backend project structure with FastAPI, Pydantic, and dependency configuration
    - Initialize `backend/` with `pyproject.toml` (FastAPI, uvicorn, asyncpg, sqlalchemy, pydantic, python-jose, boto3, Pillow, timm, torch, torchvision, hypothesis)
    - Create package layout: `backend/app/{api,services,models,core,db}/`
    - Create `backend/app/main.py` with FastAPI app, versioned router prefix `/api/v1`, CORS config
    - Create `backend/app/core/config.py` reading all settings from environment variables (DATABASE_URL, S3_*, JWT_SECRET, MEGADESCRIPTOR_MODEL, RATE_LIMIT_PER_MINUTE, SIMILARITY_THRESHOLD, MAX_IMAGE_SIZE_MB, BLUR_RADIUS_METERS)
    - _Requirements: 13.1, 16.4_

  - [ ] 1.2 Create frontend project structure with Next.js and TypeScript
    - Initialize `frontend/` with Next.js 14+, TypeScript, React 18, Tailwind CSS
    - Install dependencies: TanStack Query, React Hook Form, Leaflet/MapLibre GL, next-auth or custom JWT hooks
    - Create directory layout: `frontend/src/{components,pages,hooks,lib,styles}/`
    - Create design system token files (colors, typography, spacing, breakpoints, shadows, borderRadius)
    - _Requirements: 14.1, 15.1, 15.2, 15.3, 15.4, 15.5, 15.8_

  - [ ] 1.3 Create Docker Compose configuration for local development
    - Create `docker-compose.yml` with services: frontend, backend, db (pgvector/pgvector:pg16), minio
    - Configure environment variables, volume mounts, port mappings, and service dependencies
    - Create `backend/Dockerfile` and `frontend/Dockerfile` for development
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ] 1.4 Create database schema migration and seed data
    - Create `backend/migrations/001_initial.sql` with full schema (users, cat_profiles, sightings, feeding_spots, tnr_records, content_reports) including enum types, pgvector extension, postgis extension
    - Create indexes: ivfflat on cat_profiles.embedding, B-tree on coat_color, pattern_type, ear_tip_status, body_size, GiST on blurred_location columns
    - Create `backend/migrations/seed.sql` with test data (users of each role, sample cat_profiles with metadata, sightings, feeding_spots)
    - _Requirements: 12.1, 12.3, 12.4, 12.5_

- [ ] 2. Core backend services — Authentication and RBAC
  - [ ] 2.1 Implement authentication service (register, login, JWT token management)
    - Create `backend/app/services/auth_service.py` implementing IAuthService
    - JWT generation with claims: sub, email, role, iat, exp (24h default)
    - Password hashing with bcrypt, email uniqueness validation
    - Create `backend/app/core/security.py` with token verification, `get_current_user` dependency
    - _Requirements: 3.1, 3.5_

  - [ ] 2.2 Implement role-based access control middleware
    - Create `backend/app/core/rbac.py` with `require_role` dependency and role hierarchy (public < signed_in < verified)
    - Return 401 for unauthenticated, 403 for insufficient role
    - Create verification request endpoint (elevate signed_in → verified)
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 2.3 Write property tests for authentication and RBAC
    - **Property 4: Role-based access enforcement** — For any mutation endpoint × user with insufficient role → denial response
    - **Property 5: Authentication token contains role** — For any authenticated user, JWT contains matching role claim
    - **Validates: Requirements 3.2, 3.3, 3.5**

  - [ ] 2.4 Implement auth API routes (register, login, verify-request)
    - Create `backend/app/api/auth.py` with POST /auth/register, /auth/login, /auth/verify-request
    - Wire to auth service, return consistent error responses
    - _Requirements: 3.1, 3.2, 13.2_

- [ ] 3. Core backend services — Image handling and coordinate blurring
  - [ ] 3.1 Implement image validation and S3 upload service
    - Create `backend/app/services/image_service.py` implementing IImageService
    - Validate content type (JPEG, PNG, WebP) by magic bytes and file size (≤10MB)
    - Upload to S3-compatible storage (MinIO in dev), return public URL
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 3.2 Write property tests for image validation
    - **Property 16: Image upload validation** — Accept iff content_type ∈ {JPEG, PNG, WebP} AND size ≤ 10MB; else 422
    - **Validates: Requirements 11.3, 11.4**

  - [ ] 3.3 Implement coordinate blurring service
    - Create `backend/app/services/coordinate_service.py` implementing ICoordinateBlurService
    - Random offset within 200m radius using uniform area distribution (sqrt for distance)
    - Compute blurred_location at write time, store both exact and blurred
    - _Requirements: 1.3, 1.4, 7.4_

  - [ ]* 3.4 Write property tests for coordinate blurring
    - **Property 1: Coordinate blur stays within 200m radius** — For any valid coordinate, haversine(original, blurred) ≤ 200m AND blurred ≠ original
    - **Validates: Requirements 1.3, 1.4, 7.4**

- [ ] 4. Checkpoint — Core services foundation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Two-stage matching pipeline — Metadata filter and MegaDescriptor embedding
  - [ ] 5.1 Implement metadata filter service (Stage 1)
    - Create `backend/app/services/metadata_filter_service.py` implementing IMetadataFilterService
    - Build SQL WHERE clause from CatMetadata: required coat_color + pattern_type, optional ear_tip_status + body_size
    - Return (where_clause, params) tuple for composing into pgvector similarity query
    - _Requirements: 5.1, 12.5_

  - [ ]* 5.2 Write property tests for metadata filter
    - **Property 23: Metadata filter narrows candidate set correctly** — Only returns profiles matching all provided fields; excludes all that differ on any field
    - **Validates: Requirements 5.1, 12.5**

  - [ ] 5.3 Implement MegaDescriptor embedding service (Stage 2)
    - Create `backend/app/services/embedding_service.py` implementing IEmbeddingService
    - Load MegaDescriptor (hf-hub:BVRA/MegaDescriptor-T-224) via timm, 224×224 input, 768-dim normalized output
    - `generate_embedding(image)` → 768-float list
    - `find_matches(embedding, metadata, metadata_filter, db_session)` → up to 3 MatchCandidates above SIMILARITY_THRESHOLD (0.65 default)
    - Combine metadata WHERE clause with pgvector cosine similarity ORDER BY, LIMIT 3
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 12.1, 12.2_

  - [ ]* 5.4 Write property tests for match candidates
    - **Property 9: Match candidates bounded and ordered** — Result ≤ 3 candidates, all above threshold, ordered descending by similarity
    - **Validates: Requirements 5.3, 5.4, 5.5**

- [ ] 6. Sighting submission flow
  - [ ] 6.1 Implement sighting service (initiate + confirm lifecycle)
    - Create `backend/app/services/sighting_service.py` implementing ISightingService
    - `initiate_sighting`: validate required fields (photo, location, timestamp, condition_tags, coat_color, pattern_type), upload image, generate embedding, run two-stage matching, store draft
    - `confirm_sighting`: link to selected cat_profile or create new profile (with metadata + embedding), store immutable sighting record
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.6, 5.7, 5.8, 5.9_

  - [ ] 6.2 Implement cat profile service (creation with metadata + embedding)
    - Create `backend/app/services/cat_profile_service.py` implementing ICatProfileService
    - `create_profile`: initialize from sighting draft — store photo, coat_color, pattern_type, notable_markings, ear_tip_status, body_size, embedding vector
    - `get_profile`: return profile with sighting history (reverse chronological)
    - `update_tnr_status`: verified-only role check, validate status domain
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.2, 9.3_

  - [ ]* 6.3 Write property tests for sighting validation and profile creation
    - **Property 6: Sighting field validation** — Missing required fields → 422 with exactly those field names
    - **Property 11: New cat profile initialization completeness** — Photo in photos array, sighting as first history entry
    - **Property 24: New cat profile stores metadata** — Created profile contains all metadata from originating sighting
    - **Validates: Requirements 4.1, 4.6, 6.2, 6.4**

  - [ ] 6.4 Implement sighting API routes (initiate + confirm)
    - Create `backend/app/api/sightings.py` with POST /sightings/initiate (multipart), POST /sightings/confirm
    - Wire to sighting service, require signed_in role, return match candidates or confirmed sighting
    - _Requirements: 4.1, 5.6, 5.7, 5.8, 13.1_

- [ ] 7. Remaining API endpoints
  - [ ] 7.1 Implement map markers endpoint (public, blurred coordinates)
    - Create `backend/app/services/map_service.py` implementing IMapService
    - Create `backend/app/api/map.py` with GET /map/markers — query by bounds + types, return only blurred coordinates
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [ ] 7.2 Implement cat profile endpoints (public listing + detail)
    - Create `backend/app/api/cats.py` with GET /cats, GET /cats/{cat_id}, PATCH /cats/{cat_id}/tnr-status
    - Profile detail includes sighting history (reverse chronological), feeding notes, TNR status
    - TNR status update restricted to verified role
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1, 9.2, 9.3, 9.4_

  - [ ] 7.3 Implement feeding spots and TNR records endpoints
    - Create `backend/app/api/feeding_spots.py` with POST /feeding-spots (auth required, blur coordinates)
    - Create `backend/app/api/tnr_records.py` with POST /tnr-records (auth required, associate with cat_profile)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2_

  - [ ] 7.4 Implement content reports endpoint
    - Create `backend/app/api/reports.py` with POST /reports (auth required)
    - Store reporter_id, content_type, content_id, reason, details
    - _Requirements: 10.2, 10.3, 10.4_

  - [ ] 7.5 Implement rate limiting middleware and consistent error responses
    - Create `backend/app/core/rate_limit.py` — per-user rate limiting on mutation endpoints
    - Create `backend/app/core/error_handlers.py` — consistent JSON error structure (status_code, error_type, message, details)
    - _Requirements: 13.2, 13.3, 13.4_

  - [ ]* 7.6 Write property tests for TNR status, error structure, and rate limiting
    - **Property 12: TNR status value domain** — Accept iff status ∈ {unassessed, needs_tnr, scheduled, in_progress, completed, ear_tipped}
    - **Property 17: Consistent API error structure** — All 4xx/5xx responses contain error.status_code, error.error_type, error.message
    - **Property 19: Rate limiting enforcement** — Exceeding rate limit → 429 until window resets
    - **Validates: Requirements 9.1, 13.2, 13.4**

- [ ] 8. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Frontend — Design system and shared components
  - [ ] 9.1 Implement design system tokens and base component library
    - Create token files (colors with light/dark mode, typography, spacing on 8px grid, borderRadius, shadows, elevation)
    - Implement Button component (primary, secondary, ghost variants; sm/md/lg sizes; interactive states)
    - Implement form components (TextInput, Select, Textarea, FileUpload with validation states)
    - Implement Card, Modal, StatusBadge, NavigationBar components
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [ ]* 9.2 Write property tests for design system tokens
    - **Property 20: Spacing tokens grid alignment** — All spacing values (except 0) are multiples of 4px
    - **Validates: Requirements 15.3**

  - [ ] 9.3 Implement authentication hooks and context
    - Create `useAuth` hook — login, register, logout, user state, JWT in httpOnly cookie
    - Create AuthContext provider, protected route wrapper (redirect to login on 401)
    - _Requirements: 3.1, 3.2, 14.5_

- [ ] 10. Frontend — Map and public pages
  - [ ] 10.1 Implement Live Map page with marker clusters
    - Create SSR-rendered map page using Leaflet/MapLibre GL
    - Fetch markers via GET /map/markers with bounding box, render by type (sighting/feeding_spot/tnr)
    - Marker click shows summary card (cat name, photo thumbnail, timestamp)
    - Custom marker icons per category (paw, bowl, medical cross)
    - Responsive from 320px to 2560px
    - _Requirements: 1.1, 1.2, 1.5, 14.2, 14.3_

  - [ ] 10.2 Implement Cat Profile detail page
    - SSR-rendered page at `/cats/[id]`
    - Display: name, photos, sighting history (reverse chronological), feeding notes, TNR status badge
    - TNR status update UI (visible only to verified users)
    - Report button (visible to signed-in users)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.5, 14.2_

  - [ ] 10.3 Implement Cat listing page
    - SSR-rendered paginated list at `/cats`
    - CatCard components with name, thumbnail, TNR status badge
    - _Requirements: 2.1, 14.2_

- [ ] 11. Frontend — Authenticated flows
  - [ ] 11.1 Implement Sighting Submission wizard (multi-step form)
    - Step 1: Photo upload with preview and validation (JPEG/PNG/WebP, ≤10MB client-side check)
    - Step 2: Location picker (map click or GPS), datetime, condition tags, required metadata (coat_color, pattern_type), optional metadata (notable_markings, ear_tip_status, body_size), notes
    - Step 3: Match selection — display up to 3 candidates with similarity scores + "none of these" option
    - Step 4: Confirmation result (linked profile or newly created profile)
    - Use React Hook Form for state, TanStack Query for API calls
    - _Requirements: 4.1, 4.2, 4.3, 5.6, 5.7, 5.8, 5.9, 14.4_

  - [ ] 11.2 Implement Feeding Spot creation page
    - Map location picker, details form (description, schedule, food_type)
    - POST to /feeding-spots, require auth
    - _Requirements: 7.1, 7.3_

  - [ ] 11.3 Implement TNR Record creation and Report modal
    - TNR Record form (select cat_profile, free-text content)
    - Report modal (content_type, reason selector, optional details) — reusable across content types
    - _Requirements: 8.1, 8.2, 10.2, 10.3_

  - [ ] 11.4 Implement error boundary and offline state handling
    - Global error boundary with retry guidance when backend unreachable
    - 401 → redirect to login, 422 → inline field errors, 429 → cooldown timer
    - _Requirements: 14.5, 13.2_

- [ ] 12. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Integration wiring and end-to-end validation
  - [ ] 13.1 Wire Docker Compose services and validate startup
    - Verify all services start with seeded data within 120 seconds
    - Confirm frontend can reach backend, backend can reach db + minio
    - Validate MegaDescriptor model loads successfully in backend container
    - _Requirements: 16.1, 16.2_

  - [ ]* 13.2 Write integration tests for the two-stage matching pipeline
    - Test metadata filter correctly narrows candidates before embedding search
    - Test end-to-end sighting flow: upload → metadata filter → embedding → match candidates → confirm
    - Test "none of these" creates profile with metadata + embedding stored
    - _Requirements: 5.1, 5.2, 5.3, 6.2, 6.3, 6.4_

  - [ ]* 13.3 Write integration tests for remaining API flows
    - Test public map returns only blurred coordinates
    - Test image upload to S3 and URL retrieval
    - Test role-gated endpoints (TNR status update by verified/non-verified)
    - Test content report storage
    - _Requirements: 1.3, 9.2, 9.3, 10.2, 11.1_

  - [ ]* 13.4 Write end-to-end tests (Playwright)
    - Public visitor browses map without login
    - Signed-in user submits sighting end-to-end (with metadata fields)
    - Match selection and "none of these" flows
    - Verified user updates TNR status
    - Content reporting flow
    - _Requirements: 1.1, 4.1, 5.6, 9.2, 10.2_

- [ ] 14. Final checkpoint — Full system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The MegaDescriptor model (hf-hub:BVRA/MegaDescriptor-T-224) produces 768-dim embeddings via timm library
- Stage 1 (metadata filter) uses SQL WHERE clauses on coat_color, pattern_type, ear_tip_status, body_size
- Stage 2 (embedding search) uses pgvector cosine similarity on the filtered subset
- Backend uses Python (FastAPI), frontend uses TypeScript (Next.js)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1", "3.1", "3.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.4", "9.1"] },
    { "id": 3, "tasks": ["5.1", "5.3", "9.2", "9.3"] },
    { "id": 4, "tasks": ["5.2", "5.4", "6.1", "6.2"] },
    { "id": 5, "tasks": ["6.3", "6.4", "7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 6, "tasks": ["7.6", "10.1", "10.2", "10.3"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3", "11.4"] },
    { "id": 8, "tasks": ["13.1"] },
    { "id": 9, "tasks": ["13.2", "13.3", "13.4"] }
  ]
}
```
