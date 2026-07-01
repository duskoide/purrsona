import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.matching import router as matching_router
from app.core.config import settings
from app.core.error_handlers import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.rate_limit import RateLimitMiddleware
from app.db.pool import close_db_pool, init_db_pool
from app.services.auth_service import bootstrap_admin
from app.services.embedding_service import embedding_service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    pool = await init_db_pool()
    await bootstrap_admin(pool, settings.BOOTSTRAP_ADMIN_EMAIL)
    await asyncio.to_thread(embedding_service.load_model)
    yield
    await close_db_pool()


app = FastAPI(
    title="Purrsona API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(RateLimitMiddleware)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(matching_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
