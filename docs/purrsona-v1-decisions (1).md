# Purrsona v1 — Resolved Decisions & Clarifications

> **Purpose:** This document resolves all open questions raised during planning
> for Purrsona v1 and corrects a few inconsistencies found between
> `design.md`, `requirements.md`, `tasks.md`, and the original functional
> spec (`docs/superpowers/specs/2026-06-24-cat-tracker-design.md`).
>
> Treat this file as **authoritative** wherever it conflicts with prose in
> `design.md` (the SQL schema, code samples, and `tasks.md` are the ground
> truth; design.md's prose has a couple of typos/inconsistencies noted below).
>
> Read this file alongside `design.md`, `requirements.md`, and `tasks.md`
> before starting or resuming implementation. Do not re-ask these questions.

---

## 1. Database access pattern: raw asyncpg, not SQLAlchemy ORM

Use **raw asyncpg** for all query execution — this is what every service-layer
code sample in `design.md` already shows (`db_session.fetch(...)`,
`db_session.execute(...)` with `$1`-style positional params).

`sqlalchemy` is listed in `tasks.md` (1.1) as a dependency, but it should only
be used for schema/model definitions if needed — **do not introduce an ORM
query-builder pattern**. Stay consistent with the raw-SQL style already
written throughout `design.md`.

## 2. Auth token delivery: httpOnly cookie only, not response body

`design.md` is internally inconsistent on this point:

- **Security Considerations** and **State Management** both specify
  httpOnly cookies for the JWT.
- The literal `POST /api/v1/auth/register` / `POST /api/v1/auth/login` API
  contract shows `"token": "jwt..."` returned in the JSON response body.
- `tasks.md` (9.3) also says "JWT in httpOnly cookie."

**Resolution:** Follow the security model, not the literal API contract
example. The backend sets an `httpOnly`, `secure`, `sameSite=lax` cookie on
login/register and does **not** also return the raw token in the JSON body.

## 3. Migrations: plain `.sql` files, not Alembic

Use plain, sequentially numbered `.sql` files as specified:
`backend/migrations/001_initial.sql`, `002_...sql`, etc. **No Alembic.**
This is explicit in both `design.md` (docker-compose mounts) and `tasks.md` (1.5).

## 4. Bootstrap mechanism for the first verified user

`/admin/verification-requests` endpoints require the `verified` role to
approve anyone — there is no in-API path to create the very first verified
user. Neither `requirements.md` nor `design.md` defines one, so add both:

- A seeded verified user in `seed.sql` for local development.
- A `BOOTSTRAP_ADMIN_EMAIL` env var checked at startup — if a user registers
  with that email, they are automatically elevated to `verified`. Needed for
  production where seed data won't run.

## 5. JWT expiry & refresh tokens

`JWT_EXPIRY_HOURS` is already specified in `design.md`'s env var table,
default `24`. Keep it env-configurable as already planned.

Additionally: consider adding a **refresh token mechanism** if not already
planned, since forcing re-login every 24h may hurt engagement for a
community app used intermittently. This is a suggestion, not a hard spec
requirement — flag it as a v1.1 candidate if it adds too much scope now.

## 6. Image validation: magic bytes

Validate uploaded images by **magic bytes** (file signature), not by trusting
the `Content-Type` header — already stated in `design.md`'s Security
Considerations and `tasks.md` (3.1).

## 7. Exact vs. blurred coordinates: separate columns, same table

Keep `location` (exact) and `blurred_location` (blurred) as **separate
columns on the same table** — this is the literal schema in `design.md` for
both `sightings` and `feeding_spots`.

- **Requirement 12.3** formally requires exact coordinates to be persisted
  for *all* location-bearing entities — this applies to `feeding_spots` too,
  not just `sightings`.
- The original functional spec (`2026-06-24-cat-tracker-design.md`) states
  location fidelity is preserved *"for future authorized workflows... not
  part of the v1 product scope."* This confirms: **store it, but don't build
  any endpoint, role, or feature in v1 that exposes or acts on the exact
  coordinate** — storage only.
- Response serializers must **never** include the exact `location` column in
  any public-facing schema — only `blurred_location` is ever returned by
  public API responses.

## 8. Similarity threshold

`SIMILARITY_THRESHOLD` is already in `design.md`'s env var table, default
`0.65`. Confirmed, no change needed.

## 9. MegaDescriptor model identifier — and a doc typo to fix

Use `hf-hub:BVRA/MegaDescriptor-T-224` exactly as coded in `design.md`'s
`EmbeddingService` and the `docker-compose.yml` / Dockerfile.

**Note:** `design.md`'s prose (Component Breakdown table) incorrectly
labels this as *"MegaDescriptor (ViT-B/14)"* — the actual code and
`tasks.md` (line 344) both confirm it's the **Swin-Tiny** architecture
(`MegaDescriptor-T-224`, `swin_tiny_patch4_window7_224`). Follow the code,
not the prose label. Feel free to fix this typo in `design.md` directly
while working in that area.

Flagged as a **future upgrade candidate** (e.g. `MegaDescriptor-L` or
`MegaDescriptor-DINOv2-518`) if v1 matching accuracy proves insufficient
post-launch — no action needed now, just noted for later.

## 10. Model loading: eager at startup

Load the MegaDescriptor model **eagerly**, at FastAPI startup via a
`lifespan` event — not lazily on first request. The Dockerfile already
pre-downloads model weights at build time specifically to avoid cold-start
delays; lazy loading would waste that optimization and cause first-request
latency spikes.

## 11. Copy sighting metadata to new cat profile on "none of these"

Yes — when a user selects "none of these," copy the originating sighting's
metadata (`coat_color`, `pattern_type`, `notable_markings`, `ear_tip_status`,
`body_size`) to the new `cat_profiles` row. This is **Property 24** in
`design.md` — a formal correctness property, not just a preference.

## 12. Default cat name: nullable in DB, "Unknown" at display layer only

Store `name` as **nullable** in `cat_profiles`. Do **not** default it to the
string `"Unknown"` in the database.

Per the existing match-candidate code in `design.md` (`name=row["name"] or
"Unknown"`), `"Unknown"` is a **display-layer fallback** used when rendering
match candidates — apply the same pattern everywhere a cat name is shown:
render `"Unknown"` (or a frontend-localized equivalent) only when `name IS
NULL`, never store it as a real value.

## 13. Design tokens: TypeScript source of truth, Tailwind extends it

Define design tokens as **standalone TypeScript constants** (`tokens.ts`) as
the single source of truth, then **extend** `tailwind.config.js` from those
constants. This allows reuse in contexts Tailwind classes can't reach (inline
SVG colors, chart libraries, dynamic JS styles) while keeping one source of
truth.

## 14. Map library: Leaflet

Use **Leaflet**, not MapLibre GL. `design.md`'s architecture diagram lists
"Leaflet/MapLibre GL" with Leaflet first; it's lighter weight, has mature
clustering plugins (`react-leaflet`, `leaflet.markercluster`), and v1's scope
(marker clustering + popups, no custom vector tile styling) doesn't need
MapLibre's extra capability.

---

## Branching & execution workflow

- **Base branch:** `main` — all feature branches fork from `main`.
- **One feature = one branch = one PR.** No bundling multiple features into
  one branch.
- Commit convention: `feat:`, `fix:`, `chore:`, `test:`, `docs:` — small,
  logical commits. Not one giant commit per feature.
- Run lint + tests before each commit.
- After each feature: **stop, report back for review.** Merge to `main` only
  with explicit approval, then start the next branch.
- Update `tasks.md` checkboxes for completed items after each feature.

### Feature execution order

Follow the 15-feature linear breakdown (scaffolding → auth/RBAC → image &
coordinates → matching pipeline → sighting submission → map & cat endpoints →
feeding/TNR/reports → frontend design system → frontend auth pages →
frontend map/cats → frontend sighting wizard → frontend cat editing →
frontend feeding/TNR/reports → frontend error handling → integration testing).

`tasks.md` also defines a more granular **10-wave dependency graph** that
allows some tasks to run in parallel (e.g. Wave 1: tasks 1.4, 1.5, 2.1, 3.1,
3.3 can all start once Wave 0 finishes). Since this is solo, one-branch-at-a-
time work, **keep the linear 15-feature order** as the execution plan, but
use the wave graph as a sanity check when sequencing — if a later feature's
tasks don't actually depend on an earlier one per the wave graph, flag it so
the order can be adjusted for speed.

---

## 15. `status_tags` on cat profile: folded/derived, not a new column

**Investigated and resolved — no schema change needed.**

The original functional spec (`2026-06-24-cat-tracker-design.md`, "Core
Entities → Cat profile", and `requirements.md` line 50) lists "status tags"
as a field on the cat profile itself, separate from TNR status. The final
SQL schema in `design.md` has **no `status_tags` column** on `cat_profiles`
— only `condition_tags` at the **sighting** level. `design.md`'s own GET
`/cats/{cat_id}` response example (line 479) returns `"status_tags": [...]`
with no backing column, which is what surfaced the gap.

**Decision: treat `status_tags` as computed/derived, not stored.**

The cat profile GET endpoint (`GET /api/v1/cats/{cat_id}`) computes
`status_tags` at read time as the aggregated, deduplicated union of
`condition_tags` across all of that cat's confirmed sightings. **No new
column, no migration.**

**Why not a new independent column (the alternative considered):**

- There is no permission model anywhere in `requirements.md` for who could
  edit a standalone profile-level status field — unlike TNR status, which
  has a full requirement set (6 enum values, verified-only, audit trail via
  `reviewed_by`/`reviewed_at`). Adding a freely-editable profile field would
  introduce an ungated write path that contradicts the product principle
  that *"sensitive updates are controlled by role, not posting history"*.
- The functional spec itself is loose with this term — it says *"at least
  one structured condition **or** status tag"* (lines 93, 170) when
  describing a single sighting requirement, suggesting "condition tag" and
  "status tag" were used interchangeably by the spec's author, not as two
  distinct concepts.
- Keeps v1 scope lightweight, consistent with the spec's own boundary that
  v1 avoids heavy admin/back-office mechanisms and unnecessary new
  mutable surfaces.

**Action for `design.md`:** keep the `"status_tags": [...]` field in the
GET response example, but document it as a *computed/derived* field, not a
stored column.

**Future consideration:** if a genuinely independent, persistently-editable
welfare label is wanted later (e.g. "friendly", "needs socialization", set
by trusted users outside of sighting submissions), treat that as a v1.1
feature with its own requirement definition — including a permission model
— rather than retrofitting it into v1.

---

## Things explicitly out of scope for v1 (do not build)

Per the functional spec's "Not included in v1" section — do not build any of
the following, even if they seem like natural extensions of a feature being
implemented:

1. Fully automatic cat identity resolution (matching is always advisory,
   user-confirmed — see Property 10).
2. Anonymous posting.
3. Pre-publication moderation queues (publish-first model only).
4. Private caretaker notes.
5. Task assignment or volunteer operations management.
6. Heavy admin back-office workflows (verification API is intentionally
   minimal, no admin UI per `requirements.md` 3.7).
7. Trust scoring based on reputation or algorithm/match confidence.
8. Any endpoint, role, or feature that exposes or acts on **exact**
   coordinates — they're stored for unspecified future workflows only.
9. Using embedding/matching confidence scores for automated content
   moderation decisions (Property 14, Requirement 10.5) — CV output is
   advisory only, never a permission or moderation authority.
