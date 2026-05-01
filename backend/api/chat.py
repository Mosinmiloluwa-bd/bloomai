from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.app.dependencies import get_current_user
from backend.models.schemas import ChatRequest, ChatResponse, CurrentUser
from backend.services.routing import process_chat


router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    payload: ChatRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> ChatResponse:
    try:
        result = await process_chat(
            user_id=current_user.id,
            message=payload.message,
            session_id=payload.session_id,
            jwt=current_user.token,
        )
        request.state.route = result.route
        request.state.user_id = current_user.id
        return ChatResponse(response=result.response)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
