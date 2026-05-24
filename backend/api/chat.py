import time
from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.app.config import settings
from backend.models.schemas import ChatRequest, ChatResponse, CurrentUser
from backend.app.dependencies import get_current_user
from backend.services.classifier import classify_intent, apply_behavioral_policy, MANIPULATION_DEFLECTION
from backend.services.llm import CRISIS_RESPONSE, detect_crisis, call_with_fallback, check_dependency_language, SYSTEM_PROMPT, build_prompt
from backend.services.memory import get_history
from backend.services.rag import retrieve_relevant_documents, filter_retrieved_chunks, _build_rag_query
from backend.db.logging import log_turn

import logging

router = APIRouter()
logger = logging.getLogger("bloom.chat")

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    payload: ChatRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> ChatResponse:
    start_time = time.time()
    
    # Stage 1: Crisis check
    if detect_crisis(payload.message):
        await log_turn(
            user_id=current_user.id,
            message=payload.message,
            response=CRISIS_RESPONSE,
            session_id=payload.session_id,
            crisis_flag=True,
            latency_ms=int((time.time() - start_time) * 1000)
        )
        return ChatResponse(response=CRISIS_RESPONSE)
        
    # Stage 2: Intent classification
    session_history_objs = await get_history(current_user.id, session_id=payload.session_id, jwt=current_user.token, limit=5)
    session_history = [turn.content for turn in session_history_objs if turn.role == "user"]
    
    risk = classify_intent(payload.message, session_history)
    policy = apply_behavioral_policy(risk)
    
    # Stage 3: Manipulation hard stop
    if policy.hard_stop and not risk.crisis_indicators:
        await log_turn(
            user_id=current_user.id,
            message=payload.message,
            response=MANIPULATION_DEFLECTION,
            session_id=payload.session_id,
            risk=risk,
            latency_ms=int((time.time() - start_time) * 1000)
        )
        return ChatResponse(response=MANIPULATION_DEFLECTION)
        
    # Stage 4: Assemble messages
    system_prompt = SYSTEM_PROMPT + policy.system_suffix
    
    memory = []
    if policy.allow_rag:
        raw_docs = await retrieve_relevant_documents(
            _build_rag_query(payload.message, session_history_objs), 
            jwt=current_user.token
        )
        memory = filter_retrieved_chunks(raw_docs, risk)
        
    messages = build_prompt(payload.message, session_history_objs, memory)
    # inject overridden system prompt
    messages[0]["content"] = system_prompt
    
    # Stage 5: Inference
    try:
        response_text = await call_with_fallback(
            messages,
            temperature=policy.temperature_override,
            max_tokens=policy.max_tokens_override
        )
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        response_text = CRISIS_RESPONSE

    # Stage 6: Output safety review
    if check_dependency_language(response_text):
        # Regenerate once
        try:
            response_text = await call_with_fallback(
                messages,
                temperature=0.2,
                max_tokens=policy.max_tokens_override
            )
            if check_dependency_language(response_text):
                response_text = "I'm here to help you reflect. It sounds like connection is important to you — that's worth exploring with people in your life too."
        except:
            response_text = "I'm here to help you reflect. It sounds like connection is important to you — that's worth exploring with people in your life too."
            
    # Clinical advice scan
    clinical_patterns = ["you have ", "you are diagnosed", "you should take", "your medication"]
    if any(p in response_text.lower() for p in clinical_patterns):
        response_text = "I'm not qualified to give medical advice on that. A mental health professional would be the right person to speak to."

    # Stage 7: Persist
    await log_turn(
        user_id=current_user.id,
        message=payload.message,
        response=response_text,
        session_id=payload.session_id,
        risk=risk,
        latency_ms=int((time.time() - start_time) * 1000)
    )

    request.state.user_id = current_user.id
    return ChatResponse(response=response_text)
