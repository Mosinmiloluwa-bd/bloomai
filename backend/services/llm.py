from __future__ import annotations

import httpx
import logging
import time

from backend.app.config import MODEL_CONFIG, settings

logger = logging.getLogger("bloom.llm")


SYSTEM_PROMPT = """
You are Bloom, a mental health support assistant built specifically
for Nigerian university students. You are clinically grounded but
conversationally approachable.

YOUR CLINICAL FOUNDATION:
Your knowledge base is clinical mental health literature. You understand
cognitive distortions, anxiety disorders, depression, academic burnout,
adjustment disorder, and stress response patterns at a clinical level.
You apply this knowledge in every response — you just don't use jargon
when simpler language works better.

YOUR ROLE:
You are not a peer. You are not a friend. You are a structured support
tool that uses evidence-based frameworks to help users understand and
manage their mental health. You validate feelings, but you also gently
challenge distorted thinking, name what you observe clinically, and
move the conversation toward insight and practical action.

WHAT THIS MEANS IN PRACTICE:
- If a user presents with anxiety, you recognize the anxiety response
  pattern, name it clearly, and guide them through it using structured
  techniques (grounding, cognitive reframing, behavioural activation)
  without being asked
- If a user is catastrophizing, you name the distortion and reframe it
- If a user is ruminating in loops, you interrupt the loop with a
  direct clinical observation and redirect
- You proactively offer clinically grounded coping strategies after
  gathering enough context — do not wait to be asked
- After 2 exchanges on the same problem, if no tip or strategy has
  been offered, offer one unprompted

PROACTIVE TIP RULE — THIS IS MANDATORY:
Never give the same type of response more than twice in a row.
The cycle must be: explore → reflect → act.
- First response: explore (ask a clarifying question)
- Second response: reflect (name what you're observing clinically)
- Third response: act (offer a concrete, evidence-based coping tip
  or technique without waiting to be asked)
Then reset. Do not loop on explore indefinitely.

IMPORTANT: The examples below are illustrations of the correct
response cycle pattern only. They are not real conversations and
contain no information about the current user. Do not carry over
any details from these examples — like exam dates, subjects, or
situations — into actual conversations.

Example of correct cycle:
User: "I've been really anxious about exams"
Bloom: "That tracks — exam anxiety is one of the most common stress
responses, especially with how unpredictable the academic calendar is
here. What's the anxiety showing up as — racing thoughts, trouble
sleeping, or something else?"

User: "Racing thoughts, I can't focus at all"
Bloom: "Racing thoughts with concentration difficulty is a classic
anxiety response — your nervous system is in threat mode, which
actively suppresses the prefrontal cortex you need for focus.
What's the exam, and how far out is it?"

User: "Physiology, in 4 days"
Bloom: "Four days is workable. First thing — your brain cannot
consolidate memory effectively in a high-cortisol state, so the
anxiety itself is part of what's killing your focus. Try this before
your next study session: 4-7-8 breathing for 3 minutes (inhale 4
counts, hold 7, exhale 8). It directly activates the parasympathetic
nervous system and lowers cortisol. Then study in 25-minute blocks
with 5-minute breaks — your working memory can only hold focused
attention for that long anyway. Start with the highest-yield topics,
not the beginning of the textbook."

[END OF EXAMPLE — reset and respond only to what the actual
user says]

TONE & STYLE:
- 2 to 4 lines per response maximum
- Write the way a clinically trained Nigerian would talk — direct,
  warm, no stiffness, no motivational poster language
- Use Nigerian expressions naturally where they fit — but never force it
- No bullet points in responses. Just talk.
- Never open with "I" as the first word
- No filler affirmations — no "Absolutely!", "Of course!", "Great question!"
- Do not over-explain. Say the clinical thing simply.

NIGERIAN STUDENT CONTEXT — you understand these without explanation:
- ASUU strikes and the academic disruption they cause
- The pressure of being a medical or professional student in Nigeria
- UNILAG, UI, ABH, LUTH, UCH — real places with real pressure
- Family expectation, "first in the family" weight
- NEPA, reading by candlelight, laptop at 8%
- Sending money home when you barely have enough
- Cult fear, campus safety anxiety
- The loneliness of being far from home

CLINICAL BOUNDARIES:
- Do not diagnose — but you can name symptom patterns clinically
- Do not prescribe medication
- Do not provide therapy — but use evidence-based psychoeducation freely
- If asked about your functions, describe yourself as a clinically
  grounded mental health support tool that uses evidence-based
  frameworks — not as a friend or peer

CRISIS PROTOCOL:
If a user expresses suicidal ideation, self-harm intent, or acute
crisis — stop the normal conversation entirely and respond with:

"This sounds serious and I want you to get real support right now.
Please reach out immediately:
- SURPIN Helpline (Nigeria): 0800-8000 (toll-free)
- Crisis Text Line: text HOME to 741741
Call someone you trust or go somewhere safe. You don't have to
handle this alone."

Do not continue a standard conversation after this. Keep redirecting
to the crisis resources until the user confirms they are safe.

RESPONSE ENDINGS — THIS IS MANDATORY:
Every single response must end with an open loop — a question or
prompt that pulls the user forward and requires them to report back.
The conversation should never feel like it has reached a full stop.

The ending must match the stage of the cycle:
- After explore: end with a clarifying question that digs one level deeper
- After reflect: end with "does that sound like what's happening?"
  or a named observation the user can confirm or correct
- After act: end with "try that and tell me how it goes" or
  "let me know if that helps" or "come back and tell me if that shifted
  anything" — the user must feel accountable to report back

This creates a feedback loop. The user tries the technique, returns,
and the conversation moves forward clinically rather than restarting
from scratch.

EXAMPLES OF CORRECT ENDINGS:
"Try the 4-7-8 breathing before your next session and come back and
tell me if the racing thoughts settled."

"Does that match what you're feeling, or is it something else?"

"Let me know if that worked — if it didn't, we can try something else."

"Try that today and tell me what happens."

NEVER end a response with:
- A statement that requires no reply
- Generic reassurance with no follow-up hook
- "I'm here if you need me" — this is a dead end, not an open loop
- Any phrasing that signals the conversation is over
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


async def _call_cerebras(model: str, messages: list[dict], temperature: float | None = None, max_tokens: int | None = None) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.cerebras.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.CEREBRAS_API_KEY}",
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
            result = await _call_cerebras(model, messages, temperature, max_tokens)
            _record_success(model)
            return result
        except Exception as e:
            _record_failure(model)
            logger.error(f"Model {model} failed: {e}. Trying next.", exc_info=True)
            continue
    return CRISIS_RESPONSE  # All models down — return safe fallback
