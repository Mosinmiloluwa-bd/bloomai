from __future__ import annotations

import httpx
from langchain_core.prompts import ChatPromptTemplate

from backend.app.config import settings
from backend.services.memory import ChatTurn
from backend.services.rag import RetrievedDocument
from backend.utils.helpers import render_documents, render_history, truncate_text


SYSTEM_PROMPT = """You are Bloom, a calm, supportive student mental wellness companion.
You do not diagnose. You do not claim certainty about mental health conditions.
You respond with warmth, clarity, and practical grounding.
You encourage professional help when the situation may need it.
You keep responses short, supportive, and non-judgmental.
You never intensify distress, shame the user, or encourage risky behavior.
When crisis language appears, encourage immediate human support and emergency services.
"""


def build_prompt(user_message: str, history: list[ChatTurn], documents: list[RetrievedDocument]) -> list[dict[str, str]]:
    template = ChatPromptTemplate.from_messages(
        [
            ("system", "{system_prompt}\n\nRAG context:\n{rag_context}\n"),
            ("system", "Conversation so far:\n{history}"),
            ("human", "{user_message}"),
        ]
    )

    formatted = template.format_messages(
        system_prompt=SYSTEM_PROMPT,
        rag_context=render_documents(
            [
                {
                    "source": doc.source or "unknown",
                    "topic": doc.topic or "general",
                    "content": doc.content,
                }
                for doc in documents
            ]
        )
        or "No retrieved wellness context was found.",
        history=render_history(
            [{"role": turn.role, "content": turn.content} for turn in history]
        )
        or "No prior conversation.",
        user_message=truncate_text(user_message, 2000),
    )

    messages: list[dict[str, str]] = []
    for message in formatted:
        role = "user" if message.type == "human" else message.type
        messages.append({"role": role, "content": message.content})
    return messages


async def generate_response(user_message: str, history: list[ChatTurn], documents: list[RetrievedDocument]) -> str:
    if not settings.model_api_key:
        raise RuntimeError("MODEL_API_KEY is not set.")

    messages = build_prompt(user_message, history, documents)

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{settings.model_base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.model_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.model_name,
                "messages": messages,
                "temperature": 0.4,
            },
        )
        if not response.is_success:
            raise RuntimeError(f"Model request failed: {response.status_code} {response.text}")

        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise RuntimeError("Model returned no choices.")
        message = choices[0].get("message") or {}
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Model returned an empty response.")
        return content.strip()
