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
        if response.status_code == 401 and jwt is not None:
            logger.warning("save_message failed with 401; retrying with service_role auth.")
            response = await client.post(
                f"{rest_base_url()}/messages",
                headers=auth_headers(None),
                json=payload,
            )
        if not response.is_success:
            raise RuntimeError(f"Unable to save message: {response.status_code} {response.text}")


async def get_history(user_id: str, session_id: str | None = None, limit: int = 20, jwt: str | None = None) -> list[ChatTurn]:
    params: list[tuple[str, str]] = [
        ("select", "role,content,created_at"),
        ("user_id", f"eq.{user_id}"),
        ("order", "created_at.asc"),
        ("limit", str(limit)),
    ]
    if session_id:
        params.append(("session_id", f"eq.{session_id}"))

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{rest_base_url()}/messages",
            headers=auth_headers(jwt),
            params=params,
        )
        if response.status_code == 401 and jwt is not None:
            logger.warning("get_history failed with 401; retrying with service_role auth.")
            response = await client.get(
                f"{rest_base_url()}/messages",
                headers=auth_headers(None),
                params=params,
            )
        if not response.is_success:
            raise RuntimeError(f"Unable to load history: {response.status_code} {response.text}")

        rows = response.json()
        return [ChatTurn(role=row["role"], content=row["content"], created_at=row.get("created_at")) for row in rows]


def format_history(history: list[ChatTurn]) -> str:
    lines: list[str] = []
    for turn in history:
        lines.append(f"{turn.role.upper()}: {turn.content}")
    return "\n".join(lines)
