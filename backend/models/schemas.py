from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    session_id: str | None = Field(default=None, max_length=128)


class ChatResponse(BaseModel):
    response: str


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    token: str
    claims: dict = Field(default_factory=dict)

