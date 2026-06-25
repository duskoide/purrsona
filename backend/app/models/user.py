from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    PUBLIC = "public"
    SIGNED_IN = "signed_in"
    VERIFIED = "verified"


@dataclass
class User:
    id: str
    email: str
    role: UserRole
    created_at: datetime
    verified_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict) -> "User":
        return cls(
            id=str(row["id"]),
            email=row["email"],
            role=UserRole(row["role"]),
            created_at=row["created_at"],
            verified_at=row.get("verified_at"),
        )


@dataclass
class TokenClaims:
    sub: str
    email: str
    role: UserRole
    iat: int
    exp: int
