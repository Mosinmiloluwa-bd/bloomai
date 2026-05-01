from __future__ import annotations

import re
from dataclasses import dataclass


CRISIS_PATTERNS = [
    r"\bkill myself\b",
    r"\bend my life\b",
    r"\bdie by suicide\b",
    r"\bself[-\s]?harm\b",
    r"\bcut myself\b",
    r"\boverdose\b",
    r"\bhurt myself\b",
    r"\bwant to die\b",
    r"\bdon't want to live\b",
    r"\bi'm going to die\b",
]

NUANCE_PATTERNS = [
    r"\bno reason to live\b",
    r"\bcan't go on\b",
    r"\bi wish i were dead\b",
    r"\bgoodbye forever\b",
    r"\bpeople would be better off without me\b",
    r"\bplan to\b.*\b(kill|hurt)\b",
    r"\bmeans?\b.*\b(hanging|pills|blade|rope|razor)\b",
]

NIGERIAN_SUPPORT_TEXT = (
    "If you might act on these thoughts, call Nigeria emergency services now: 112 nationwide, "
    "or 767 in Lagos. If you are alone, move near another person, put distance between you and anything you could use to hurt yourself, "
    "and go to the nearest hospital or emergency department now. If you can, tell a trusted adult, family member, counselor, or lecturer immediately."
)

SAFE_OVERRIDE = (
    "I hear you, and I'm really glad you said something. Please reach out to Asido's crisis line right now: "
    "+2349028080416. You matter, and you don't have to carry this alone."
)

# Hard patterns — single match is conclusive.
_HARD_REFUSAL_PATTERNS = [
    r"I'?m sorry for any inconvenience.{0,80}(unable|can.?t)",
    r"I am an AI and (cannot|can.?t) provide (the )?support",
    r"I'?m (currently )?unable to (respond|provide support) as I (usually|normally) would",
]

# Redirect phrases — one of these plus structural checks = refusal.
_REDIRECT_SIGNALS = [
    r"reach out to (a trusted person|emergency services|a professional)",
    r"contact(ing)? a mental health professional",
    r"find(ing)? a supportive (community|person)",
    r"try engaging in an activity",
    r"I'?ll be back online",
    r"technical difficulties",
    r"unable to respond as I",
    r"I'?m here for you,? but I'?m unable",
]


def _is_provider_refusal(text: str) -> bool:
    """Return True if the text looks like a canned provider-level refusal.

    Strategy: hard pattern OR (structurally long + no question + redirect phrase).
    This is model-agnostic — it catches novel phrasings by shape, not exact words.
    """
    if _matches(_HARD_REFUSAL_PATTERNS, text):
        return True

    # Structural check: refusals are long walls of text, don't end with '?',
    # and always redirect the user elsewhere.
    stripped = text.strip()
    word_count = len(stripped.split())
    ends_with_question = stripped.endswith("?")
    has_redirect = any(re.search(p, stripped, flags=re.IGNORECASE | re.DOTALL) for p in _REDIRECT_SIGNALS)

    return word_count > 40 and not ends_with_question and has_redirect


@dataclass(slots=True)
class SafetyResult:
    triggered: bool
    reason: str | None = None
    response: str | None = None


def _matches(patterns: list[str], text: str) -> list[str]:
    return [pattern for pattern in patterns if re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)]


def check_input(text: str) -> SafetyResult:
    crisis_hits = _matches(CRISIS_PATTERNS, text)
    if crisis_hits:
        return SafetyResult(True, "tier1_input", SAFE_OVERRIDE)

    nuance_hits = _matches(NUANCE_PATTERNS, text)
    if len(nuance_hits) >= 2:
        return SafetyResult(True, "tier2_input", SAFE_OVERRIDE)

    return SafetyResult(False)


def check_output(text: str) -> SafetyResult:
    # Check for provider-level refusals first
    if _is_provider_refusal(text):
        return SafetyResult(True, "provider_refusal", SAFE_OVERRIDE)

    crisis_hits = _matches(CRISIS_PATTERNS, text)
    if crisis_hits:
        return SafetyResult(True, "tier1_output", SAFE_OVERRIDE)

    nuance_hits = _matches(NUANCE_PATTERNS, text)
    if len(nuance_hits) >= 2:
        return SafetyResult(True, "tier2_output", SAFE_OVERRIDE)

    return SafetyResult(False)

