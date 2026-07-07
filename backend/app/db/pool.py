import ssl
from collections.abc import AsyncGenerator

import asyncpg

from app.core.config import settings

_pool: asyncpg.Pool | None = None


def _build_ssl_context() -> ssl.SSLContext | bool:
    """Build the SSL context asyncpg expects.

    RDS (and most managed Postgres) require TLS. asyncpg's `ssl` kwarg
    takes True/False/None or an ssl.SSLContext — not a "sslmode" string —
    so DATABASE_SSL_MODE="require" is translated here rather than passed
    straight through.
    """
    if settings.DATABASE_SSL_MODE != "require":
        return False
    return ssl.create_default_context()


async def init_db_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            settings.DATABASE_URL,
            min_size=2,
            max_size=10,
            ssl=_build_ssl_context(),
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
