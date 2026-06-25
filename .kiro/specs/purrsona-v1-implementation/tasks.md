# Implementation Plan: Purrsona v1

## Overview

Full-stack implementation of the Purrsona community cat tracker. The backend is Python/FastAPI with PostgreSQL+pgvector+PostGIS, using a two-stage matching pipeline (SQL metadata filter with progressive relaxation → MegaDescriptor cosine similarity). The frontend is Next.js/TypeScript with an interactive map. Implementation proceeds from infrastructure and database setup through core services, API endpoints, frontend pages, and integration wiring.

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
    - Create `docker-compose.yml` with services: frontend, backend, db (postgis/postgis:16-3.4 with pgvector), minio
    - Configure environment variables, volume mounts, port mappings, and service dependencies
    - Create `frontend/Dockerfile` for development
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ] 1.4 Create backend Dockerfile with MegaDescriptor model pre-download
    - Create `backend/Dockerfile` with Python 3.11-slim base, system deps (libpq-dev, gcc)
    - Install pip dependencies from requirements.txt
    - Add build step that pre-downloads MegaDescriptor weights via `timm.create_model('hf-hub:BVRA/MegaDescriptor-T-224', pretrained=True)` so first startup does not require internet
    - Expose port 8000, CMD uvicorn
    - _Requirements: 16.3, 16.5_

  - [ ] 1.5 Create database schema migration and seed data
    - Create `backend/migrations/001_initial.sql` with full schema: users, cat_profiles, sightings, feeding_spots, tnr_records, content_reports, sighting_drafts (with draft_expires_at column defaulting to NOW() + 30 min), verification_requests (with status CHECK constraint, reviewed_by FK, reviewed_at)
    - Include enum types (user_role, tnr_status_enum, report_reason, coat_color_enum, pattern_type_enum, body_size_enum)
    - Enable pgvector and postgis extensions
    - Create indexes: ivfflat on cat_profiles.embedding, B-tree on coat_color/pattern_type/ear_tip_status/body_size, GIST on blurred_location columns, B-tree on sighting_drafts.draft_expires_at, B-tree on verification_requests.status
    - Create `backend/migrations/seed.sql` with test data (users of each role, sample cat_profiles with metadata, sightings, feeding_spots, verification_requests)
    - _Requirements: 12.1, 12.3, 12.4, 12.5, 4.8, 3.6, 3.7_

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
    - _Requirements: 3.2, 3.3_

  - [ ] 2.3 Implement verification workflow endpoints
    - Create `backend/app/api/admin.py` with:
      - POST /auth/verify-request — signed_in user submits evidence, stores verification_request with status=pending
      - GET /admin/verification-requests?status=pending — requires verified role, returns pending requests
      - PATCH /admin/verification-requests/{id} — requires verified role, approve/reject, sets reviewed_by/reviewed_at, updates user role to verified on approval
    - _Requirements: 3.4, 3.6, 3.7, 3.8_

  - [ ]* 2.4 Write property tests for authentication and RBAC
    - **Property 4: Role-based access enforcement** — For any mutation endpoint × user with insufficient role → denial response
    - **Property 5: Authentication token contains role** — For any authenticated user, JWT contains matching role claim
    - **Validates: Requirements 3.2, 3.3, 3.5**

  - [ ] 2.5 Implement auth API routes (register, login)
    - Create `backend/app/api/auth.py` with POST /auth/register, POST /auth/login
    - Wire to auth service, return consistent error responses
    - _Requirements: 3.1, 13.2_

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
    - Implement progressive relaxation loop: if < 3 candidates above threshold, drop filters in order: body_size → ear_tip_status → pattern_type, re-querying at each step
    - coat_color is never relaxed
    - Define RELAXATION_ORDER = ["body_size", "ear_tip_status", "pattern_type"]
    - `build_filter_query(metadata, excluded_filters)` returns (where_clause, params) for composing into pgvector similarity query
    - _Requirements: 5.1, 5.6, 12.5_

  - [ ]* 5.2 Write property tests for metadata filter and progressive relaxation
    - **Property 23: Metadata filter narrows candidate set correctly** — Only returns profiles matching all provided fields; excludes all that differ on any field
    - **Property 25: Progressive relaxation ordering** — Filters are dropped in strict order (body_size first, then ear_tip_status, then pattern_type); coat_color is never dropped
    - **Validates: Requirements 5.1, 5.6, 12.5**

  - [ ] 5.3 Implement MegaDescriptor embedding service (Stage 2)
    - Create `backend/app/services/embedding_service.py` implementing IEmbeddingService
    - Load MegaDescriptor (hf-hub:BVRA/MegaDescriptor-T-224) via timm, 224×224 input, 768-dim normalized output
    - `generate_embedding(image)` → 768-float list
    - `find_matches(embedding, metadata, metadata_filter, db_session)` → integrates progressive relaxation loop: call metadata_filter with increasing exclusions, run pgvector cosine search on each filtered subset, stop when ≥3 candidates or no more relaxation
    - Return up to 3 MatchCandidates above SIMILARITY_THRESHOLD (0.65 default), ordered descending by similarity
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 12.1, 12.2_

  - [ ]* 5.4 Write property tests for match candidates
    - **Property 9: Match candidates bounded and ordered** — Result ≤ 3 candidates, all above threshold, ordered descending by similarity
    - **Validates: Requirements 5.3, 5.4, 5.5**

- [ ] 6. Sighting submission flow with draft expiration
  - [ ] 6.1 Implement sighting service (initiate + confirm lifecycle with draft TTL)
    - Create `backend/app/services/sighting_service.py` implementing ISightingService
    - `initiate_sighting`: validate required fields (photo, location, timestamp, condition_tags, coat_color, pattern_type), upload image, generate embedding, run two-stage matching with progressive relaxation, store draft in sighting_drafts table with draft_expires_at = NOW() + 30 minutes
    - `confirm_sighting`: load draft, check draft_expires_at — if expired return HTTP 410 Gone; otherwise link to selected cat_profile or create new profile (with optional name), store immutable sighting record, delete draft
    - `get_draft_or_expired`: raises 410 if expired, 404 if not found
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 5.6, 5.7, 5.8, 5.9, 6.2, 6.3_

  - [ ] 6.2 Implement draft expiration background cleanup task
    - Create `backend/app/services/draft_cleanup.py` with `cleanup_expired_drafts()` function
    - Register as a background task on FastAPI startup (asyncio loop running every 10 minutes)
    - DELETE FROM sighting_drafts WHERE draft_expires_at < NOW()
    - Log number of expired drafts cleaned up
    - _Requirements: 4.8_

  - [ ] 6.3 Implement cat profile service (creation with optional name, metadata + embedding)
    - Create `backend/app/services/cat_profile_service.py` implementing ICatProfileService
    - `create_profile(sighting_draft, name)`: initialize from sighting draft — store photo, coat_color, pattern_type, notable_markings, ear_tip_status, body_size, embedding vector, optional name
    - `get_profile`: return profile with sighting history (reverse chronological)
    - `update_tnr_status`: verified-only role check, validate status domain
    - `can_edit_profile(cat_id, user)`: True if user is profile creator OR has verified role
    - `update_profile(cat_id, user, updates)`: validate authorization, update fields, recalculate embedding if photos change
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 9.1, 9.2, 9.3, 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 6.4 Write property tests for sighting validation, draft expiration, and profile creation
    - **Property 6: Sighting field validation** — Missing required fields → 422 with exactly those field names
    - **Property 11: New cat profile initialization completeness** — Photo in photos array, sighting as first history entry
    - **Property 24: New cat profile stores metadata** — Created profile contains all metadata from originating sighting
    - **Property 26: Draft expiration returns 410** — Confirming a draft past draft_expires_at → HTTP 410
    - **Validates: Requirements 4.1, 4.6, 4.8, 4.9, 6.2, 6.4**

  - [ ] 6.5 Implement sighting API routes (initiate + confirm)
    - Create `backend/app/api/sightings.py` with POST /sightings/initiate (multipart), POST /sightings/confirm
    - Confirm endpoint accepts optional `name` field (used when selected_cat_profile_id is null for new profile naming)
    - Wire to sighting service, require signed_in role, return match candidates or confirmed sighting
    - Return 410 if draft expired on confirm
    - _Requirements: 4.1, 5.6, 5.7, 5.8, 5.9, 6.2, 6.3, 13.1_

- [ ] 7. Remaining API endpoints
  - [ ] 7.1 Implement map markers endpoint with PostGIS spatial queries
    - Create `backend/app/services/map_service.py` implementing IMapService
    - Implement `get_markers(bounds, types)` using PostGIS ST_Within with ST_MakeEnvelope for bounding box filtering
    - Query pattern: `WHERE ST_Within(blurred_location, ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326))`
    - Leverage GIST spatial indexes on blurred_location columns — no application-level coordinate filtering
    - Create `backend/app/api/map.py` with GET /map/markers?bounds=sw_lat,sw_lng,ne_lat,ne_lng&types=sighting,feeding_spot,tnr
    - Return only blurred coordinates in response
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [ ] 7.2 Implement cat profile endpoints (public listing + detail + edit)
    - Create `backend/app/api/cats.py` with:
      - GET /cats — paginated listing
      - GET /cats/{cat_id} — profile detail with sighting history (reverse chronological), feeding notes, TNR status
      - PATCH /cats/{cat_id} — edit profile (name, photos, metadata fields); auth required, creator or verified only; recalculate embedding if photos change
      - PATCH /cats/{cat_id}/tnr-status — TNR status update, restricted to verified role
    - Return 403 if not creator and not verified on edit attempt
    - Return 422 for invalid enum values on edit
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

  - [ ]* 7.6 Write property tests for TNR status, error structure, rate limiting, and cat profile editing
    - **Property 12: TNR status value domain** — Accept iff status ∈ {unassessed, needs_tnr, scheduled, in_progress, completed, ear_tipped}
    - **Property 17: Consistent API error structure** — All 4xx/5xx responses contain error.status_code, error.error_type, error.message
    - **Property 19: Rate limiting enforcement** — Exceeding rate limit → 429 until window resets
    - **Property 27: Cat profile edit authorization** — Only creator or verified user can edit; others get 403
    - **Validates: Requirements 9.1, 13.2, 13.4, 17.1, 17.2**

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
    - _Requirements: 3.1, 3.2, 14.5, 14.6_

- [ ] 10. Frontend — Auth pages, Map, and public pages
  - [ ] 10.1 Implement Login and Register pages
    - Create `frontend/src/pages/auth/login.tsx` with email/password form
    - Create `frontend/src/pages/auth/register.tsx` with email/password/confirm form
    - Use React Hook Form for form state and validation (required fields, email format, password min length)
    - Display inline validation errors and API error messages
    - On successful auth, redirect to originally requested page (store returnUrl in query param or session)
    - Wire to useAuth hook for login/register API calls
    - Responsive layout, accessible form labels and focus management
    - _Requirements: 14.6, 3.1_

  - [ ] 10.2 Implement Live Map page with marker clusters
    - Create SSR-rendered map page using Leaflet/MapLibre GL
    - Fetch markers via GET /map/markers with bounding box, render by type (sighting/feeding_spot/tnr)
    - Marker click shows summary card (cat name, photo thumbnail, timestamp)
    - Custom marker icons per category (paw, bowl, medical cross)
    - Responsive from 320px to 2560px
    - _Requirements: 1.1, 1.2, 1.5, 14.2, 14.3_

  - [ ] 10.3 Implement Cat Profile detail page
    - SSR-rendered page at `/cats/[id]`
    - Display: name, photos, sighting history (reverse chronological), feeding notes, TNR status badge
    - TNR status update UI (visible only to verified users)
    - Edit button (visible to creator or verified users) linking to edit form
    - Report button (visible to signed-in users)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.5, 14.2, 17.1_

  - [ ] 10.4 Implement Cat listing page
    - SSR-rendered paginated list at `/cats`
    - CatCard components with name, thumbnail, TNR status badge
    - _Requirements: 2.1, 14.2_

- [ ] 11. Frontend — Authenticated flows
  - [ ] 11.1 Implement Sighting Submission wizard (multi-step form)
    - Step 1: Photo upload with preview and validation (JPEG/PNG/WebP, ≤10MB client-side check)
    - Step 2: Location picker (map click or GPS), datetime, condition tags, required metadata (coat_color, pattern_type), optional metadata (notable_markings, ear_tip_status, body_size), notes
    - Step 3: Match selection — display up to 3 candidates with similarity scores + "none of these" option
    - Step 3b: If "none of these" selected, prompt user for optional cat name before confirming
    - Step 4: Confirmation result (linked profile or newly created profile)
    - Handle 410 response on expired draft (show message, allow user to restart)
    - Use React Hook Form for state, TanStack Query for API calls
    - _Requirements: 4.1, 4.2, 4.3, 4.9, 5.6, 5.7, 5.8, 5.9, 6.2, 14.4_

  - [ ] 11.2 Implement Cat Profile edit page
    - Create form at `/cats/[id]/edit` (CSR, auth required)
    - Fields: name, photos (add/remove with preview), coat_color, pattern_type, notable_markings, ear_tip_status, body_size
    - Show only if user is creator or verified (check via API or local role)
    - Submit via PATCH /cats/{cat_id}, display validation errors inline
    - _Requirements: 17.1, 17.2, 17.4, 17.5_

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
    - 401 → redirect to login, 422 → inline field errors, 429 → cooldown timer, 410 → draft expired message
    - _Requirements: 14.5, 13.2_

- [ ] 12. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Integration wiring and end-to-end validation
  - [ ] 13.1 Wire Docker Compose services and validate startup
    - Verify all services start with seeded data within 120 seconds
    - Confirm frontend can reach backend, backend can reach db + minio
    - Validate MegaDescriptor model loads from pre-downloaded weights (no internet required)
    - Verify PostGIS extension is active and spatial queries work
    - _Requirements: 16.1, 16.2, 16.5_

  - [ ]* 13.2 Write integration tests for the two-stage matching pipeline with progressive relaxation
    - Test metadata filter correctly narrows candidates before embedding search
    - Test progressive relaxation: when < 3 candidates, filters drop in order (body_size → ear_tip_status → pattern_type)
    - Test end-to-end sighting flow: upload → metadata filter → embedding → match candidates → confirm
    - Test "none of these" creates profile with metadata + embedding + optional name stored
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.2, 6.3, 6.4_

  - [ ]* 13.3 Write integration tests for draft expiration, verification, and profile editing
    - Test sighting draft expires after 30 minutes → 410 on confirm
    - Test background cleanup deletes expired drafts
    - Test verification request flow: submit → list pending → approve → user role updated
    - Test cat profile edit by creator (success) and by non-creator non-verified (403)
    - Test embedding recalculation triggers on photo change
    - _Requirements: 4.8, 4.9, 3.6, 3.7, 3.8, 17.1, 17.2, 17.4_

  - [ ]* 13.4 Write integration tests for remaining API flows
    - Test public map uses PostGIS spatial queries and returns only blurred coordinates
    - Test image upload to S3 and URL retrieval
    - Test role-gated endpoints (TNR status update by verified/non-verified)
    - Test content report storage
    - _Requirements: 1.3, 1.6, 9.2, 9.3, 10.2, 11.1_

  - [ ]* 13.5 Write end-to-end tests (Playwright)
    - Public visitor browses map without login
    - User registers, logs in, is redirected to originally requested page
    - Signed-in user submits sighting end-to-end (with metadata fields)
    - Match selection and "none of these" flows (with cat naming prompt)
    - Verified user updates TNR status
    - Cat profile editing flow (authorized vs unauthorized)
    - Content reporting flow
    - _Requirements: 1.1, 4.1, 5.6, 9.2, 10.2, 14.6, 17.1_

- [ ] 14. Final checkpoint — Full system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The MegaDescriptor model (hf-hub:BVRA/MegaDescriptor-T-224) produces 768-dim embeddings via timm library
- Stage 1 (metadata filter) uses SQL WHERE clauses on coat_color, pattern_type, ear_tip_status, body_size with progressive relaxation
- Stage 2 (embedding search) uses pgvector cosine similarity on the filtered subset
- Progressive relaxation drops filters in order: body_size → ear_tip_status → pattern_type (coat_color never dropped)
- Backend uses Python (FastAPI), frontend uses TypeScript (Next.js)
- PostGIS spatial queries (ST_Within/ST_MakeEnvelope) replace application-level bounding box filtering
- Sighting drafts expire after 30 minutes; background task cleans up every 10 minutes
- Verification workflow is a minimal API (no admin UI) — verified users can approve/reject requests
- Cat profile editing requires creator OR verified role; photo changes trigger embedding recalculation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5", "2.1", "3.1", "3.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2", "3.4", "9.1"] },
    { "id": 3, "tasks": ["5.1", "5.3", "9.2", "9.3"] },
    { "id": 4, "tasks": ["5.2", "5.4", "6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["6.4", "6.5", "7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 6, "tasks": ["7.6", "10.1", "10.2", "10.3", "10.4"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 8, "tasks": ["13.1"] },
    { "id": 9, "tasks": ["13.2", "13.3", "13.4", "13.5"] }
  ]
}
```
