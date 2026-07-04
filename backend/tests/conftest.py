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
