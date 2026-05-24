from __future__ import annotations

from dataclasses import dataclass

import logging
import httpx
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.app.config import settings
from backend.db.supabase_client import auth_headers, rest_base_url
from backend.services.embeddings import embed_text, normalize_vector

logger = logging.getLogger("bloom.rag")


@dataclass(slots=True)
class RetrievedDocument:
    id: str
    content: str
    source: str | None = None
    topic: str | None = None
    similarity: float | None = None
    memory_type: str | None = None


def filter_retrieved_chunks(chunks: list[RetrievedDocument], risk_assessment=None) -> list[RetrievedDocument]:
    if risk_assessment:
        if risk_assessment.crisis_indicators or risk_assessment.emotional_intensity in ("high", "critical") or risk_assessment.looping_behavior:
            return []
            
    filtered = []
    for chunk in chunks:
        if chunk.memory_type == "crisis":
            continue
        if risk_assessment and risk_assessment.looping_behavior and chunk.memory_type in ("high", "critical"):
            continue
        filtered.append(chunk)
    
    return filtered[:3]


def chunk_documents(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=900,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


async def retrieve_relevant_documents(query: str, top_k: int | None = None, jwt: str | None = None) -> list[RetrievedDocument]:
    query_embedding = await embed_text(query)
    query_embedding = normalize_vector(query_embedding)
    limit = top_k or settings.rag_top_k

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{rest_base_url()}/rpc/match_documents",
            headers=auth_headers(jwt),
            json={
                "query_embedding": query_embedding,
                "match_threshold": 0.2,
                "match_count": limit,
            },
        )
        if response.status_code == 401 and jwt is not None:
            logger.warning("match_documents failed with 401; retrying with service_role auth.")
            response = await client.post(
                f"{rest_base_url()}/rpc/match_documents",
                headers=auth_headers(None),
                json={
                    "query_embedding": query_embedding,
                    "match_threshold": 0.2,
                    "match_count": limit,
                },
            )
        if not response.is_success:
            raise RuntimeError(f"Unable to load RAG context: {response.status_code} {response.text}")

        rows = response.json()
        documents: list[RetrievedDocument] = []
        for row in rows[:limit]:
            documents.append(
                RetrievedDocument(
                    id=str(row.get("id", "")),
                    content=row.get("content", ""),
                    source=row.get("source"),
                    topic=row.get("topic"),
                    similarity=float(row.get("similarity")) if row.get("similarity") is not None else None,
                )
            )
        return documents
