# Integration Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend API integration tests covering all 16 endpoints with happy paths and error cases.

**Architecture:** pytest + httpx AsyncClient hitting a real PostgreSQL test database. Transaction rollback per test for isolation. Mock S3 and ML model to avoid external dependencies.

**Tech Stack:** pytest, pytest-asyncio, httpx, asyncpg

---

## File Structure

| File | Purpose |
|------|---------|
| `backend/tests/conftest.py` | Shared fixtures: db pool, app client, auth helpers |
| `backend/tests/test_health.py` | Health endpoint |
| `backend/tests/test_auth.py` | Register, login, logout, me, verify-request |
| `backend/tests/test_cats.py` | Cat list, detail, update |
| `backend/tests/test_sightings.py` | Initiate + confirm flow |
| `backend/tests/test_matching.py` | Image matching |
| `backend/tests/test_map.py` | Map markers |
| `backend/tests/test_feeding.py` | Feeding spots, TNR records, reports |
| `backend/tests/test_admin.py` | Admin verification flow |

---

## Task 1: Add httpx dependency and create test database

**Files:**
- Modify: `backend/pyproject.toml`

- [ ] **Step 1: Add httpx to dev dependencies**

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8,<9",
    "pytest-asyncio>=0.23,<1",
    "httpx>=0.27,<1",
    "ruff>=0.4,<1",
    "mypy>=1.10,<2",
]
```

- [ ] **Step 2: Create test database**

Run from host (assuming Docker Postgres is running on port 5432):

```bash
docker compose exec db psql -U purrsona -c "CREATE DATABASE purrsona_test;"
```

Expected: `CREATE DATABASE`

- [ ] **Step 3: Run migrations against test database**

```bash
docker compose exec db psql -U purrsona -d purrsona_test -f /docker-entrypoint-initdb.d/001_initial.sql
```

If the migration file isn't mounted, run directly:

```bash
psql -h localhost -U purrsona -d purrsona_test -f backend/migrations/001_initial.sql
```

Expected: No errors.

- [ ] **Step 4: Install httpx**

```bash
cd backend && pip install -e ".[dev]"
```

Expected: httpx installed.

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml
git commit -m "test: add httpx dependency for integration tests"
```

---

## Task 2: Create conftest.py with shared fixtures

**Files:**
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write conftest.py**

```python
import asyncio
from collections.abc import AsyncGenerator

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.security import create_token
from app.db import pool as pool_module
from app.models.user import UserRole

TEST_DATABASE_URL = settings.DATABASE_URL.replace("/purrsona", "/purrsona_test")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db_pool() -> AsyncGenerator[asyncpg.Pool, None]:
    pool = await asyncpg.create_pool(TEST_DATABASE_URL, min_size=2, max_size=10)
    yield pool
    await pool.close()


@pytest_asyncio.fixture
async def db_conn(db_pool: asyncpg.Pool) -> AsyncGenerator[asyncpg.Connection, None]:
    async with db_pool.acquire() as conn:
        tx = conn.transaction()
        await tx.start()
        yield conn
        await tx.rollback()


@pytest_asyncio.fixture
async def app(db_pool: asyncpg.Pool):
    from app.main import app as fastapi_app

    pool_module._pool = db_pool
    yield fastapi_app
    pool_module._pool = None


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _register_user(client: AsyncClient, email: str, password: str = "testpass123") -> dict:
    resp = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201, f"Register failed: {resp.text}"
    return resp.json()


async def _login_user(client: AsyncClient, email: str, password: str = "testpass123") -> AsyncClient:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return client


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient, db_conn: asyncpg.Connection) -> AsyncGenerator[tuple[AsyncClient, dict], None]:
    email = "testuser@purrsona.local"
    user_data = await _register_user(client, email)
    client = await _login_user(client, email)
    yield client, user_data


@pytest_asyncio.fixture
async def verified_client(client: AsyncClient, db_conn: asyncpg.Connection) -> AsyncGenerator[tuple[AsyncClient, dict], None]:
    email = "verified@purrsona.local"
    user_data = await _register_user(client, email)
    await db_conn.execute(
        "UPDATE users SET role = 'verified', verified_at = NOW() WHERE id = $1",
        user_data["user_id"],
    )
    client = await _login_user(client, email)
    yield client, user_data


@pytest_asyncio.fixture
async def second_auth_client(client: AsyncClient, db_conn: asyncpg.Connection) -> AsyncGenerator[tuple[AsyncClient, dict], None]:
    email = "other@purrsona.local"
    user_data = await _register_user(client, email)
    client = await _login_user(client, email)
    yield client, user_data
```

- [ ] **Step 2: Verify conftest loads**

```bash
cd backend && python -m pytest tests/ --collect-only 2>&1 | head -20
```

Expected: No import errors.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/conftest.py
git commit -m "test: add conftest with db pool, client, auth fixtures"
```

---

## Task 3: test_health.py

**Files:**
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write test_health.py**

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test**

```bash
cd backend && python -m pytest tests/test_health.py -v
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_health.py
git commit -m "test: add health endpoint test"
```

---

## Task 4: test_auth.py

**Files:**
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write test_auth.py**

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "email": "newuser@purrsona.local",
        "password": "testpass123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "user_id" in data
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json={
        "email": "dupe@purrsona.local",
        "password": "testpass123",
    })
    resp = await client.post("/api/v1/auth/register", json={
        "email": "dupe@purrsona.local",
        "password": "testpass123",
    })
    assert resp.status_code == 422
    assert "already registered" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "email": "short@purrsona.local",
        "password": "abc",
    })
    assert resp.status_code == 422
    assert "8 characters" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "email": "not-an-email",
        "password": "testpass123",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json={
        "email": "login@purrsona.local",
        "password": "testpass123",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "login@purrsona.local",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    assert resp.json()["role"] == "signed_in"
    assert "access_token" in resp.cookies


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    await client.post("/api/v1/auth/register", json={
        "email": "wrong@purrsona.local",
        "password": "testpass123",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "wrong@purrsona.local",
        "password": "badpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/login", json={
        "email": "ghost@purrsona.local",
        "password": "testpass123",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out"


@pytest.mark.asyncio
async def test_me_authenticated(auth_client: tuple[AsyncClient, dict]) -> None:
    client, user_data = auth_client
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == user_data["user_id"]
    assert data["email"] == "testuser@purrsona.local"
    assert data["role"] == "signed_in"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_verify_request(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/auth/verify-request", json={
        "evidence": "I volunteer at a local cat shelter",
    })
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_verify_request_duplicate(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    await client.post("/api/v1/auth/verify-request", json={
        "evidence": "First request",
    })
    resp = await client.post("/api/v1/auth/verify-request", json={
        "evidence": "Second request",
    })
    assert resp.status_code == 422
    assert "pending" in resp.json()["error"]["message"].lower()
```

- [ ] **Step 2: Run tests**

```bash
cd backend && python -m pytest tests/test_auth.py -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_auth.py
git commit -m "test: add auth endpoint tests"
```

---

## Task 5: test_cats.py

**Files:**
- Create: `backend/tests/test_cats.py`

- [ ] **Step 1: Write test_cats.py**

```python
import pytest
from httpx import AsyncClient

import asyncpg


async def _create_test_cat(db_conn: asyncpg.Connection) -> str:
    """Insert a test cat and return its ID."""
    row = await db_conn.fetchrow(
        """INSERT INTO cat_profiles (name, coat_color, pattern_type, body_size, ear_tip_status)
           VALUES ('Test Cat', 'black', 'tabby', 'medium', false)
           RETURNING id"""
    )
    return str(row["id"])


@pytest.mark.asyncio
async def test_cats_list(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/cats")
    assert resp.status_code == 200
    data = resp.json()
    assert "cats" in data
    assert "total" in data
    assert "page" in data
    assert "per_page" in data


@pytest.mark.asyncio
async def test_cats_list_with_filters(client: AsyncClient, db_conn: asyncpg.Connection) -> None:
    await _create_test_cat(db_conn)
    resp = await client.get("/api/v1/cats", params={
        "coat_color": "black",
        "pattern_type": "tabby",
        "tnr_status": "unassessed",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert all(c["coat_color"] == "black" for c in data["cats"])


@pytest.mark.asyncio
async def test_cats_list_invalid_filter(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/cats", params={"coat_color": "invalid"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_cat_detail(client: AsyncClient, db_conn: asyncpg.Connection) -> None:
    cat_id = await _create_test_cat(db_conn)
    resp = await client.get(f"/api/v1/cats/{cat_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == cat_id
    assert data["coat_color"] == "black"
    assert "status_tags" in data
    assert "sighting_history" in data
    assert "tnr_records" in data


@pytest.mark.asyncio
async def test_cat_detail_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/cats/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cat_update(auth_client: tuple[AsyncClient, dict], db_conn: asyncpg.Connection) -> None:
    client, _ = auth_client
    cat_id = await _create_test_cat(db_conn)
    resp = await client.patch(f"/api/v1/cats/{cat_id}", json={
        "name": "Updated Cat",
        "coat_color": "orange",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Cat"
    assert data["coat_color"] == "orange"


@pytest.mark.asyncio
async def test_cat_update_unauthenticated(client: AsyncClient, db_conn: asyncpg.Connection) -> None:
    cat_id = await _create_test_cat(db_conn)
    resp = await client.patch(f"/api/v1/cats/{cat_id}", json={"name": "Nope"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_cat_update_not_found(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.patch("/api/v1/cats/00000000-0000-0000-0000-000000000000", json={
        "name": "Ghost",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_cat_update_invalid_field(auth_client: tuple[AsyncClient, dict], db_conn: asyncpg.Connection) -> None:
    client, _ = auth_client
    cat_id = await _create_test_cat(db_conn)
    resp = await client.patch(f"/api/v1/cats/{cat_id}", json={
        "coat_color": "plaid",
    })
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests**

```bash
cd backend && python -m pytest tests/test_cats.py -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_cats.py
git commit -m "test: add cats endpoint tests"
```

---

## Task 6: test_map.py

**Files:**
- Create: `backend/tests/test_map.py`

- [ ] **Step 1: Write test_map.py**

```python
import pytest
from httpx import AsyncClient

import asyncpg


async def _create_sighting(db_conn: asyncpg.Connection, cat_id: str, user_id: str) -> str:
    """Insert a test sighting."""
    row = await db_conn.fetchrow(
        """INSERT INTO sightings (cat_profile_id, user_id, photo_url, location, blurred_location,
           observed_at, condition_tags, coat_color, pattern_type)
           VALUES ($1, $2, 'http://test/photo.jpg',
           ST_SetSRID(ST_MakePoint(121.0, 14.5), 4326),
           ST_SetSRID(ST_MakePoint(121.001, 14.501), 4326),
           NOW(), '["friendly"]'::jsonb, 'black', 'tabby')
           RETURNING id""",
        cat_id, user_id,
    )
    return str(row["id"])


async def _create_feeding_spot(db_conn: asyncpg.Connection, user_id: str) -> str:
    """Insert a test feeding spot."""
    row = await db_conn.fetchrow(
        """INSERT INTO feeding_spots (user_id, location, blurred_location, details)
           VALUES ($1,
           ST_SetSRID(ST_MakePoint(121.0, 14.5), 4326),
           ST_SetSRID(ST_MakePoint(121.001, 14.501), 4326),
           '{"notes": "daily feeding"}'::jsonb)
           RETURNING id""",
        user_id,
    )
    return str(row["id"])


@pytest.mark.asyncio
async def test_map_markers(client: AsyncClient, db_conn: asyncpg.Connection) -> None:
    # Create a user first
    user_row = await db_conn.fetchrow(
        "INSERT INTO users (email, password_hash) VALUES ('mapuser@test.local', 'hash') RETURNING id"
    )
    user_id = str(user_row["id"])

    # Create a cat
    cat_row = await db_conn.fetchrow(
        "INSERT INTO cat_profiles (name, coat_color, pattern_type) VALUES ('Map Cat', 'black', 'tabby') RETURNING id"
    )
    cat_id = str(cat_row["id"])

    await _create_sighting(db_conn, cat_id, user_id)
    await _create_feeding_spot(db_conn, user_id)

    resp = await client.get("/api/v1/map", params={
        "min_lat": 14.0,
        "min_lng": 120.5,
        "max_lat": 15.0,
        "max_lng": 121.5,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "sightings" in data
    assert "feeding_spots" in data
    assert len(data["sightings"]) >= 1
    assert len(data["feeding_spots"]) >= 1


@pytest.mark.asyncio
async def test_map_empty_area(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/map", params={
        "min_lat": -90,
        "min_lng": -180,
        "max_lat": -89,
        "max_lng": -179,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["sightings"] == []
    assert data["feeding_spots"] == []


@pytest.mark.asyncio
async def test_map_missing_bbox(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/map")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_map_invalid_bbox(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/map", params={
        "min_lat": 15.0,
        "min_lng": 120.5,
        "max_lat": 14.0,
        "max_lng": 121.5,
    })
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests**

```bash
cd backend && python -m pytest tests/test_map.py -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_map.py
git commit -m "test: add map endpoint tests"
```

---

## Task 7: test_feeding.py

**Files:**
- Create: `backend/tests/test_feeding.py`

- [ ] **Step 1: Write test_feeding.py**

```python
import pytest
from httpx import AsyncClient

import asyncpg


async def _create_user(db_conn: asyncpg.Connection, email: str) -> str:
    row = await db_conn.fetchrow(
        "INSERT INTO users (email, password_hash) VALUES ($1, 'hash') RETURNING id",
        email,
    )
    return str(row["id"])


async def _create_cat(db_conn: asyncpg.Connection, user_id: str) -> str:
    row = await db_conn.fetchrow(
        "INSERT INTO cat_profiles (name, coat_color, pattern_type, created_by) "
        "VALUES ('Feed Cat', 'black', 'tabby', $1) RETURNING id",
        user_id,
    )
    return str(row["id"])


async def _create_sighting(db_conn: asyncpg.Connection, cat_id: str, user_id: str) -> str:
    row = await db_conn.fetchrow(
        """INSERT INTO sightings (cat_profile_id, user_id, photo_url, location, blurred_location,
           observed_at, condition_tags, coat_color, pattern_type)
           VALUES ($1, $2, 'http://test/photo.jpg',
           ST_SetSRID(ST_MakePoint(121.0, 14.5), 4326),
           ST_SetSRID(ST_MakePoint(121.001, 14.501), 4326),
           NOW(), '["friendly"]'::jsonb, 'black', 'tabby')
           RETURNING id""",
        cat_id, user_id,
    )
    return str(row["id"])


@pytest.mark.asyncio
async def test_create_feeding_spot(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/feeding-spots", json={
        "latitude": 14.5,
        "longitude": 121.0,
        "details": {"notes": "near the park"},
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert "blurred_location" in data


@pytest.mark.asyncio
async def test_create_feeding_spot_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/feeding-spots", json={
        "latitude": 14.5,
        "longitude": 121.0,
        "details": {},
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_feeding_spot_invalid_coords(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/feeding-spots", json={
        "latitude": 999,
        "longitude": 121.0,
        "details": {},
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_tnr_record(auth_client: tuple[AsyncClient, dict], db_conn: asyncpg.Connection) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_conn, user_data["user_id"])
    resp = await client.post("/api/v1/tnr-records", json={
        "cat_id": cat_id,
        "content": "Cat appears healthy, no TNR needed",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["cat_id"] == cat_id
    assert data["status_change"] is None


@pytest.mark.asyncio
async def test_create_tnr_status_change_as_signed_in(auth_client: tuple[AsyncClient, dict], db_conn: asyncpg.Connection) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_conn, user_data["user_id"])
    resp = await client.post("/api/v1/tnr-records", json={
        "cat_id": cat_id,
        "content": "TNR scheduled",
        "status_change": "scheduled",
    })
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_tnr_status_change_as_verified(verified_client: tuple[AsyncClient, dict], db_conn: asyncpg.Connection) -> None:
    client, user_data = verified_client
    cat_id = await _create_cat(db_conn, user_data["user_id"])
    resp = await client.post("/api/v1/tnr-records", json={
        "cat_id": cat_id,
        "content": "TNR scheduled",
        "status_change": "scheduled",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status_change"] == "scheduled"


@pytest.mark.asyncio
async def test_create_tnr_cat_not_found(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/tnr-records", json={
        "cat_id": "00000000-0000-0000-0000-000000000000",
        "content": "Ghost cat",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_report(auth_client: tuple[AsyncClient, dict], db_conn: asyncpg.Connection) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_conn, user_data["user_id"])
    sighting_id = await _create_sighting(db_conn, cat_id, user_data["user_id"])
    resp = await client.post("/api/v1/reports", json={
        "content_type": "sighting",
        "content_id": sighting_id,
        "reason": "inaccurate",
        "details": "Wrong location",
    })
    assert resp.status_code == 201
    assert "id" in resp.json()


@pytest.mark.asyncio
async def test_create_report_invalid_content_type(auth_client: tuple[AsyncClient, dict], db_conn: asyncpg.Connection) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_conn, user_data["user_id"])
    sighting_id = await _create_sighting(db_conn, cat_id, user_data["user_id"])
    resp = await client.post("/api/v1/reports", json={
        "content_type": "invalid_type",
        "content_id": sighting_id,
        "reason": "inaccurate",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_report_invalid_reason(auth_client: tuple[AsyncClient, dict], db_conn: asyncpg.Connection) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_conn, user_data["user_id"])
    sighting_id = await _create_sighting(db_conn, cat_id, user_data["user_id"])
    resp = await client.post("/api/v1/reports", json={
        "content_type": "sighting",
        "content_id": sighting_id,
        "reason": "invalid_reason",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_report_content_not_found(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/reports", json={
        "content_type": "sighting",
        "content_id": "00000000-0000-0000-0000-000000000000",
        "reason": "inaccurate",
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_report_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/reports", json={
        "content_type": "sighting",
        "content_id": "00000000-0000-0000-0000-000000000000",
        "reason": "inaccurate",
    })
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests**

```bash
cd backend && python -m pytest tests/test_feeding.py -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_feeding.py
git commit -m "test: add feeding, TNR, and report endpoint tests"
```

---

## Task 8: test_admin.py

**Files:**
- Create: `backend/tests/test_admin.py`

- [ ] **Step 1: Write test_admin.py**

```python
import pytest
from httpx import AsyncClient

import asyncpg


@pytest.mark.asyncio
async def test_list_verification_requests_as_verified(verified_client: tuple[AsyncClient, dict]) -> None:
    client, _ = verified_client
    resp = await client.get("/api/v1/admin/verification-requests")
    assert resp.status_code == 200
    assert "requests" in resp.json()


@pytest.mark.asyncio
async def test_list_verification_requests_as_signed_in(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.get("/api/v1/admin/verification-requests")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_approve_verification_request(
    verified_client: tuple[AsyncClient, dict],
    auth_client: tuple[AsyncClient, dict],
    db_conn: asyncpg.Connection,
) -> None:
    admin_client, _ = verified_client
    user_client, user_data = auth_client

    # Submit verification request
    await user_client.post("/api/v1/auth/verify-request", json={
        "evidence": "I am a cat expert",
    })

    # Get the request
    resp = await admin_client.get("/api/v1/admin/verification-requests", params={"status": "pending"})
    requests = resp.json()["requests"]
    assert len(requests) >= 1
    request_id = requests[0]["id"]

    # Approve it
    resp = await admin_client.patch(f"/api/v1/admin/verification-requests/{request_id}", json={
        "status": "approved",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_reject_verification_request(
    verified_client: tuple[AsyncClient, dict],
    auth_client: tuple[AsyncClient, dict],
) -> None:
    admin_client, _ = verified_client
    user_client, _ = auth_client

    await user_client.post("/api/v1/auth/verify-request", json={
        "evidence": "Please verify me",
    })

    resp = await admin_client.get("/api/v1/admin/verification-requests", params={"status": "pending"})
    request_id = resp.json()["requests"][0]["id"]

    resp = await admin_client.patch(f"/api/v1/admin/verification-requests/{request_id}", json={
        "status": "rejected",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_approve_nonexistent_request(verified_client: tuple[AsyncClient, dict]) -> None:
    client, _ = verified_client
    resp = await client.patch("/api/v1/admin/verification-requests/00000000-0000-0000-0000-000000000000", json={
        "status": "approved",
    })
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests**

```bash
cd backend && python -m pytest tests/test_admin.py -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_admin.py
git commit -m "test: add admin verification endpoint tests"
```

---

## Task 9: test_sightings.py

**Files:**
- Create: `backend/tests/test_sightings.py`

Note: Sighting initiation requires S3 upload and ML model. We mock these to avoid external dependencies.

- [ ] **Step 1: Write test_sightings.py**

```python
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

import asyncpg

MOCK_PHOTO_URL = "http://localhost:9000/purrsona-images/photos/test.jpg"
MOCK_EMBEDDING = [0.0] * 768
MOCK_CANDIDATES: list = []

VALID_JPEG = b"\xff\xd8\xff" + b"\x00" * 100


async def _create_cat(db_conn: asyncpg.Connection, user_id: str) -> str:
    row = await db_conn.fetchrow(
        "INSERT INTO cat_profiles (name, coat_color, pattern_type, created_by) "
        "VALUES ('Sighting Cat', 'black', 'tabby', $1) RETURNING id",
        user_id,
    )
    return str(row["id"])


@pytest.mark.asyncio
@patch("app.services.sighting_service.upload_image", new_callable=AsyncMock, return_value=MOCK_PHOTO_URL)
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_initiate_sighting(
    mock_find: AsyncMock,
    mock_embed: AsyncMock,
    mock_upload: AsyncMock,
    auth_client: tuple[AsyncClient, dict],
) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "black",
            "pattern_type": "tabby",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "draft_id" in data
    assert "photo_url" in data
    assert "blurred_location" in data
    assert "candidates" in data


@pytest.mark.asyncio
async def test_initiate_sighting_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "black",
            "pattern_type": "tabby",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_initiate_sighting_missing_image(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/sightings/initiate", data={
        "latitude": "14.5",
        "longitude": "121.0",
        "observed_at": "2026-07-04T10:00:00",
        "condition_tags": '["friendly"]',
        "coat_color": "black",
        "pattern_type": "tabby",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_initiate_sighting_invalid_coat_color(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "plaid",
            "pattern_type": "tabby",
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
@patch("app.services.sighting_service.upload_image", new_callable=AsyncMock, return_value=MOCK_PHOTO_URL)
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_confirm_sighting_with_cat_id(
    mock_find: AsyncMock,
    mock_embed: AsyncMock,
    mock_upload: AsyncMock,
    auth_client: tuple[AsyncClient, dict],
    db_conn: asyncpg.Connection,
) -> None:
    client, user_data = auth_client
    cat_id = await _create_cat(db_conn, user_data["user_id"])

    # First initiate a draft
    initiate_resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "black",
            "pattern_type": "tabby",
        },
    )
    draft_id = initiate_resp.json()["draft_id"]

    # Confirm it
    resp = await client.post("/api/v1/sightings/confirm", json={
        "draft_id": draft_id,
        "cat_id": cat_id,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "sighting_id" in data
    assert data["cat_profile_id"] == cat_id


@pytest.mark.asyncio
@patch("app.services.sighting_service.upload_image", new_callable=AsyncMock, return_value=MOCK_PHOTO_URL)
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_confirm_sighting_new_cat(
    mock_find: AsyncMock,
    mock_embed: AsyncMock,
    mock_upload: AsyncMock,
    auth_client: tuple[AsyncClient, dict],
) -> None:
    client, _ = auth_client

    initiate_resp = await client.post(
        "/api/v1/sightings/initiate",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        data={
            "latitude": "14.5",
            "longitude": "121.0",
            "observed_at": "2026-07-04T10:00:00",
            "condition_tags": '["friendly"]',
            "coat_color": "black",
            "pattern_type": "tabby",
        },
    )
    draft_id = initiate_resp.json()["draft_id"]

    resp = await client.post("/api/v1/sightings/confirm", json={
        "draft_id": draft_id,
        "cat_id": None,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "sighting_id" in data
    assert "cat_profile_id" in data


@pytest.mark.asyncio
async def test_confirm_sighting_invalid_draft(auth_client: tuple[AsyncClient, dict]) -> None:
    client, _ = auth_client
    resp = await client.post("/api/v1/sightings/confirm", json={
        "draft_id": "00000000-0000-0000-0000-000000000000",
        "cat_id": None,
    })
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests**

```bash
cd backend && python -m pytest tests/test_sightings.py -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_sightings.py
git commit -m "test: add sighting endpoint tests with mocked S3/ML"
```

---

## Task 10: test_matching.py

**Files:**
- Create: `backend/tests/test_matching.py`

- [ ] **Step 1: Write test_matching.py**

```python
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

MOCK_EMBEDDING = [0.0] * 768
MOCK_CANDIDATES = [
    {
        "cat_id": "test-id",
        "name": "Test Cat",
        "similarity": 0.85,
        "coat_color": "black",
        "pattern_type": "tabby",
        "notable_markings": None,
    }
]

VALID_JPEG = b"\xff\xd8\xff" + b"\x00" * 100


@pytest.mark.asyncio
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_match(mock_find: AsyncMock, mock_embed: AsyncMock, auth_client: tuple) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "candidates" in data
    assert len(data["candidates"]) == 1


@pytest.mark.asyncio
async def test_match_unauthenticated(client) -> None:
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_match_invalid_image(auth_client: tuple) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.txt", b"not an image", "text/plain")},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
@patch("app.services.embedding_service.embedding_service.extract_embedding", new_callable=AsyncMock, return_value=MOCK_EMBEDDING)
@patch("app.services.embedding_service.embedding_service.find_matches", new_callable=AsyncMock, return_value=MOCK_CANDIDATES)
async def test_match_with_filters(mock_find: AsyncMock, mock_embed: AsyncMock, auth_client: tuple) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        params={"coat_color": "black", "pattern_type": "tabby"},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_match_invalid_filter(auth_client: tuple) -> None:
    client, _ = auth_client
    resp = await client.post(
        "/api/v1/matching/match",
        files={"image": ("cat.jpg", VALID_JPEG, "image/jpeg")},
        params={"coat_color": "plaid"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run tests**

```bash
cd backend && python -m pytest tests/test_matching.py -v
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_matching.py
git commit -m "test: add matching endpoint tests"
```

---

## Task 11: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
cd backend && python -m pytest tests/ -v --tb=short
```

Expected: All tests PASS.

- [ ] **Step 2: Run with coverage**

```bash
cd backend && python -m pytest tests/ -v --tb=short -q
```

Expected: Summary shows all passed.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: complete integration test suite for all API endpoints"
```

---

## Notes

- **Mocking strategy**: S3 (`upload_image`) and ML model (`embedding_service`) are mocked via `unittest.mock.patch` to avoid external dependencies. Database operations are real.
- **Transaction rollback**: Each test runs in a transaction that rolls back, ensuring isolation without truncation.
- **Test data**: Helper functions in each test file create minimal test data (users, cats, sightings) needed for the test.
- **Auth fixtures**: `auth_client` and `verified_client` provide pre-authenticated HTTP clients.
