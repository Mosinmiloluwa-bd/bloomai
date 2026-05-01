from __future__ import annotations

import hashlib
import json
import re
from typing import Iterable


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def truncate_text(text: str, limit: int = 4000) -> str:
    cleaned = normalize_whitespace(text)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 3].rstrip() + "..."


def render_history(history: Iterable[dict[str, str]]) -> str:
    lines: list[str] = []
    for item in history:
        role = item.get("role", "user")
        content = truncate_text(item.get("content", ""), 1200)
        lines.append(f"{role.upper()}: {content}")
    return "\n".join(lines)


def render_documents(documents: Iterable[dict[str, str]]) -> str:
    blocks: list[str] = []
    for doc in documents:
        source = doc.get("source", "unknown")
        topic = doc.get("topic", "general")
        content = truncate_text(doc.get("content", ""), 900)
        blocks.append(f"[Source: {source} | Topic: {topic}]\n{content}")
    return "\n\n".join(blocks)


def stable_bucket(value: str, modulo: int = 100) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % modulo


def json_dumps_compact(payload: dict) -> str:
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)

