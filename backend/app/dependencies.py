from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Header, HTTPException, status

from backend.app.config import settings
from backend.models.schemas import CurrentUser


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header.")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header must be Bearer token.")
    return parts[1].strip()


def get_current_user(authorization: Annotated[str | None, Header(alias="Authorization")] = None) -> CurrentUser:
    token = _parse_bearer_token(authorization)

    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: SUPABASE_JWT_SECRET is not set.",
        )

    # Verify the JWT locally using the shared secret — avoids a 150-300ms
    # network round-trip to Supabase auth API on every single chat request.
    try:
        claims = jwt.decode(
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
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token. Please sign in again.",
        ) from exc

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

