from __future__ import annotations

from dataclasses import dataclass

import logging
import httpx

from backend.db.supabase_client import auth_headers, rest_base_url
from backend.utils.helpers import truncate_text

logger = logging.getLogger("bloom.memory")


@dataclass(slots=True)
class ChatTurn:
    role: str
    content: str
    created_at: str | None = None


async def save_message(user_id: str, role: str, content: str, session_id: str | None = None, jwt: str | None = None) -> None:
    payload: dict[str, object] = {
        "user_id": user_id,
        "role": role,
        "content": truncate_text(content, 20000),
    }
    if session_id:
        payload["session_id"] = session_id

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{rest_base_url()}/messages",
            headers=auth_headers(jwt),
            json=payload,
        )
        if not response.is_success:
            raise RuntimeError(f"Unable to save message: {response.status_code} {response.text}")


async def get_history(user_id: str, session_id: str | None = None, limit: int = 20, jwt: str | None = None) -> list[ChatTurn]:
    params: list[tuple[str, str]] = [
        ("select", "role,content,created_at"),
        ("user_id", f"eq.{user_id}"),
        ("order", "created_at.desc"),
        ("limit", str(limit)),
    ]
    if session_id:
        params.append(("session_id", f"eq.{session_id}"))

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{rest_base_url()}/messages",
                headers=auth_headers(jwt),
                params=params,
            )
            if not response.is_success:
                raise RuntimeError(f"Unable to load history: {response.status_code} {response.text}")

            rows = response.json()
            rows.reverse()
            return [ChatTurn(role=row["role"], content=row["content"], created_at=row.get("created_at")) for row in rows]
    except Exception as e:
        error_msg = str(e).lower()
        if any(keyword in error_msg for keyword in ["expired", "jwt", "unauthorized", "invalid token"]):
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
        raise


def format_history(history: list[ChatTurn]) -> str:
    lines: list[str] = []
    for turn in history:
        lines.append(f"{turn.role.upper()}: {turn.content}")
    return "\n".join(lines)
