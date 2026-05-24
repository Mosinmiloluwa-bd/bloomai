from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from backend.app.config import settings
from backend.services.llm import generate_response
from backend.services.memory import get_history, save_message
from backend.services.rag import retrieve_relevant_documents
from backend.services.safety import check_input, check_output, SAFE_OVERRIDE
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


def _build_rag_query(message: str, history: list) -> str:
    """Return an enriched query for vector search.

    For short or ambiguous messages (e.g. 'What can I do?', 'How?'),
    prepend the last real assistant turn so the embedding captures the actual topic.
    Safety override responses are skipped so crisis messages never pollute the query.
    """
    word_count = len(message.split())
    if word_count <= 12:
        for turn in reversed(history):
            if turn.role == "assistant" and SAFE_OVERRIDE not in turn.content:
                context_snippet = turn.content[:300]
                return f"{context_snippet}\n\n{message}"
    return message


async def route_chat(user_id: str, message: str, session_id: str | None = None, jwt: str | None = None) -> RouteResult:
    logger.info("safety check_input passed | user_id=%s | text=%.80r", user_id, message)
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

    documents = await retrieve_relevant_documents(
        _build_rag_query(message, history), jwt=jwt
    )
    response = await generate_response(user_message=message, history=history, documents=documents)

    logger.info("llm response received | route=new | word_count=%d | ends_question=%s", len(response.split()), response.strip().endswith("?"))
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
    except Exception as exc:
        exc_str = str(exc)
        logger.error("Error in route_chat: %s", exc, exc_info=True)
        try:
            legacy = await call_stackai(message=message, session_id=session_id, user_id=user_id)
            safety = check_output(legacy)
            if safety.triggered and safety.response:
                result = RouteResult(response=safety.response, route="legacy_fallback_safety", safety_triggered=True)
            else:
                result = RouteResult(response=legacy, route="legacy_fallback")
        except StackAIFallbackError as fallback_exc:
            logger.error("StackAI fallback also failed: %s", fallback_exc)
            # Give a warm, honest message that doesn't feel like a generic crash.
            # Distinguish a config problem from a transient network issue.
            if "MODEL_API_KEY" in exc_str or "not set" in exc_str.lower():
                fallback_response = (
                    "I'm having some trouble connecting right now — my systems aren't fully online. "
                    "Please try again in a minute or two."
                )
            else:
                fallback_response = (
                    "I'm still here with you, but something isn't working on my end just now. "
                    "Give it a moment and try sending that again — I don't want you to feel unheard."
                )
            result = RouteResult(
                response=fallback_response,
                route="canned_fallback",
            )

    await persist("assistant", result.response)
    return result

