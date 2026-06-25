import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from app.core.config import settings

_pool: asyncpg.Pool | None = None


async def init_db_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_db_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def get_db() -> AsyncGenerator[asyncpg.Pool, None]:
    pool = await init_db_pool()
    yield pool


@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = await init_db_pool()
    async with pool.acquire() as conn:
        yield conn
