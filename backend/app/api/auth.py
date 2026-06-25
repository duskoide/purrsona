import asyncpg
from fastapi import APIRouter, Depends, Response

from app.db.pool import get_db
from app.models.user import User
from app.core.rbac import require_authenticated
from app.services.auth_service import register, login, submit_verification_request
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyRequest(BaseModel):
    evidence: str


@router.post("/register", status_code=201)
async def register_endpoint(
    body: RegisterRequest,
    response: Response,
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    user, token = await register(db, body.email, body.password)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400,
    )

    return {"user_id": user.id}


@router.post("/login")
async def login_endpoint(
    body: LoginRequest,
    response: Response,
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    user, token = await login(db, body.email, body.password)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400,
    )

    return {"role": user.role.value}


@router.post("/verify-request", status_code=202)
async def verify_request_endpoint(
    body: VerifyRequest,
    user: User = Depends(require_authenticated),
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    await submit_verification_request(db, user.id, body.evidence)
    return {"message": "Verification request submitted"}


@router.post("/logout")
async def logout_endpoint(response: Response) -> dict:
    response.delete_cookie("access_token")
    return {"message": "Logged out"}
