# Implementation Plan: Purrsona v1

## Overview

Full-stack implementation of the Purrsona community cat tracker. The plan proceeds from infrastructure scaffolding through backend core, frontend shell, feature endpoints, matching pipeline, and finally integration wiring. Backend tasks use Python (FastAPI), frontend uses TypeScript (Next.js/React), and infrastructure uses Docker Compose.

## Tasks

- [ ] 1. Project scaffolding and infrastructure
  - [ ] 1.1 Create monorepo directory structure and Docker Compose configuration
    - Create `/backend`, `/frontend`, and root `docker-compose.yml`
    - Backend: Python 3.11+ with FastAPI, uvicorn, Pydantic, asyncpg, python-jose, boto3, Pillow, torch, clip
    - Frontend: Next.js 14+ with TypeScript, React 18, TanStack Query, React Hook Form
    - Docker Compose with services: frontend, backend, db (pgvector/pgvector:pg16), minio
    - Include volume mounts, port mappings, and environment variables per design
    - Add `backend/requirements.txt` (or pyproject.toml) and `frontend/package.json`
    - _Requirements: 16.1, 16.4_

  - [ ] 1.2 Create database migration with schema and seed data
    - Write SQL migration file with all tables, enums, indexes from design (users, cat_profiles, sightings, feeding_spots, tnr_records, content_reports)
    - Include pgvector and postgis extension creation
    - Include IVFFlat index on embeddings, GIST indexes on locations
    - Write seed.sql with sample users (one per role), 3-5 cat profiles, sample sightings
    - Mount seed file in Docker Compose for auto-initialization
    - _Requirements: 12.1, 12.3, 12.4, 16.2_

  - [ ] 1.3 Create backend application skeleton with configuration
    - FastAPI app factory with CORS, versioned router mount at `/api/v1`
    - Settings class reading all config from environment variables (DATABASE_URL, S3_*, JWT_*, CLIP_*, RATE_LIMIT_*, SIMILARITY_THRESHOLD, MAX_IMAGE_SIZE_MB, BLUR_RADIUS_METERS)
    - Database session management (asyncpg or SQLAlchemy async)
    - Health check endpoint at `/api/v1/health`
    - Dockerfile for backend container
    - _Requirements: 13.1, 16.4_

  - [ ] 1.4 Create frontend application skeleton with design system tokens
    - Next.js 14+ app with TypeScript configuration (tsconfig, eslint, prettier)
    - Design system tokens file: colors (primary, secondary, neutral, success, warning, error with light/dark), typography (Inter font family, 8 size steps, line heights, weights), spacing (8px grid), border radius, shadows, elevation, breakpoints
    - Global CSS reset and token-based theme provider
    - Basic layout component with responsive navigation shell
    - Dockerfile for frontend container
    - _Requirements: 14.1, 15.1, 15.2, 15.3, 15.4, 15.8_

- [ ] 2. Authentication and authorization layer
  - [ ] 2.1 Implement auth service and JWT handling
    - User registration endpoint `POST /api/v1/auth/register` with email/password, returns user_id + JWT
    - User login endpoint `POST /api/v1/auth/login` with email/password, returns JWT + role
    - JWT generation with claims: sub (user UUID), email, role, iat, exp (24h)
    - Password hashing with bcrypt
    - Token verification utility function
    - Verification request endpoint `POST /api/v1/auth/verify-request`
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ] 2.2 Implement role-based access control middleware
    - `require_role` dependency that reads JWT from Authorization header
    - Role hierarchy enforcement: public < signed_in < verified
    - Return 401 for missing/invalid token, 403 for insufficient role
    - Apply to all mutation endpoints
    - _Requirements: 3.2, 3.3_

  - [ ]* 2.3 Write property tests for authentication and RBAC
    - **Property 4: Role-based access enforcement** — For any mutation endpoint and any user below minimum role, API returns 401/403
    - **Property 5: Authentication token contains role** — For any authenticated user, JWT contains matching role claim
    - **Validates: Requirements 3.2, 3.3, 3.5**

  - [ ] 2.4 Implement frontend auth flow
    - Login and register pages with form validation
    - `useAuth` hook managing JWT in httpOnly cookie, exposing user/login/register/logout
    - Auth context provider wrapping the app
    - Redirect to login on 401 responses, preserve destination URL
    - Protected route wrapper for authenticated pages
    - _Requirements: 3.1, 3.2, 14.5_

- [ ] 3. Checkpoint - Verify infrastructure and auth
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Core backend services
  - [ ] 4.1 Implement image service with S3 storage
    - Image validation: check content type (JPEG, PNG, WebP) and size (≤10 MB) using magic bytes
    - Upload to S3/MinIO bucket, return permanent HTTPS reference URL
    - Configuration via environment variables (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ]* 4.2 Write property test for image validation
    - **Property 16: Image upload validation** — Accept iff content_type ∈ {JPEG, PNG, WebP} AND size ≤ 10 MB; reject with 422 specifying violation
    - **Validates: Requirements 11.3, 11.4**

  - [ ] 4.3 Implement coordinate blur service
    - `blur_coordinate` function: random offset within 200m radius using sqrt-uniform distribution for area uniformity
    - Compute blurred location at write time (not at read time)
    - Store both exact and blurred coordinates
    - Haversine distance utility function
    - _Requirements: 1.3, 1.4, 7.4_

  - [ ]* 4.4 Write property test for coordinate blurring
    - **Property 1: Coordinate blur stays within 200m radius** — For any valid coordinate, Haversine(original, blurred) ≤ 200m AND blurred ≠ original
    - **Validates: Requirements 1.3, 1.4, 7.4**

  - [ ] 4.5 Implement CLIP embedding service
    - Load CLIP ViT-B/32 model (CPU/GPU auto-detection)
    - `generate_embedding` method: preprocess image → 512-dim normalized vector
    - `find_matches` method: cosine similarity query against pgvector, return top-3 above threshold (0.65 default)
    - Configuration via CLIP_MODEL_PATH and SIMILARITY_THRESHOLD env vars
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 12.1, 12.2_

  - [ ]* 4.6 Write property test for match candidates
    - **Property 9: Match candidates bounded and ordered** — Result ≤ 3 candidates, all above threshold, ordered by descending similarity
    - **Validates: Requirements 5.3, 5.4**

  - [ ] 4.7 Implement consistent API error handling
    - Error response middleware/exception handlers returning JSON with `error.status_code`, `error.error_type`, `error.message` structure
    - Pydantic validation error → 422 with field-level details
    - Custom exception classes for 401, 403, 404, 429
    - _Requirements: 13.2, 13.3_

  - [ ]* 4.8 Write property test for API error structure
    - **Property 17: Consistent API error structure** — For any 4xx/5xx response, body contains `error` object with status_code (int), error_type (str), message (str)
    - **Validates: Requirements 13.2**

  - [ ] 4.9 Implement rate limiting middleware
    - Per-user rate limit on mutation endpoints (configurable via RATE_LIMIT_PER_MINUTE)
    - Return 429 when exceeded with Retry-After header
    - Higher/no limits on read endpoints
    - _Requirements: 13.4_

  - [ ]* 4.10 Write property test for rate limiting
    - **Property 19: Rate limiting enforcement** — When a user exceeds rate limit within window, subsequent mutation requests receive 429
    - **Validates: Requirements 13.4**

- [ ] 5. Checkpoint - Verify core services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Sighting submission flow
  - [ ] 6.1 Implement sighting initiation endpoint
    - `POST /api/v1/sightings/initiate` (multipart/form-data, auth required)
    - Validate required fields: photo, latitude, longitude, observed_at, condition_tags (≥1)
    - Upload photo to image store → get URL
    - Generate CLIP embedding from photo
    - Query pgvector for match candidates
    - Blur coordinates and store sighting draft
    - Return draft_id, photo_url, match_candidates
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 5.1, 5.2, 5.3, 5.5_

  - [ ]* 6.2 Write property test for sighting field validation
    - **Property 6: Sighting field validation** — For any submission missing required fields, API returns 422 with details listing exactly the missing field names
    - **Validates: Requirements 4.1, 4.6**

  - [ ] 6.3 Implement sighting confirmation endpoint
    - `POST /api/v1/sightings/confirm` (auth required)
    - Accept draft_id + selected_cat_profile_id (UUID or null)
    - If cat selected → link sighting to existing Cat_Profile
    - If null ("none of these") → create new Cat_Profile with photo, embedding, and link sighting
    - Mark sighting as immutable confirmed record
    - Return sighting_id, cat_profile_id, is_new_profile
    - _Requirements: 4.4, 4.5, 5.6, 5.7, 5.8, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.4 Write property tests for sighting confirmation invariants
    - **Property 8: Sighting-profile linkage** — Every confirmed sighting has non-null cat_profile_id referencing an existing Cat_Profile
    - **Property 10: No automatic linkage** — Sighting does not confirm without explicit user action
    - **Property 11: New cat profile initialization** — "None of these" creates profile with originating photo and sighting as first history entry
    - **Validates: Requirements 4.4, 4.5, 5.7, 5.8, 6.2, 6.4**

- [ ] 7. Cat profiles, feeding spots, TNR, and reports
  - [ ] 7.1 Implement cat profile endpoints
    - `GET /api/v1/cats/{cat_id}` — Public, returns profile with sighting history (reverse chronological), photos, tnr_status, feeding_notes
    - `GET /api/v1/cats` — Public, paginated list (page, per_page params)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 7.2 Write property test for sighting history ordering
    - **Property 3: Sighting history ordering** — For any Cat_Profile with ≥2 sightings, history is ordered by descending observed_at
    - **Validates: Requirements 2.3**

  - [ ] 7.3 Implement map markers endpoint
    - `GET /api/v1/map/markers` — Public, filtered by bounds and types (sighting, feeding_spot, tnr)
    - Return only blurred coordinates, cat_profile summary, timestamp, tnr_status
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [ ] 7.4 Implement feeding spot endpoint
    - `POST /api/v1/feeding-spots` (auth required)
    - Validate latitude, longitude, details
    - Blur coordinates at write time
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 7.5 Implement TNR record and status endpoints
    - `POST /api/v1/tnr-records` (signed_in required) — Create TNR record linked to cat_profile
    - `PATCH /api/v1/cats/{cat_id}/tnr-status` (verified required) — Update TNR status
    - Validate status against 6 allowed values, reject with 422 if invalid
    - Return 403 if non-verified user attempts status update
    - _Requirements: 8.1, 8.2, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 7.6 Write property tests for TNR status
    - **Property 12: TNR status value domain** — API accepts iff status ∈ {unassessed, needs_tnr, scheduled, in_progress, completed, ear_tipped}
    - **Property 13: TNR status singularity** — After any sequence of updates, cat_profile has exactly one current TNR status
    - **Validates: Requirements 9.1, 9.4**

  - [ ] 7.7 Implement content reports endpoint
    - `POST /api/v1/reports` (auth required)
    - Store reporter_id, content_type, content_id, reason, optional details
    - Return 401 for unauthenticated users
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 7.8 Write property test for report data completeness
    - **Property 15: Report data completeness** — Every stored report contains reporter_id, content_id, content_type, and valid reason category
    - **Validates: Requirements 10.2**

- [ ] 8. Checkpoint - Verify all backend endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Frontend UI components and design system
  - [ ] 9.1 Implement design system component library
    - Button component (primary, secondary, ghost variants; sm/md/lg sizes; loading/disabled states)
    - Form input components (text, select, textarea, file upload) with validation states
    - Card components (cat profile card, sighting card, feeding spot card)
    - Modal component (confirmation dialog, image viewer, report form)
    - Status badge component (TNR status pills with color coding)
    - Navigation bar (logo, search, auth controls, responsive hamburger)
    - All interactive components implement 5 states: default, hover, focus, active, disabled
    - Focus ring: 2px primary-500 for keyboard navigation
    - _Requirements: 15.5, 15.6, 15.7_

  - [ ]* 9.2 Write property test for spacing token alignment
    - **Property 20: Spacing tokens grid alignment** — Every non-zero spacing token value is a multiple of 4px
    - **Validates: Requirements 15.3**

  - [ ] 9.3 Implement Live Map page
    - SSR public page at `/` with Leaflet or MapLibre GL
    - Fetch markers from `/api/v1/map/markers` with bounding box filtering
    - Render distinct marker icons: paw (sighting), bowl (feeding spot), medical-cross (TNR)
    - Marker click opens summary card with cat name, photo thumbnail, timestamp
    - TNR status shown on relevant markers
    - Responsive from 320px to 2560px
    - _Requirements: 1.1, 1.2, 1.5, 9.5, 14.2, 14.3_

  - [ ] 9.4 Implement Cat Profile page
    - SSR public page at `/cats/[id]`
    - Display: name/alias, photo set, sighting history (reverse chronological), status tags, feeding notes, current TNR status
    - Include TNR records in welfare history section
    - Report button (auth gated)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.3_

  - [ ] 9.5 Implement Sighting Submission wizard
    - CSR authenticated page at `/sightings/new`
    - Multi-step form: upload photo → enter location/time/tags/notes → view match candidates → confirm
    - `useMapMarkers` hook for fetching and caching markers
    - Match selection UI with candidate cards + "none of these" button
    - Calls `/api/v1/sightings/initiate` then `/api/v1/sightings/confirm`
    - Redirect to cat profile on success
    - _Requirements: 4.1, 4.2, 5.5, 5.6, 14.4_

  - [ ] 9.6 Implement Feeding Spot and TNR pages
    - Feeding spot creation form at `/feeding-spots/new` (auth required)
    - TNR record creation integrated into cat profile page (auth required)
    - TNR status update UI on cat profile (verified role gated, shows dropdown with 6 statuses)
    - _Requirements: 7.1, 7.3, 8.1, 8.2, 9.2, 9.3_

  - [ ] 9.7 Implement error states and accessibility
    - Network error boundary with retry button and offline indicator
    - 404 friendly state ("Cat not found" with link to map)
    - Rate limit feedback (disable button, cooldown timer)
    - WCAG 2.1 AA: focus management, aria labels, color contrast, keyboard navigation
    - _Requirements: 14.3, 14.4, 14.5_

- [ ] 10. Checkpoint - Verify frontend components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Integration wiring and end-to-end testing
  - [ ] 11.1 Wire Docker Compose full-stack and verify startup
    - Ensure `docker compose up` starts all services with seeded data within 120s
    - Verify frontend can reach backend API
    - Verify backend can reach PostgreSQL, MinIO, and load CLIP model
    - Verify seeded data appears on the map
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ]* 11.2 Write integration tests for sighting flow
    - Full sighting submission through API: upload → initiate → match → confirm
    - Verify embedding stored in pgvector and new sighting appears in profile history
    - Verify public API responses contain only blurred coordinates (never exact)
    - _Requirements: 4.1, 4.4, 4.5, 5.1, 1.3, 1.4_

  - [ ]* 11.3 Write end-to-end tests with Playwright
    - Public visitor browses map without login
    - Signed-in user submits sighting end-to-end (upload, match, confirm)
    - Match selection and "none of these" flows create correct profiles
    - Verified user updates TNR status successfully
    - Non-verified user blocked from TNR status update (403)
    - Content reporting flow completes
    - _Requirements: 1.1, 4.1, 5.6, 5.7, 9.2, 9.3, 10.2_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each major milestone
- Property tests validate universal correctness properties from the design document (Hypothesis for Python, fast-check for TypeScript)
- Unit tests validate specific examples and edge cases
- Backend uses Python 3.11+ with FastAPI; frontend uses TypeScript with Next.js 14+
- The CLIP model (ViT-B/32) is loaded in-process on the backend; GPU is used if available

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "4.1", "4.3", "4.7"] },
    { "id": 3, "tasks": ["2.2", "2.4", "4.2", "4.4", "4.5", "4.8", "4.9"] },
    { "id": 4, "tasks": ["2.3", "4.6", "4.10", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3"] },
    { "id": 6, "tasks": ["6.4", "7.1", "7.3", "7.4", "7.5", "7.7"] },
    { "id": 7, "tasks": ["7.2", "7.6", "7.8", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] },
    { "id": 9, "tasks": ["11.1"] },
    { "id": 10, "tasks": ["11.2", "11.3"] }
  ]
}
```
