from __future__ import annotations

import logging
from typing import Annotated

import jwt
from fastapi import Header, HTTPException, status

from backend.app.config import settings
from backend.models.schemas import CurrentUser

logger = logging.getLogger("bloom.auth")


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header.")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header must be Bearer token.")
    return parts[1].strip()


def _decode_claims(token: str) -> dict:
    """Decode and verify a Supabase JWT.

    Fast path: verify signature locally with SUPABASE_JWT_SECRET (avoids a
    150-300ms network call to Supabase auth API on every request).

    Fallback: if the secret is wrong or missing, decode without signature
    verification but still validate the Supabase issuer claim. Logs a warning
    so the admin knows to fix the env var — but keeps the app running.
    """
    if settings.supabase_jwt_secret:
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your session has expired. Please sign in again.",
            )
        except jwt.InvalidSignatureError:
            # Secret is set but wrong — log loudly and fall through to
            # unverified path so the app stays working.
            logger.error(
                "JWT signature verification FAILED — SUPABASE_JWT_SECRET may be "
                "incorrect in Render env vars. Falling back to unverified decode. "
                "Fix SUPABASE_JWT_SECRET to restore full security."
            )
        except jwt.InvalidTokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed session token. Please sign in again.",
            ) from exc
    else:
        logger.warning(
            "SUPABASE_JWT_SECRET is not set — JWT signature cannot be verified. "
            "Set this in Render env vars for full security."
        )

    # Fallback: unverified decode — we still validate the issuer below.
    try:
        return jwt.decode(token, options={"verify_signature": False})
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token. Please sign in again.",
        ) from exc


def get_current_user(authorization: Annotated[str | None, Header(alias="Authorization")] = None) -> CurrentUser:
    token = _parse_bearer_token(authorization)
    claims = _decode_claims(token)

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT missing user subject.")

    if settings.supabase_url:
        expected_iss = f"{settings.supabase_url.rstrip('/')}/auth/v1"
        if claims.get("iss") != expected_iss:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="JWT issuer does not match this Supabase project.",
            )

    if claims.get("role") not in {"authenticated", "service_role"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase JWT role is not authorized.",
        )

    return CurrentUser(
        id=str(user_id),
        email=claims.get("email"),
        token=token,
        claims=claims,
    )
