import os
import time
from typing import Any

import bcrypt
import jwt


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        # Local-dev fallback. Set JWT_SECRET in production.
        secret = "dev-insecure-secret-change-me"
    return secret


def create_access_token(subject: str, extra: dict[str, Any] | None = None, expires_in_seconds: int | None = None) -> str:
    if expires_in_seconds is None:
        expires_in_seconds = int(os.getenv("JWT_EXPIRES_SECONDS", "604800"))  # 7 days

    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_in_seconds,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])  # type: ignore[no-any-return]
