import re

import asyncpg
from fastapi import HTTPException

from app.core.security import hash_password, verify_password, create_token
from app.models.user import User, UserRole

EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


async def register(db: asyncpg.Pool, email: str, password: str) -> tuple[User, str]:
    email = email.strip().lower()

    if not EMAIL_RE.match(email):
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "status_code": 422,
                    "error_type": "validation_error",
                    "message": "Invalid email format",
                    "details": [{"field": "email", "message": "Invalid email format"}],
                }
            },
        )

    if len(password) < 8:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "status_code": 422,
                    "error_type": "validation_error",
                    "message": "Password must be at least 8 characters",
                    "details": [
                        {"field": "password", "message": "Password must be at least 8 characters"}
                    ],
                }
            },
        )

    existing = await db.fetchrow("SELECT id FROM users WHERE email = $1", email)
    if existing:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "status_code": 422,
                    "error_type": "validation_error",
                    "message": "Email already registered",
                    "details": [{"field": "email", "message": "Email already registered"}],
                }
            },
        )

    password_hash = hash_password(password)
    row = await db.fetchrow(
        """INSERT INTO users (email, password_hash, role)
           VALUES ($1, $2, 'signed_in')
           RETURNING id, email, role, created_at, verified_at""",
        email,
        password_hash,
    )

    user = User.from_row(row)
    token = create_token(user.id, user.email, user.role)
    return user, token


async def login(db: asyncpg.Pool, email: str, password: str) -> tuple[User, str]:
    email = email.strip().lower()

    row = await db.fetchrow(
        "SELECT id, email, password_hash, role, created_at, verified_at FROM users WHERE email = $1",
        email,
    )

    if row is None or not verify_password(password, row["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "status_code": 401,
                    "error_type": "authentication_required",
                    "message": "Invalid email or password",
                }
            },
        )

    user = User.from_row(row)
    token = create_token(user.id, user.email, user.role)
    return user, token


async def submit_verification_request(
    db: asyncpg.Pool, user_id: str, evidence: str
) -> None:
    existing = await db.fetchrow(
        "SELECT id FROM verification_requests WHERE user_id = $1 AND status = 'pending'",
        user_id,
    )
    if existing:
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "status_code": 422,
                    "error_type": "validation_error",
                    "message": "You already have a pending verification request",
                }
            },
        )

    await db.execute(
        """INSERT INTO verification_requests (user_id, evidence, status)
           VALUES ($1, $2, 'pending')""",
        user_id,
        evidence,
    )


async def list_verification_requests(
    db: asyncpg.Pool, status: str | None = None
) -> list[dict]:
    if status:
        rows = await db.fetch(
            """SELECT id, user_id, evidence, status, created_at
               FROM verification_requests WHERE status = $1 ORDER BY created_at DESC""",
            status,
        )
    else:
        rows = await db.fetch(
            """SELECT id, user_id, evidence, status, created_at
               FROM verification_requests ORDER BY created_at DESC"""
        )
    return [dict(row) for row in rows]


async def review_verification_request(
    db: asyncpg.Pool, request_id: str, reviewer_id: str, decision: str
) -> dict:
    if decision not in ("approved", "rejected"):
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "status_code": 422,
                    "error_type": "validation_error",
                    "message": "Decision must be 'approved' or 'rejected'",
                    "details": [
                        {"field": "status", "message": "Must be 'approved' or 'rejected'"}
                    ],
                }
            },
        )

    row = await db.fetchrow(
        "SELECT id, user_id, status FROM verification_requests WHERE id = $1",
        request_id,
    )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "status_code": 404,
                    "error_type": "not_found",
                    "message": "Verification request not found",
                }
            },
        )

    if row["status"] != "pending":
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "status_code": 422,
                    "error_type": "validation_error",
                    "message": "This request has already been reviewed",
                }
            },
        )

    updated = await db.fetchrow(
        """UPDATE verification_requests
           SET status = $1, reviewed_by = $2, reviewed_at = NOW()
           WHERE id = $3
           RETURNING id, user_id, status, reviewed_by, reviewed_at""",
        decision,
        reviewer_id,
        request_id,
    )

    if decision == "approved":
        await db.execute(
            "UPDATE users SET role = 'verified', verified_at = NOW() WHERE id = $1",
            row["user_id"],
        )

    return dict(updated)


async def bootstrap_admin(db: asyncpg.Pool, email: str | None) -> None:
    """Promote the bootstrap admin user to verified role if they exist."""
    if email is None:
        return

    email = email.strip().lower()
    result = await db.execute(
        "UPDATE users SET role = 'verified', verified_at = NOW() WHERE email = $1 AND role != 'verified'",
        email,
    )
    if result == "UPDATE 1":
        print(f"Bootstrap: promoted {email} to verified role")
