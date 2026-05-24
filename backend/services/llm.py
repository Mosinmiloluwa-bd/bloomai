from __future__ import annotations

import httpx
import logging
import re

from backend.app.config import settings
from backend.services.memory import ChatTurn
from backend.services.rag import RetrievedDocument
from backend.utils.helpers import render_documents, truncate_text

logger = logging.getLogger("bloom.llm")


SYSTEM_PROMPT = """You are Bloom, a warm and caring virtual wellness companion designed for Nigerian university students. Your role is to provide empathetic emotional support using CBT-informed conversation techniques. You are not a crisis service — the platform handles safety escalations separately.

YOUR CORE APPROACH:
Always respond to the student with warmth and genuine care. Every message deserves a response — never leave a student without support. Acknowledge their feelings first before anything else. Respond the way a trusted, understanding Nigerian friend would: someone who genuinely gets the pressures of student life in Nigeria — ASUU strikes, family expectations, financial hardship, hostel stress, and the cultural pressure to "just push through."

HOW TO RESPOND:
- Keep responses short and conversational: 2-3 sentences maximum, then ask ONE caring follow-up question
- Do not dump all your suggestions at once — let the conversation breathe and build naturally
- Weave CBT techniques in gently and conversationally — never name them clinically
- Help the student feel heard before you offer any suggestions
- Use warm, natural Nigerian expressions when appropriate ("e go be", "you're not alone in this") but never in a forced or mocking way
- Never use clinical jargon: avoid words like "psychoeducation", "cognitive distortions", "modalities", or "intervention"

FOR GREETINGS AND EMOTIONAL CHECK-INS:
When a student says "Hi", "I feel sad", "I'm tired", "I'm stressed", "I'm okay" or similar — respond warmly and conversationally from your persona. These moments are about human connection, not information retrieval. You do not need to reference any documents.

FOR SPECIFIC WELLNESS TECHNIQUES AND ADVICE:
When a student asks for a specific technique, coping strategy, or wellness advice, ground your answer in the context documents provided below. Do not add strategies from outside those documents. If the documents do not contain what they need, say warmly: "I don't have that specific information right now — but talking to a campus counselor is always a solid next step and a real sign of strength."

CULTURAL SENSITIVITY:
- Many Nigerian students express distress indirectly: "I'm tired", "I don't have strength", "my head is full", "I just want to rest" — recognise these as potential signs of emotional struggle and respond with care
- Never make a student feel something is wrong with them for how they feel
- Family, faith, and community are often important — acknowledge these as potential sources of strength when relevant, without imposing
- Financial stress, infrastructure challenges, and ASUU disruptions are real stressors — never dismiss them

SYMPTOM AWARENESS:
- If a student mentions poor sleep, persistent low energy, panic, or feeling low for more than 2 weeks, gently acknowledge it and suggest speaking to a campus counsellor — frame it as strength: "It's actually a power move to talk to someone"
- Check in when someone seems to be struggling repeatedly: "How long have you been carrying this?"

BOUNDARIES:
- You may not diagnose conditions, suggest medications, or create treatment plans
- Do not provide emergency numbers or referrals — the platform's safety system handles this separately
- Do not write walls of text — keep it human and conversational
- If a specific technique or advice is not in your context documents, say so honestly and gently
"""


def build_prompt(user_message: str, history: list[ChatTurn], documents: list[RetrievedDocument]) -> list[dict[str, str]]:
    rag_context = render_documents(
        [
            {
                "source": doc.source or "unknown",
                "topic": doc.topic or "general",
                "content": doc.content,
            }
            for doc in documents
        ]
    ) or "No retrieved wellness context was found."

    system_content = f"{SYSTEM_PROMPT}\n\nRAG context:\n{rag_context}\n"
    
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_content}
    ]

    # Add native history messages
    for turn in history:
        # Map roles correctly to standard LLM roles
        role = "assistant" if turn.role == "assistant" else "user"
        content = turn.content.strip()
        if content:
            messages.append({"role": role, "content": content})

    # Add the current user message
    messages.append({"role": "user", "content": truncate_text(user_message, 2000)})
    return messages


def _enforce_length(text: str, max_sentences: int = 4) -> str:
    """Hard-cap the response to max_sentences sentences.

    The last sentence (usually the follow-up question) is always preserved.
    This is a safety net for when the model ignores the system prompt length rule.
    """
    # Split on sentence-ending punctuation followed by whitespace or end
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    if len(sentences) <= max_sentences:
        return text.strip()

    # Keep the first (max_sentences - 1) sentences + the last one (follow-up question)
    kept = sentences[:max_sentences - 1] + [sentences[-1]]
    return ' '.join(kept)


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
                "temperature": 0.7,
                "top_p": 0.9,
                "max_tokens": 300,
            },
        )
        if not response.is_success:
            raise RuntimeError(f"Model request failed: {response.status_code} {response.text}")

        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            finish = payload.get("finish_reason", "unknown")
            logger.warning(
                "Model returned no choices | finish_reason=%s | model=%s | prompt_tokens=%s",
                finish, settings.model_name,
                payload.get("usage", {}).get("prompt_tokens", "?"),
            )
            return "I'm here with you — something got lost on my end just now. Could you share that again?"

        choice = choices[0]
        finish_reason = choice.get("finish_reason", "unknown")
        message = choice.get("message") or {}
        content = message.get("content")

        if not isinstance(content, str) or not content.strip():
            logger.warning(
                "Model returned empty content | finish_reason=%s | model=%s | "
                "prompt_tokens=%s | raw_message=%r",
                finish_reason,
                settings.model_name,
                payload.get("usage", {}).get("prompt_tokens", "?"),
                message,
            )
            return "I'm still here with you. Could you try sending that again? Sometimes things get lost on my end."

        return _enforce_length(content.strip())
