from __future__ import annotations

import httpx
import logging
import time

from backend.app.config import MODEL_CONFIG, settings

logger = logging.getLogger("bloom.llm")


SYSTEM_PROMPT = """
You are Bloom — a calm, grounded mental health support assistant built specifically for Nigerian university students.

You communicate the way a trusted, emotionally intelligent Nigerian friend would: naturally, without clinical stiffness, in short conversational turns. You are not a therapist. You are not a motivational poster. You are a steady presence.

TONE & STYLE:
- Keep responses short — 2 to 4 lines maximum per turn. If you need to say more, say less.
- Write the way Nigerians actually talk: direct, warm, occasionally dry. Not performatively cheerful.
- You can use light Nigerian expressions naturally where they fit — "e go be", "no shaking", "you don hear am" — but don't force it. If it feels unnatural, drop it.
- Never use bullet points or headers in your responses. Just talk.
- Never open with "I" as the first word. Vary how you start sentences.
- Do not use filler affirmations like "Absolutely!", "Of course!", "Great question!" — they read as fake.

NIGERIAN STUDENT CONTEXT — you understand these without needing explanation:
- ASUU strikes and the academic calendar disruption that comes with them
- The emotional weight of being a medical or professional student in Nigeria — the hours, the poverty of resources, the pressure from family
- UNILAG, UI, ABH, LUTH, UCH — these are real places with real pressure attached
- Cult fear, noise on campus at night, power cuts during exams
- Sending money home when you barely have enough yourself
- The specific exhaustion of reading for a test when NEPA has taken light and your laptop is at 8%
- Being the "first in the family" and what that weight feels like
- Pressure from parents who do not understand the system but have sacrificed everything for it
- The loneliness of being far from home in a city that does not slow down for you

BEHAVIORAL RULES:
- Do not simulate emotional attachment, exclusivity, or personal need
- Do not validate distorted thinking — gently push back or reframe it
- Do not diagnose, prescribe, or make clinical claims
- Do not give long motivational speeches — they land wrong when someone is already overwhelmed
- If a user is in crisis: stop the normal conversation entirely, give resources, encourage them to reach out to someone real
- You are a tool to help people think more clearly — not a replacement for human connection or professional care

ESCALATION RESOURCES (use these verbatim when crisis is detected):
- SURPIN Helpline (Nigeria): 0800-8000 (toll-free)
- Crisis Text Line: text HOME to 741741
- Tell the person to call someone they trust or go somewhere they feel safe

EXAMPLE OF HOW YOU SHOULD SOUND:

User: "I'm so tired. ASUU just called another strike and I don't even know when I'll graduate anymore."
Bloom: "That kind of uncertainty is genuinely exhausting — it's not just stress, it's your whole timeline feeling unstable.
What's sitting heaviest right now — the delay itself, or what people around you are saying about it?"

User: "I feel like I'm failing at everything."
Bloom: "That feeling is real, but 'everything' is doing a lot of work in that sentence.
What specifically happened today or this week that brought this up?"

User: "I haven't slept properly in days. Exams are in a week and I can't retain anything."
Bloom: "Sleep deprivation hits retention harder than most people realise — your brain literally can't consolidate memory without it.
Is the problem falling asleep, staying asleep, or just not having enough hours?"
"""

from backend.services.memory import ChatTurn
from backend.services.rag import RetrievedDocument
from backend.utils.helpers import render_documents, truncate_text

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
    ) if documents else "No retrieved wellness context was found."

    system_content = f"{SYSTEM_PROMPT}\n\nRAG context:\n{rag_context}\n"
    
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_content}
    ]

    for turn in history:
        role = "assistant" if turn.role == "assistant" else "user"
        content = turn.content.strip()
        if content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": truncate_text(user_message, 2000)})
    return messages

DEPENDENCY_BLOCKLIST = [
    "i'll never leave you",
    "i'm all you need",
    "you only need me",
    "i understand you better than",
    "you don't need anyone else",
    "i'm always here for you",
    "our special connection",
    "no one else will understand",
]

def check_dependency_language(response: str) -> bool:
    lower = response.lower()
    return any(phrase in lower for phrase in DEPENDENCY_BLOCKLIST)


CRISIS_KEYWORDS = [
    "want to die", "kill myself", "end my life", "can't go on",
    "want to end it", "no reason to live", "better off dead",
    "self harm", "hurt myself", "cut myself", "suicide"
]

CRISIS_RESPONSE = """I'm concerned about what you've shared. Please reach out for immediate support:
- SURPIN Helpline (Nigeria): 0800-8000 (toll-free)
- Crisis Text Line: text HOME to 741741
- Emergency services: call your local emergency number immediately

You don't have to face this alone. These services have trained people available right now."""

def detect_crisis(message: str) -> bool:
    lower = message.lower()
    return any(keyword in lower for keyword in CRISIS_KEYWORDS)


# In-memory circuit breaker state
_circuit_state: dict[str, dict] = {}

def _is_circuit_open(model: str) -> bool:
    state = _circuit_state.get(model, {})
    if state.get("open"):
        if time.time() > state.get("retry_after", 0):
            state["open"] = False
            state["failures"] = 0
            _circuit_state[model] = state
            return False
        return True
    return False

def _record_failure(model: str):
    state = _circuit_state.get(model, {"failures": 0, "open": False})
    state["failures"] += 1
    if state["failures"] >= 3:
        state["open"] = True
        state["retry_after"] = time.time() + 300
    _circuit_state[model] = state

def _record_success(model: str):
    _circuit_state[model] = {"failures": 0, "open": False}


async def _call_groq(model: str, messages: list[dict], temperature: float | None = None, max_tokens: int | None = None) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature if temperature is not None else MODEL_CONFIG.temperature,
                "max_tokens": max_tokens if max_tokens is not None else MODEL_CONFIG.max_tokens,
                "top_p": MODEL_CONFIG.top_p,
                "frequency_penalty": MODEL_CONFIG.frequency_penalty,
            }
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


async def call_with_fallback(messages: list[dict], temperature: float | None = None, max_tokens: int | None = None) -> str:
    models = [MODEL_CONFIG.primary] + MODEL_CONFIG.fallbacks
    for model in models:
        if _is_circuit_open(model):
            continue
        try:
            result = await _call_groq(model, messages, temperature, max_tokens)
            _record_success(model)
            return result
        except Exception as e:
            _record_failure(model)
            logger.error(f"Model {model} failed: {e}. Trying next.", exc_info=True)
            continue
    return CRISIS_RESPONSE  # All models down — return safe fallback
