from __future__ import annotations

import asyncio
import logging
from uuid import uuid4

import httpx

from backend.db.supabase_client import get_supabase_admin_key, rest_base_url

logger = logging.getLogger("bloom.logging")

async def log_turn(
    user_id: str, 
    message: str, 
    response: str, 
    session_id: str | None = None,
    crisis_flag: bool = False, 
    risk=None, 
    model_used: str | None = None, 
    latency_ms: int | None = None,
    fallback_triggered: bool = False
) -> None:
    # Fire and forget wrapper
    asyncio.create_task(_log_turn_internal(
        user_id, message, response, session_id, crisis_flag, risk, model_used, latency_ms, fallback_triggered
    ))

async def _log_turn_internal(
    user_id: str, 
    message: str, 
    response: str, 
    session_id: str | None,
    crisis_flag: bool, 
    risk, 
    model_used: str | None, 
    latency_ms: int | None,
    fallback_triggered: bool
) -> None:
    try:
        # Service role needed to log telemetry without exposing to RLS
        headers = {
            "apikey": get_supabase_admin_key(),
            "Authorization": f"Bearer {get_supabase_admin_key()}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "user_id": user_id,
            "session_id": session_id or str(uuid4()),
            "turn_index": 0, # Would normally be calculated from history
            "emotional_intensity": risk.emotional_intensity if risk else None,
            "crisis_flag": crisis_flag or (risk.crisis_indicators if risk else False),
            "dependency_flag": (risk.dependency_risk in ["moderate", "high"]) if risk else False,
            "manipulation_flag": risk.manipulation_attempt if risk else False,
            "model_used": model_used,
            "fallback_triggered": fallback_triggered,
            "response_tokens": len(response.split()) * 1.3, # rough estimate
            "latency_ms": latency_ms
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{rest_base_url()}/conversation_logs",
                headers=headers,
                json=payload
            )
    except Exception as e:
        logger.error(f"Failed to log conversation turn: {e}")
