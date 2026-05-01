from __future__ import annotations

from functools import lru_cache
from datetime import datetime, timedelta

import jwt
from supabase import Client, create_client

from backend.app.config import settings


def _mint_service_role_jwt() -> str:
    if not settings.supabase_jwt_secret:
        raise RuntimeError("SUPABASE_JWT_SECRET must be set to mint an admin JWT.")

    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL must be set to mint an admin JWT.")

    host = settings.supabase_url.replace("https://", "").replace("http://", "").split("/")[0]
    project_ref = host.split(".")[0]
    now = datetime.utcnow()
    payload = {
        "iss": "supabase",
        "ref": project_ref,
        "role": "service_role",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=3650)).timestamp()),
    }
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm="HS256")


def get_supabase_admin_key() -> str:
    key = settings.supabase_service_role_key
    if key and key.count(".") == 2:
        return key
    return _mint_service_role_jwt()


@lru_cache(maxsize=1)
def get_supabase_admin_client() -> Client:
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL must be set.")
    return create_client(settings.supabase_url, get_supabase_admin_key())


def rest_base_url() -> str:
    return f"{settings.supabase_url.rstrip('/')}/rest/v1"


def auth_headers(jwt: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": get_supabase_admin_key(),
        "Content-Type": "application/json",
    }
    if jwt:
        headers["Authorization"] = f"Bearer {jwt}"
    return headers
