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

# Individual signal patterns — two or more hits in the same response is treated as a provider refusal.
_REFUSAL_SIGNALS = [
    r"I'?m sorry for any inconvenience",
    r"I'?m (currently )?unable to provide (the )?support",
    r"I (am an AI|cannot|can not) (and |that )?(provide|offer) (the )?support",
    r"reach out to a (trusted person|friend or family member)",
    r"contacting? a mental health professional for additional support",
    r"Take care\.?\s*$",  # common sign-off on canned refusals
    r"it'?s (okay|normal|important) to (have difficult emotions|feel sad|seek help)",
]

_HARD_REFUSAL_PATTERNS = [
    r"I'?m sorry for any inconvenience.*unable to provide",
    r"I am an AI and cannot provide (the )?support you need",
]


def _is_provider_refusal(text: str) -> bool:
    """Return True if the text looks like a canned provider-level refusal."""
    # Any single hard-match is conclusive
    if _matches(_HARD_REFUSAL_PATTERNS, text):
        return True
    # Two or more weak signals together also indicate a refusal
    hits = sum(1 for p in _REFUSAL_SIGNALS if re.search(p, text, flags=re.IGNORECASE | re.DOTALL))
    return hits >= 2


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

