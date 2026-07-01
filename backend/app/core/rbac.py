from fastapi import Depends, HTTPException, Request

from app.models.user import User, UserRole
from app.core.security import decode_token
from app.core.error_handlers import error_response
from app.db.pool import get_db
import asyncpg


async def get_current_user(request: Request, db: asyncpg.Pool = Depends(get_db)) -> User | None:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        return None

    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        return None

    row = await db.fetchrow(
        "SELECT id, email, role, created_at, verified_at FROM users WHERE id = $1",
        user_id,
    )
    if row is None:
        return None

    return User.from_row(row)


async def require_authenticated(
    user: User | None = Depends(get_current_user),
) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail=error_response(401, "Authentication required"))
    return user


ROLE_HIERARCHY = {
    UserRole.PUBLIC: 0,
    UserRole.SIGNED_IN: 1,
    UserRole.VERIFIED: 2,
}


def require_role(minimum_role: UserRole):
    """Dependency that enforces minimum role for an endpoint."""

    async def dependency(
        user: User = Depends(require_authenticated),
    ) -> User:
        if ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minimum_role]:
            raise HTTPException(status_code=403, detail=error_response(403, "Insufficient permissions"))
        return user

    return dependency
