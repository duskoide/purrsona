from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import HTTPException
from jose import JWTError, jwt

from app.core.config import settings
from app.core.error_handlers import error_response
from app.models.user import UserRole


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str, email: str, role: UserRole) -> str:
    now = datetime.now(UTC)
    expire = now + timedelta(hours=settings.JWT_EXPIRY_HOURS)
    claims = {
        "sub": user_id,
        "email": email,
        "role": role.value,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(claims, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except JWTError as err:
        raise HTTPException(
            status_code=401,
            detail=error_response(401, "Invalid or expired token"),
        ) from err
