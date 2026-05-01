from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from backend.app.config import settings
from backend.services.llm import generate_response
from backend.services.memory import get_history, save_message
from backend.services.rag import retrieve_relevant_documents
from backend.services.safety import check_input, check_output
from backend.services.stackai_fallback import StackAIFallbackError, call_stackai
from backend.utils.helpers import stable_bucket


logger = logging.getLogger("bloom")


@dataclass(slots=True)
class RouteResult:
    response: str
    route: str
    safety_triggered: bool = False


def _use_new_backend(user_id: str) -> bool:
    percentage = max(0, min(100, settings.routing_percentage))
    if percentage == 0:
        return False
    if percentage == 100:
        return True
    return stable_bucket(user_id, 100) < percentage


async def route_chat(user_id: str, message: str, session_id: str | None = None, jwt: str | None = None) -> RouteResult:
    safety = check_input(message)
    if safety.triggered and safety.response:
        return RouteResult(response=safety.response, route="safety", safety_triggered=True)

    if not _use_new_backend(user_id):
        legacy = await call_stackai(message=message, session_id=session_id, user_id=user_id)
        output_safety = check_output(legacy)
        if output_safety.triggered and output_safety.response:
            return RouteResult(response=output_safety.response, route="legacy_safety", safety_triggered=True)
        return RouteResult(response=legacy, route="legacy")

    history = await get_history(user_id=user_id, session_id=session_id, jwt=jwt)
    if history and history[-1].role == "user" and history[-1].content == message:
        history = history[:-1]

    documents = await retrieve_relevant_documents(message, jwt=jwt)
    response = await generate_response(user_message=message, history=history, documents=documents)

    output_safety = check_output(response)
    if output_safety.triggered and output_safety.response:
        return RouteResult(response=output_safety.response, route="new_safety", safety_triggered=True)

    return RouteResult(response=response, route="new")


async def process_chat(user_id: str, message: str, session_id: str | None = None, jwt: str | None = None) -> RouteResult:
    async def persist(role: str, content: str) -> None:
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                await save_message(user_id=user_id, role=role, content=content, session_id=session_id, jwt=jwt)
                return
            except Exception as exc:
                last_error = exc
                if attempt == 0:
                    await asyncio.sleep(0.25)
        logger.warning("message_persist_failed user_id=%s role=%s error=%s", user_id, role, last_error)

    await persist("user", message)

    try:
        result = await route_chat(user_id=user_id, message=message, session_id=session_id, jwt=jwt)
    except Exception:
        try:
            legacy = await call_stackai(message=message, session_id=session_id, user_id=user_id)
            safety = check_output(legacy)
            if safety.triggered and safety.response:
                result = RouteResult(response=safety.response, route="legacy_fallback_safety", safety_triggered=True)
            else:
                result = RouteResult(response=legacy, route="legacy_fallback")
        except StackAIFallbackError:
            result = RouteResult(
                response="I'm sorry, I'm having trouble responding right now. Please try again in a moment, and if this is urgent, contact a trusted person or emergency services.",
                route="canned_fallback",
            )

    await persist("assistant", result.response)
    return result
