from pydantic import BaseModel
from typing import Literal
import re

from backend.services.llm import CRISIS_KEYWORDS, DEPENDENCY_BLOCKLIST

class RiskAssessment(BaseModel):
    emotional_intensity: Literal["low", "moderate", "high", "critical"]
    crisis_indicators: bool
    dependency_risk: Literal["low", "moderate", "high"]
    looping_behavior: bool
    manipulation_attempt: bool

class BehavioralPolicy(BaseModel):
    hard_stop: bool = False
    allow_rag: bool = True
    temperature_override: float | None = None
    max_tokens_override: int | None = None
    system_suffix: str = ""
    required_resources: bool = False

MANIPULATION_DEFLECTION = "I'm not able to respond to that. Let me know if there's something I can genuinely help you with."

DISTRESS_VOCAB = [
    "hopeless", "worthless", "trapped", "scared", "can't cope", 
    "overwhelmed", "numb", "empty"
]

MANIPULATION_SIGNATURES = [
    "ignore previous", "ignore your instructions", "pretend you are",
    "your real persona", "act as", "jailbreak", "dan mode"
]

DEPENDENCY_SIGNATURES = [
    "you're all i have", "don't leave", "need you", 
    "only you understand", "you're my only"
]

def _score_emotional_intensity(message: str) -> Literal["low", "moderate", "high", "critical"]:
    lower = message.lower()
    score = 0
    
    # Vocab score
    for word in DISTRESS_VOCAB:
        if word in lower:
            score += 2
            
    # Punctuation score
    if "!!!" in message or "???" in message:
        score += 1
        
    # All caps ratio (rough proxy)
    words = message.split()
    if len(words) > 3:
        caps_words = sum(1 for w in words if w.isupper() and len(w) > 1)
        if caps_words / len(words) > 0.3:
            score += 2
            
    if score >= 8: return "critical"
    if score >= 5: return "high"
    if score >= 3: return "moderate"
    return "low"

def _detect_looping(message: str, session_history: list[str]) -> bool:
    if len(session_history) < 3:
        return False
        
    lower_msg = message.lower()
    # Simple distress theme overlap check
    themes = []
    for word in DISTRESS_VOCAB:
        if word in lower_msg:
            themes.append(word)
            
    if not themes:
        return False
        
    theme_count = 0
    for past_msg in session_history[-5:]:
        past_lower = past_msg.lower()
        if any(t in past_lower for t in themes):
            theme_count += 1
            
    return theme_count >= 3

def classify_intent(message: str, session_history: list[str]) -> RiskAssessment:
    lower = message.lower()
    
    # Crisis
    crisis = any(k in lower for k in CRISIS_KEYWORDS)
    
    # Manipulation
    manipulation = any(sig in lower for sig in MANIPULATION_SIGNATURES)
    
    # Dependency
    dep_risk = "low"
    if any(sig in lower for sig in DEPENDENCY_SIGNATURES):
        dep_risk = "high"
    elif any(sig in lower for sig in DEPENDENCY_BLOCKLIST): # Catch partials
        dep_risk = "moderate"
        
    intensity = _score_emotional_intensity(message)
    looping = _detect_looping(message, session_history)
    
    return RiskAssessment(
        emotional_intensity=intensity,
        crisis_indicators=crisis,
        dependency_risk=dep_risk,
        looping_behavior=looping,
        manipulation_attempt=manipulation
    )

def apply_behavioral_policy(risk: RiskAssessment) -> BehavioralPolicy:
    policy = BehavioralPolicy()
    
    if risk.crisis_indicators:
        policy.hard_stop = True
        policy.required_resources = True
        return policy
        
    if risk.manipulation_attempt:
        policy.hard_stop = True
        return policy
        
    if risk.emotional_intensity == "critical":
        policy.temperature_override = 0.2
        policy.max_tokens_override = 200
        policy.allow_rag = False
        policy.system_suffix += "\nFocus only on grounding and safety. Keep your response short and calm."
    elif risk.emotional_intensity == "high":
        policy.temperature_override = 0.3
        policy.max_tokens_override = 350
        policy.allow_rag = False
        
    if risk.dependency_risk == "high":
        policy.system_suffix += "\nDo not use language that implies exclusivity or ongoing personal attachment."
        
    if risk.looping_behavior:
        policy.allow_rag = False
        policy.system_suffix += "\nGently introduce a new perspective rather than continuing the same emotional theme."
        
    return policy
