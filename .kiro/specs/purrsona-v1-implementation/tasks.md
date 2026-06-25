# Implementation Plan: Purrsona v1

## Overview

Full-stack implementation of the Purrsona community cat tracker. The backend is Python/FastAPI with PostgreSQL+pgvector+PostGIS, using a two-stage matching pipeline (SQL metadata filter with progressive relaxation → MegaDescriptor cosine similarity). The frontend is Next.js/TypeScript with an interactive map, login/register pages, and sighting submission wizard. Implementation proceeds from infrastructure and database setup through core services, API endpoints, frontend pages, and integration wiring.

## Tasks

- [ ] 1. Project scaffolding and infrastructure
  - [ ] 1.1 Create backend project structure with FastAPI, Pydantic, and dependency configuration
    - Initialize `backend/` with `pyproject.toml` (FastAPI, uvicorn, asyncpg, sqlalchemy, pydantic, python-jose, boto3, Pillow, timm, torch, torchvision, hypothesis, geoalchemy2)
    - Create package layout: `backend/app/{api,services,models,core,db}/`
    - Create `backend/app/main.py` with FastAPI app, versioned router prefix `/api/v1`, CORS config
    - Create `backend/app/core/config.py` reading all settings from environment variables (DATABASE_URL, S3_*, JWT_SECRET, MEGADESCRIPTOR_MODEL, RATE_LIMIT_PER_MINUTE, SIMILARITY_THRESHOLD, MAX_IMAGE_SIZE_MB, BLUR_RADIUS_METERS, DRAFT_TTL_MINUTES)
    - _Requirements: 13.1, 16.4_

  - [ ] 1.2 Create frontend project structure with Next.js and TypeScript
    - Initialize `frontend/` with Next.js 14+, TypeScript, React 18, Tailwind CSS
    - Install dependencies: TanStack Query, React Hook Form, Leaflet/MapLibre GL, next-auth or custom JWT hooks
    - Create directory layout: `frontend/src/{components,pages,hooks,lib,styles}/`
    - Create design system token files (colors, typography, spacing, breakpoints, shadows, borderRadius)
    - _Requirements: 14.1, 15.1, 15.2, 15.3, 15.4, 15.5, 15.8_

  - [ ] 1.3 Create Docker Compose configuration for local development
    - Create `docker-compose.yml` with services: frontend, backend, db (postgis/postgis:16-3.4 with pgvector), minio
    - Configure environment variables, volume mounts, port mappings, and service dependencies
    - Create `backend/Dockerfile` with MegaDescriptor model pre-download step (download weights at build time via timm so first startup requires no internet)
    - Create `frontend/Dockerfile` for development
    - _Requirements: 16.1, 16.2, 16.3, 16.5_

  - [ ] 1.4 Create database schema migration and seed data
    - Create `backend/migrations/001_initial.sql` with full schema (users, cat_profiles, sightings, sighting_drafts, feeding_spots, tnr_records, verification_requests, content_reports) including enum types, pgvector extension, PostGIS extension
    - `sighting_drafts` table with `draft_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')`
    - `verification_requests` table with user_id, evidence, status (pending/approved/rejected), reviewed_by, reviewed_at columns
    - Create indexes: ivfflat on cat_profiles.embedding, B-tree on coat_color, pattern_type, ear_tip_status, body_size, GIST on blurred_location columns (sightings, feeding_spots)
    - Create `backend/migrations/seed.sql` with test data (users of each role, sample cat_profiles with metadata, sightings, feeding_spots, verification_requests)
    - _Requirements: 12.1, 12.3, 12.4, 12.5, 4.8, 4.9, 3.6, 3.7, 3.8_

- [ ] 2. Core backend services — Authentication, RBAC, and Verification Admin
  - [ ] 2.1 Implement authentication service (register, login, JWT token management)
    - Create `backend/app/services/auth_service.py` implementing IAuthService
    - JWT generation with claims: sub, email, role, iat, exp (24h default)
    - Password hashing with bcrypt, email uniqueness validation
    - Create `backend/app/core/security.py` with token verification, `get_current_user` dependency
    - _Requirements: 3.1, 3.5_

  - [ ] 2.2 Implement role-based access control middleware
    - Create `backend/app/core/rbac.py` with `require_role` dependency and role hierarchy (public < signed_in < verified)
    - Return 401 for unauthenticated, 403 for insufficient role
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ] 2.3 Implement verification admin endpoints
    - Create `backend/app/api/admin.py` with GET /admin/verification-requests and PATCH /admin/verification-requests/{id}
    - GET endpoint: list verification requests filtered by status query param, require verified role
    - PATCH endpoint: approve or reject a request, set reviewed_by and reviewed_at, update user role to verified on approval
    - Wire to auth_service.list_verification_requests() and auth_service.review_verification_request()
    - _Requirements: 3.6, 3.7, 3.8_

  - [ ]* 2.4 Write property tests for authentication and RBAC
    - **Property 4: Role-based access enforcement** — For any mutation endpoint × user with insufficient role → denial response
    - **Property 5: Authentication token contains role** — For any authenticated user, JWT contains matching role claim
    - **Validates: Requirements 3.2, 3.3, 3.5**

  - [ ] 2.5 Implement auth API routes (register, login, verify-request)
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

- [ ] 5. Two-stage matching pipeline — Metadata filter with progressive relaxation and MegaDescriptor embedding
  - [ ] 5.1 Implement metadata filter service with progressive relaxation (Stage 1)
    - Create `backend/app/services/metadata_filter_service.py` implementing IMetadataFilterService
    - Build SQL WHERE clause from CatMetadata: required coat_color + pattern_type, optional ear_tip_status + body_size
    - Implement progressive relaxation: if filtered set + embedding returns < 3 candidates above threshold, drop filters in order (body_size → ear_tip_status → pattern_type), re-query each time until 3 found or no further relaxation possible; coat_color never relaxed
    - Define RELAXATION_ORDER = ["body_size", "ear_tip_status", "pattern_type"]
    - `build_filter_query(metadata, excluded_filters)` → (where_clause, params)
    - _Requirements: 5.1, 5.6, 12.5_

  - [ ]* 5.2 Write property tests for metadata filter and progressive relaxation
    - **Property 23: Metadata filter narrows candidate set correctly** — Only returns profiles matching all provided non-relaxed fields; excludes all that differ on any non-relaxed field
    - **Property: Progressive relaxation order** — Filters are relaxed in strict order body_size → ear_tip_status → pattern_type; coat_color never relaxed
    - **Validates: Requirements 5.1, 5.6, 12.5**

  - [ ] 5.3 Implement MegaDescriptor embedding service (Stage 2)
    - Create `backend/app/services/embedding_service.py` implementing IEmbeddingService
    - Load MegaDescriptor (hf-hub:BVRA/MegaDescriptor-T-224) via timm, 224×224 input, 768-dim normalized output
    - `generate_embedding(image)` → 768-float list
    - `find_matches(embedding, metadata, metadata_filter, db_session)` → up to 3 MatchCandidates above SIMILARITY_THRESHOLD (0.65 default)
    - Integrate with progressive relaxation: call metadata_filter iteratively with increasing excluded_filters until 3 candidates found or relaxation exhausted
    - Combine metadata WHERE clause with pgvector cosine similarity ORDER BY, LIMIT 3
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 12.1, 12.2_

  - [ ]* 5.4 Write property tests for match candidates
    - **Property 9: Match candidates bounded and ordered** — Result ≤ 3 candidates, all above threshold, ordered descending by similarity
    - **Validates: Requirements 5.3, 5.4, 5.5**

- [ ] 6. Sighting submission flow with draft expiration and cat naming
  - [ ] 6.1 Implement sighting service (initiate + confirm lifecycle with draft expiration)
    - Create `backend/app/services/sighting_service.py` implementing ISightingService
    - `initiate_sighting`: validate required fields (photo, location, timestamp, condition_tags, coat_color, pattern_type), upload image, generate embedding, run two-stage matching with progressive relaxation, store draft in sighting_drafts with draft_expires_at = NOW() + 30 min
    - `confirm_sighting`: check draft_expires_at — return 410 Gone if expired; accept optional `name` field; link to selected cat_profile or create new profile (with name + metadata + embedding), store immutable sighting record, delete draft
    - `cleanup_expired_drafts`: delete drafts past expiration (background task or on-demand)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 5.6, 5.7, 5.8, 5.9_

  - [ ] 6.2 Implement cat profile service (creation with optional name, metadata + embedding)
    - Create `backend/app/services/cat_profile_service.py` implementing ICatProfileService
    - `create_profile`: initialize from sighting draft — store optional name, photo, coat_color, pattern_type, notable_markings, ear_tip_status, body_size, embedding vector, set created_by to user_id
    - `get_profile`: return profile with sighting history (reverse chronological)
    - `update_profile`: allow editing by creator or verified user, validate enum fields, recalculate embedding if photos changed
    - `update_tnr_status`: verified-only role check, validate status domain
    - `can_edit_profile`: return True if user is creator or has verified role
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 9.1, 9.2, 9.3, 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 6.3 Write property tests for sighting validation, draft expiration, and profile creation
    - **Property 6: Sighting field validation** — Missing required fields → 422 with exactly those field names
    - **Property 11: New cat profile initialization completeness** — Photo in photos array, sighting as first history entry, name stored if provided
    - **Property 24: New cat profile stores metadata** — Created profile contains all metadata from originating sighting
    - **Property: Draft expiration** — Confirming a draft with draft_expires_at < NOW() → 410 response
    - **Validates: Requirements 4.1, 4.6, 4.8, 4.9, 6.2, 6.3, 6.4**

  - [ ] 6.4 Implement sighting API routes (initiate + confirm with expiration handling)
    - Create `backend/app/api/sightings.py` with POST /sightings/initiate (multipart), POST /sightings/confirm
    - Confirm endpoint accepts optional `name` field (used only when creating new profile)
    - Return 410 if draft expired, 404 if draft not found
    - Wire to sighting service, require signed_in role, return match candidates or confirmed sighting
    - _Requirements: 4.1, 4.8, 4.9, 5.6, 5.7, 5.8, 6.2, 6.3, 13.1_

- [ ] 7. Remaining API endpoints
  - [ ] 7.1 Implement map markers endpoint with PostGIS spatial queries
    - Create `backend/app/services/map_service.py` implementing IMapService
    - Use PostGIS `ST_Within(blurred_location, ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326))` for bounding box filtering
    - Leverage GIST indexes on blurred_location for efficient spatial queries
    - Create `backend/app/api/map.py` with GET /map/markers — query by bounds + types, return only blurred coordinates
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [ ] 7.2 Implement cat profile endpoints (public listing + detail + editing)
    - Create `backend/app/api/cats.py` with GET /cats, GET /cats/{cat_id}, PATCH /cats/{cat_id}, PATCH /cats/{cat_id}/tnr-status
    - Profile detail includes sighting history (reverse chronological), feeding notes, TNR status
    - PATCH /cats/{cat_id}: allow creator or verified user to edit name, photos, coat_color, pattern_type, notable_markings, ear_tip_status, body_size; return 403 if unauthorized; recalculate embedding if photos changed; validate enum fields (422 on invalid)
    - TNR status update restricted to verified role
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.1, 9.2, 9.3, 9.4, 17.1, 17.2, 17.3, 17.4, 17.5_

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

  - [ ]* 7.6 Write property tests for TNR status, cat profile editing, error structure, and rate limiting
    - **Property 12: TNR status value domain** — Accept iff status ∈ {unassessed, needs_tnr, scheduled, in_progress, completed, ear_tipped}
    - **Property: Cat profile edit authorization** — Only creator or verified user can edit; others → 403
    - **Property: Embedding recalculation on photo change** — Editing photos triggers new embedding generation
    - **Property 17: Consistent API error structure** — All 4xx/5xx responses contain error.status_code, error.error_type, error.message
    - **Property 19: Rate limiting enforcement** — Exceeding rate limit → 429 until window resets
    - **Validates: Requirements 9.1, 13.2, 13.4, 17.1, 17.2, 17.4**

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

- [ ] 10. Frontend — Map, public pages, and auth pages
  - [ ] 10.1 Implement Live Map page with marker clusters
    - Create SSR-rendered map page using Leaflet/MapLibre GL
    - Fetch markers via GET /map/markers with bounding box, render by type (sighting/feeding_spot/tnr)
    - Marker click shows summary card (cat name, photo thumbnail, timestamp)
    - Custom marker icons per category (paw, bowl, medical cross)
    - Responsive from 320px to 2560px
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 14.2, 14.3_

  - [ ] 10.2 Implement Cat Profile detail page
    - SSR-rendered page at `/cats/[id]`
    - Display: name, photos, sighting history (reverse chronological), feeding notes, TNR status badge
    - TNR status update UI (visible only to verified users)
    - Edit profile button (visible to creator or verified users) linking to edit form
    - Report button (visible to signed-in users)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.5, 14.2, 17.1_

  - [ ] 10.3 Implement Cat listing page
    - SSR-rendered paginated list at `/cats`
    - CatCard components with name, thumbnail, TNR status badge
    - _Requirements: 2.1, 14.2_

  - [ ] 10.4 Implement Login and Register pages
    - Create `/login` page with email/password form, validation, error display, link to register
    - Create `/register` page with email/password/confirm-password form, validation, error display, link to login
    - On successful auth, redirect to originally requested page (store redirect target in query param or state)
    - Use React Hook Form for form state and validation
    - _Requirements: 14.6, 3.1, 3.2_

- [ ] 11. Frontend — Authenticated flows
  - [ ] 11.1 Implement Sighting Submission wizard (multi-step form)
    - Step 1: Photo upload with preview and validation (JPEG/PNG/WebP, ≤10MB client-side check)
    - Step 2: Location picker (map click or GPS), datetime, condition tags, required metadata (coat_color, pattern_type), optional metadata (notable_markings, ear_tip_status, body_size), notes
    - Step 3: Match selection — display up to 3 candidates with similarity scores + "none of these" option; if "none of these" selected, show optional name input field
    - Step 4: Confirmation result (linked profile or newly created profile with name)
    - Handle 410 expired draft response gracefully with user-friendly message and restart option
    - Use React Hook Form for state, TanStack Query for API calls
    - _Requirements: 4.1, 4.2, 4.3, 4.8, 4.9, 5.6, 5.7, 5.8, 5.9, 6.2, 6.3, 14.4_

  - [ ] 11.2 Implement Cat Profile edit page
    - Create `/cats/[id]/edit` page gated to creator or verified users
    - Form fields: name, photos (add/remove with preview), coat_color, pattern_type, notable_markings, ear_tip_status, body_size
    - Show warning that changing photos will recalculate the matching embedding
    - PATCH to /cats/{cat_id}, handle 403/422 errors
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ] 11.3 Implement Feeding Spot creation page
    - Map location picker, details form (description, schedule, food_type)
    - POST to /feeding-spots, require auth
    - _Requirements: 7.1, 7.3_

  - [ ] 11.4 Implement TNR Record creation and Report modal
    - TNR Record form (select cat_profile, free-text content)
    - Report modal (content_type, reason selector, optional details) — reusable across content types
    - _Requirements: 8.1, 8.2, 10.2, 10.3_

  - [ ] 11.5 Implement error boundary and offline state handling
    - Global error boundary with retry guidance when backend unreachable
    - 401 → redirect to login, 410 → expired draft message, 422 → inline field errors, 429 → cooldown timer
    - _Requirements: 14.5, 13.2_

- [ ] 12. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Integration wiring and end-to-end validation
  - [ ] 13.1 Wire Docker Compose services and validate startup
    - Verify all services start with seeded data within 120 seconds
    - Confirm frontend can reach backend, backend can reach db + minio
    - Validate MegaDescriptor model loads successfully from pre-downloaded weights in backend container (no internet required at runtime)
    - Validate PostGIS extension active and spatial indexes created
    - _Requirements: 16.1, 16.2, 16.5_

  - [ ]* 13.2 Write integration tests for the two-stage matching pipeline with progressive relaxation
    - Test metadata filter correctly narrows candidates before embedding search
    - Test progressive relaxation: if < 3 candidates, filters drop in order (body_size → ear_tip_status → pattern_type), coat_color never dropped
    - Test end-to-end sighting flow: upload → metadata filter → embedding → match candidates → confirm
    - Test "none of these" creates profile with optional name, metadata + embedding stored
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.2, 6.3, 6.4_

  - [ ]* 13.3 Write integration tests for draft expiration, verification admin, profile editing, and spatial queries
    - Test sighting draft expires after 30 minutes → 410 on confirm
    - Test verification admin GET/PATCH flow (list pending, approve → role updated)
    - Test cat profile editing: creator can edit, verified can edit, others get 403; photo change triggers embedding recalc
    - Test PostGIS spatial query returns only markers within bounding box
    - Test login/register API flows with proper JWT and role claims
    - _Requirements: 4.8, 4.9, 3.6, 3.7, 3.8, 17.1, 17.2, 17.4, 1.6_

  - [ ]* 13.4 Write integration tests for remaining API flows
    - Test public map returns only blurred coordinates
    - Test image upload to S3 and URL retrieval
    - Test role-gated endpoints (TNR status update by verified/non-verified)
    - Test content report storage
    - _Requirements: 1.3, 9.2, 9.3, 10.2, 11.1_

  - [ ]* 13.5 Write end-to-end tests (Playwright)
    - Public visitor browses map without login
    - User registers, logs in, redirected to original page
    - Signed-in user submits sighting end-to-end (with metadata fields)
    - Match selection with "none of these" flow (including optional name)
    - Expired draft shows appropriate error
    - Verified user updates TNR status
    - Cat profile edit by creator
    - Content reporting flow
    - _Requirements: 1.1, 4.1, 4.8, 5.6, 9.2, 10.2, 14.6, 17.1_

- [ ] 14. Final checkpoint — Full system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The MegaDescriptor model (hf-hub:BVRA/MegaDescriptor-T-224) produces 768-dim embeddings via timm library — pre-downloaded in Docker build (Req 16.5)
- Stage 1 (metadata filter) uses SQL WHERE clauses on coat_color, pattern_type, ear_tip_status, body_size with progressive relaxation (Req 5.6)
- Stage 2 (embedding search) uses pgvector cosine similarity on the filtered subset
- Sighting drafts stored in sighting_drafts table with 30-min TTL; confirm returns 410 if expired (Req 4.8, 4.9)
- Cat profile naming is optional at confirm step when creating new profile (Req 6.2, 6.3)
- Verification admin endpoints allow verified users to approve/reject requests (Req 3.6, 3.7, 3.8)
- Cat profile editing via PATCH by creator or verified user; photo change triggers embedding recalc (Req 17)
- Login/Register frontend pages with redirect-after-auth (Req 14.6)
- PostGIS ST_Within used for map bounding box queries on spatial indexes (Req 1.6)
- Backend uses Python (FastAPI), frontend uses TypeScript (Next.js)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1", "3.1", "3.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2", "3.4", "9.1"] },
    { "id": 3, "tasks": ["5.1", "5.3", "9.2", "9.3"] },
    { "id": 4, "tasks": ["5.2", "5.4", "6.1", "6.2"] },
    { "id": 5, "tasks": ["6.3", "6.4", "7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 6, "tasks": ["7.6", "10.1", "10.2", "10.3", "10.4"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 8, "tasks": ["13.1"] },
    { "id": 9, "tasks": ["13.2", "13.3", "13.4", "13.5"] }
  ]
}
```
