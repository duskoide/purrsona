import uuid
from collections.abc import AsyncGenerator

import asyncpg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.db import pool as pool_module

TEST_DATABASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/purrsona_test"

TABLES_TO_TRUNCATE = [
    "content_reports",
    "verification_requests",
    "tnr_records",
    "feeding_spots",
    "sightings",
    "sighting_drafts",
    "cat_profiles",
    "users",
]


@pytest_asyncio.fixture
async def db_pool() -> AsyncGenerator[asyncpg.Pool, None]:
    pool = await asyncpg.create_pool(TEST_DATABASE_URL, min_size=2, max_size=10)
    yield pool
    await pool.close()


@pytest_asyncio.fixture
async def clean_db(db_pool: asyncpg.Pool) -> AsyncGenerator[None, None]:
    async with db_pool.acquire() as conn:
        for table in TABLES_TO_TRUNCATE:
            await conn.execute(f"TRUNCATE {table} CASCADE")
    yield


@pytest_asyncio.fixture
async def app(db_pool: asyncpg.Pool, clean_db: None):
    from app.main import app as fastapi_app

    pool_module._pool = db_pool
    fastapi_app.router.lifespan_context = None
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
async def auth_client(app) -> AsyncGenerator[tuple[AsyncClient, dict], None]:
    email = "testuser@purrsona.local"
    transport = ASGITransport(app=app)
    ac = AsyncClient(transport=transport, base_url="http://test")
    user_data = await _register_user(ac, email)
    await _login_user(ac, email)
    yield ac, user_data
    await ac.aclose()


@pytest_asyncio.fixture
async def verified_client(app, db_pool: asyncpg.Pool) -> AsyncGenerator[tuple[AsyncClient, dict], None]:
    email = "verified@purrsona.local"
    transport = ASGITransport(app=app)
    ac = AsyncClient(transport=transport, base_url="http://test")
    user_data = await _register_user(ac, email)
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET role = 'verified', verified_at = NOW() WHERE id = $1",
            user_data["user_id"],
        )
    await _login_user(ac, email)
    yield ac, user_data
    await ac.aclose()


@pytest_asyncio.fixture
async def second_auth_client(app) -> AsyncGenerator[tuple[AsyncClient, dict], None]:
    email = "other@purrsona.local"
    transport = ASGITransport(app=app)
    ac = AsyncClient(transport=transport, base_url="http://test")
    user_data = await _register_user(ac, email)
    await _login_user(ac, email)
    yield ac, user_data
    await ac.aclose()
