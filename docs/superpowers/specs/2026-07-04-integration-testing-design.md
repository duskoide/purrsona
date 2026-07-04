# Integration Testing Design

## Overview

Backend API integration tests for Purrsona v1. All 16 endpoints tested against a real PostgreSQL database with transaction rollback for isolation.

## Scope

- Backend API only (no frontend tests)
- Happy paths + error cases (auth failures, RBAC violations, validation errors, missing resources)
- Same Docker Compose Postgres container, separate `purrsona_test` database
- Transaction rollback per test for isolation

## Architecture

### Test Files

```
backend/tests/
├── conftest.py          # Shared fixtures (db, client, auth helpers)
├── test_health.py       # Health endpoint
├── test_auth.py         # Register, login, logout, me, verify-request
├── test_cats.py         # Cat CRUD + filters
├── test_sightings.py    # Initiate + confirm flow
├── test_matching.py     # Image matching
├── test_map.py          # Map markers
├── test_feeding.py      # Feeding spots, TNR records, reports
└── test_admin.py        # Admin verification flow
```

### Fixtures

| Fixture | Scope | Purpose |
|---------|-------|---------|
| `db_pool` | session | asyncpg pool → `purrsona_test` database |
| `db_conn` | function | Acquires conn, starts transaction, yields, rolls back |
| `app` | function | FastAPI app wired with test db pool |
| `client` | function | httpx.AsyncClient (unauthenticated) |
| `auth_client` | function | Registered user with `signed_in` role, returns (client, user) |
| `verified_client` | function | User promoted to `verified` role |

### Transaction Rollback Pattern

```python
@pytest.fixture
async def db_conn(db_pool):
    async with db_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        yield conn
        await tx.rollback()
```

## Test Coverage

### test_health.py
- `GET /health` → 200 ok

### test_auth.py
- Register → 200, sets cookie, returns user_id
- Register duplicate email → 409
- Register missing fields → 422
- Login → 200, sets cookie
- Login wrong password → 401
- Login nonexistent user → 401
- Logout → 200, clears cookie
- `GET /auth/me` authenticated → 200 user info
- `GET /auth/me` unauthenticated → 401
- Verify-request → 200, creates pending request
- Verify-request duplicate → 409

### test_cats.py
- `GET /cats` → 200, paginated list
- `GET /cats` with filters (coat, pattern, tnr_status) → 200 filtered
- `GET /cats/{id}` → 200 full profile
- `GET /cats/{id}` nonexistent → 404
- `PATCH /cats/{id}` authenticated → 200 updated
- `PATCH /cats/{id}` unauthenticated → 401
- `PATCH /cats/{id}` nonexistent → 404

### test_sightings.py
- Initiate with image + coords → 200, returns draft + matches
- Initiate unauthenticated → 401
- Initiate missing image → 422
- Confirm with cat_id → 200, creates sighting
- Confirm with cat_id=None → 200, creates new cat
- Confirm invalid draft_id → 404
- Confirm expired draft → 410

### test_matching.py
- Match with image → 200, returns candidates
- Match unauthenticated → 401
- Match with filters → 200 filtered results

### test_map.py
- `GET /map` with bbox → 200, returns markers
- `GET /map` missing bbox → 422
- `GET /map` empty area → 200, empty lists

### test_feeding.py
- Create feeding spot → 200
- Create feeding spot unauthenticated → 401
- Create TNR record → 200
- Create TNR with status_change as signed_in → 403
- Create TNR with status_change as verified → 200
- Create report → 200
- Create report invalid content_type → 422

### test_admin.py
- List verification requests as verified → 200
- List verification requests as signed_in → 403
- Approve request → 200, user promoted
- Reject request → 200
- Approve nonexistent → 404

## Dependencies

- `httpx` — async test client for FastAPI (add to pyproject.toml dev extras)

## Running Tests

```bash
# From backend/
pytest                    # All tests
pytest test_auth.py       # Single file
pytest -k "login"         # Pattern match
pytest -v                 # Verbose
```

## Environment

Tests read `DATABASE_URL` from env, defaulting to `postgresql://purrsona:purrsona@localhost:5432/purrsona_test`. conftest.py overrides the app's DB pool with the test connection.

## Setup

One-time manual step: create `purrsona_test` database on the Docker Postgres container.

```sql
CREATE DATABASE purrsona_test;
```

Then run migrations against it.
