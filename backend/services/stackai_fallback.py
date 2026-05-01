from __future__ import annotations

import asyncio

import httpx

from backend.app.config import settings


class StackAIFallbackError(RuntimeError):
    pass


def _extract_output(payload: dict) -> str:
    outputs = payload.get("outputs") if isinstance(payload, dict) else None
    if isinstance(outputs, dict) and isinstance(outputs.get("out-0"), str):
        return outputs["out-0"]
    if isinstance(payload, dict) and isinstance(payload.get("out-0"), str):
        return payload["out-0"]
    return str(payload)


async def call_stackai(message: str, session_id: str | None, user_id: str) -> str:
    if not settings.stackai_api_url or not settings.stackai_api_key:
        raise StackAIFallbackError("StackAI credentials missing.")

    payload = {
        "in-0": message,
        "in-1": user_id,
        "user_id": session_id,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(
            settings.stackai_api_url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.stackai_api_key}",
            },
            json=payload,
        )

        if response.is_success:
            return _extract_output(response.json())

        if response.status_code == 400:
            retry_payload = {
                "inputs": {"in-0": message, "in-1": user_id},
                "user_id": session_id,
            }
            retry_response = await client.post(
                settings.stackai_api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.stackai_api_key}",
                },
                json=retry_payload,
            )
            if retry_response.is_success:
                return _extract_output(retry_response.json())
            raise StackAIFallbackError(f"StackAI retry failed: {retry_response.status_code} {retry_response.text}")

        raise StackAIFallbackError(f"StackAI request failed: {response.status_code} {response.text}")
