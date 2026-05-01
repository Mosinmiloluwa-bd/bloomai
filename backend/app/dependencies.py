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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SUPABASE_JWT_SECRET is missing.")

    try:
        # Decode without signature verification just to extract claims (e.g., role)
        claims = jwt.decode(token, options={"verify_signature": False})
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed JWT.") from exc

    try:
        from backend.db.supabase_client import get_supabase_admin_client
        client = get_supabase_admin_client()
        user_resp = client.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked Supabase JWT.")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase JWT.") from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT missing user subject.")

    if settings.supabase_url:
        expected_iss = f"{settings.supabase_url.rstrip('/')}/auth/v1"
        if claims.get("iss") != expected_iss:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="JWT issuer does not match this Supabase project.")

    if claims.get("role") not in {"authenticated", "service_role"}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase JWT role is not authorized.")

    return CurrentUser(
        id=str(user_id),
        email=claims.get("email"),
        token=token,
        claims=claims,
    )
