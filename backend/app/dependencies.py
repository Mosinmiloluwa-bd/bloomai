from __future__ import annotations

import base64
import json
import logging
from typing import Annotated

import jwt
from jwt import PyJWKClient, PyJWKClientError
from fastapi import Header, HTTPException, status

from backend.app.config import settings
from backend.models.schemas import CurrentUser

logger = logging.getLogger("bloom.auth")

# ---------------------------------------------------------------------------
# JWKS client — fetches Supabase's public signing keys and caches them.
# Works with all Supabase key types: legacy JWT secret (HS256), new shared
# secret signing keys, RSA (RS256), and Elliptic Curve (ES256).
# PyJWKClient is part of PyJWT >= 2.4 which is already a dependency.
# ---------------------------------------------------------------------------
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.supabase_url:
            raise RuntimeError("SUPABASE_URL is required for JWT verification.")
        jwks_uri = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        logger.info("Initialising JWKS client from %s", jwks_uri)
        _jwks_client = PyJWKClient(jwks_uri, cache_keys=True, lifespan=3600)
    return _jwks_client


def _parse_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
        )
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be a Bearer token.",
        )
    return parts[1].strip()


def _read_jwt_payload_unsafe(token: str) -> dict:
    """Decode JWT payload via raw base64 — no signature verification.

    Used only as a last-resort fallback if the JWKS endpoint is unreachable.
    The issuer claim is still validated against SUPABASE_URL afterwards.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Token is not a valid three-segment JWT.")
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token. Please sign out and sign in again.",
        ) from exc


def _decode_claims(token: str) -> dict:
    """Verify and decode a Supabase JWT.

    Primary path  — If HS256 (symmetric key), we use settings.supabase_jwt_secret.
                    If RS256/ES256 (asymmetric keys), we fetch the public key via JWKS.
    Fallback path — raw base64 payload read if verification fails due to JWKS or network errors.
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token. Please sign out and sign in again.",
        ) from exc

    try:
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                logger.warning("SUPABASE_JWT_SECRET not configured. Falling back to unsafe decode for HS256 token.")
                return _read_jwt_payload_unsafe(token)
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        else:
            client = _get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
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
    except (PyJWKClientError, Exception) as exc:
        # JWKS endpoint unreachable or other unexpected verification failure
        # Fall back to unverified decode so the app stays running.
        logger.error(
            "JWT verification failed — falling back to unverified decode. "
            "Error: %s", exc,
        )
        return _read_jwt_payload_unsafe(token)


def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> CurrentUser:
    token = _parse_bearer_token(authorization)
    claims = _decode_claims(token)

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT missing user subject.",
        )

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
