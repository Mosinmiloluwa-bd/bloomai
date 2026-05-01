from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.app.dependencies import get_current_user
from backend.models.schemas import CurrentUser
from backend.services.ingestion import ingest_directory


router = APIRouter(prefix="/admin", tags=["admin"])


class ReingestRequest(BaseModel):
    input_dir: str = Field(default="backend/knowledge_base", max_length=512)


class ReingestResponse(BaseModel):
    chunks_ingested: int


@router.post("/reingest-documents", response_model=ReingestResponse)
async def reingest_documents(
    payload: ReingestRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> ReingestResponse:
    if current_user.claims.get("role") != "service_role":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Service role access required.")

    input_dir = Path(payload.input_dir).expanduser().resolve()
    if not input_dir.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Input directory not found: {input_dir}")

    chunks = await ingest_directory(input_dir)
    return ReingestResponse(chunks_ingested=chunks)

