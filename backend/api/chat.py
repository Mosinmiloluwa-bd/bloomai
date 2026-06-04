import time
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
import json

from backend.app.config import settings
from backend.models.schemas import ChatRequest, ChatResponse, CurrentUser
from backend.app.dependencies import get_current_user
from backend.services.classifier import classify_intent, apply_behavioral_policy, MANIPULATION_DEFLECTION
from backend.services.llm import CRISIS_RESPONSE, detect_crisis, call_with_fallback, check_dependency_language, SYSTEM_PROMPT, build_prompt
from backend.services.memory import get_history, save_message
from backend.services.rag import retrieve_relevant_documents, filter_retrieved_chunks, _build_rag_query
from backend.db.logging import log_turn

import logging

router = APIRouter()
logger = logging.getLogger("bloom.chat")

@router.post("/chat")
async def chat_endpoint(
    payload: ChatRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> ChatResponse:
    start_time = time.time()
    request.state.user_id = current_user.id
    
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
        return JSONResponse(content={"response": CRISIS_RESPONSE})
        
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
        return JSONResponse(content={"response": MANIPULATION_DEFLECTION})
        
    async def generate_response():
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
        messages[0]["content"] = system_prompt
        
        # Stage 5: Inference
        buffer = []
        stream_failed = False
        from backend.services.llm import stream_from_groq
        try:
            async for chunk in stream_from_groq(
                messages,
                temperature=policy.temperature_override,
                max_tokens=policy.max_tokens_override
            ):
                if chunk == "data: [DONE]\n\n":
                    pass # Handled after Stage 6
                elif chunk.startswith("data: {"):
                    try:
                        data = json.loads(chunk[6:].strip())
                        if "text" in data:
                            buffer.append(data["text"])
                        elif "error" in data:
                            stream_failed = True
                    except:
                        pass
                    yield chunk
        except Exception as e:
            logger.error(f"Inference stream failed: {e}")
            stream_failed = True

        if not stream_failed:
            full_response = "".join(buffer)
            
            # Stage 6: Output safety review
            safe = True
            if check_dependency_language(full_response):
                safe = False
            clinical_patterns = ["you have ", "you are diagnosed", "you should take", "your medication"]
            if any(p in full_response.lower() for p in clinical_patterns):
                safe = False
                
            if not safe:
                safe_fallback = "I'm here to help you reflect. It sounds like connection is important to you — that's worth exploring with people in your life too."
                yield f"data: {json.dumps({'replace': safe_fallback})}\n\n"
                full_response = safe_fallback
            else:
                yield "data: [DONE]\n\n"

            # Stage 7: Persist
            await save_message(
                user_id=current_user.id,
                role="user",
                content=payload.message,
                session_id=payload.session_id,
                jwt=current_user.token
            )
            
            await save_message(
                user_id=current_user.id,
                role="assistant",
                content=full_response,
                session_id=payload.session_id,
                jwt=current_user.token
            )

            await log_turn(
                user_id=current_user.id,
                message=payload.message,
                response=full_response,
                session_id=payload.session_id,
                risk=risk,
                latency_ms=int((time.time() - start_time) * 1000)
            )

    return StreamingResponse(generate_response(), media_type="text/event-stream")
