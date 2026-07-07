import asyncpg
from fastapi import APIRouter, Depends, Response, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.core.rbac import require_authenticated
from app.db.pool import get_db
from app.models.user import User
from app.services.auth_service import (
    delete_account,
    login,
    register,
    submit_verification_request,
    update_avatar,
    update_email,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

COOKIE_SECURE = settings.ENVIRONMENT == "production"


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyRequest(BaseModel):
    evidence: str


class UpdateEmailRequest(BaseModel):
    email: str
    current_password: str


class DeleteAccountRequest(BaseModel):
    current_password: str


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
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=settings.JWT_EXPIRY_HOURS * 3600,
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
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=settings.JWT_EXPIRY_HOURS * 3600,
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


@router.get("/me")
async def me_endpoint(
    user: User = Depends(require_authenticated),
) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role.value,
        "avatar_url": user.avatar_url,
    }


@router.patch("/me/email")
async def update_email_endpoint(
    body: UpdateEmailRequest,
    user: User = Depends(require_authenticated),
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    updated = await update_email(db, user.id, body.email, body.current_password)
    return {
        "id": updated.id,
        "email": updated.email,
        "role": updated.role.value,
        "avatar_url": updated.avatar_url,
    }


@router.post("/me/avatar")
async def update_avatar_endpoint(
    image: UploadFile,
    user: User = Depends(require_authenticated),
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    updated = await update_avatar(db, user.id, image)
    return {
        "id": updated.id,
        "email": updated.email,
        "role": updated.role.value,
        "avatar_url": updated.avatar_url,
    }


@router.delete("/me")
async def delete_account_endpoint(
    body: DeleteAccountRequest,
    response: Response,
    user: User = Depends(require_authenticated),
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    await delete_account(db, user.id, body.current_password)
    response.delete_cookie("access_token")
    return {"message": "Account deleted"}
