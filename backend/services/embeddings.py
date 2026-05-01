from __future__ import annotations

import hashlib
import math
from typing import Iterable

import httpx

from backend.app.config import settings


class EmbeddingError(RuntimeError):
    pass


def _hash_embedding(text: str, dimension: int) -> list[float]:
    vec = [0.0] * dimension
    if not text:
        return vec

    tokens = text.lower().split()
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        idx = int(digest[:8], 16) % dimension
        vec[idx] += 1.0

    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


async def embed_text(text: str) -> list[float]:
    cleaned = text.strip()
    if not cleaned:
        return [0.0] * settings.embedding_dimension

    if settings.model_api_key:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{settings.model_base_url.rstrip('/')}/embeddings",
                    headers={
                        "Authorization": f"Bearer {settings.model_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.embedding_model,
                        "input": cleaned,
                    },
                )
                if response.is_success:
                    payload = response.json()
                    data = payload.get("data") or []
                    if data:
                        embedding = data[0].get("embedding")
                        if isinstance(embedding, list) and embedding:
                            return [float(value) for value in embedding]
        except Exception:
            pass

    return _hash_embedding(cleaned, settings.embedding_dimension)


def normalize_vector(vector: Iterable[float]) -> list[float]:
    values = [float(v) for v in vector]
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]
