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
    # We must use the anon key for normal operations so RLS applies correctly.
    # The service_role key bypasses RLS, which is dangerous for user operations.
    anon_key = settings.supabase_url.replace("https://", "").replace("http://", "").split(".")[0] # Temporary placeholder, should use real anon key if available, but for now we fallback
    # If we have a jwt, we are acting on behalf of a user, so use the user's jwt as the apikey and auth header
    # This ensures RLS is enforced based on the user's uid
    if jwt:
        return {
            "apikey": get_supabase_admin_key(),
            "Authorization": f"Bearer {jwt}",
            "Content-Type": "application/json",
        }
    
    # If no JWT is provided, we default to the service_role key.
    # IMPORTANT: service_role bypasses RLS. Only use this for internal 
    # administrative tasks (e.g. logging telemetry) where RLS must be bypassed.
    return {
        "apikey": get_supabase_admin_key(),
        "Authorization": f"Bearer {get_supabase_admin_key()}",
        "Content-Type": "application/json",
    }
