from __future__ import annotations

import logging
from pathlib import Path

from supabase import Client, create_client

from backend.app.config import settings
from backend.db.supabase_client import get_supabase_admin_key
from backend.services.embeddings import embed_text, normalize_vector
from backend.services.rag import chunk_documents


logger = logging.getLogger("bloom.ingest")


def collect_files(input_dir: Path) -> list[Path]:
    return [
        path
        for path in input_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in {".txt", ".md"}
    ]


def infer_topic(path: Path) -> str:
    parent = path.parent.name.strip()
    if parent:
        return parent.replace("_", " ").replace("-", " ")
    stem = path.stem.replace("_", " ").replace("-", " ")
    return stem


def read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


async def ingest_file(supabase: Client, path: Path, base_dir: Path) -> int:
    raw_text = read_text_file(path).strip()
    if not raw_text:
        return 0

    chunks = chunk_documents(raw_text)
    records: list[dict[str, object]] = []
    for chunk in chunks:
        embedding = normalize_vector(await embed_text(chunk))
        records.append(
            {
                "content": chunk,
                "embedding": embedding,
                "source": str(path.relative_to(base_dir)),
                "topic": infer_topic(path),
            }
        )

    if records:
        batch_size = 100
        for start in range(0, len(records), batch_size):
            batch = records[start:start + batch_size]
            response = supabase.table("documents").insert(batch).execute()
            if getattr(response, "error", None):
                raise RuntimeError(response.error)

    return len(records)


async def ingest_directory(input_dir: Path) -> int:
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL must be set.")

    supabase = create_client(settings.supabase_url, get_supabase_admin_key())
    files = collect_files(input_dir)
    if not files:
        logger.info("No .txt or .md files found in %s", input_dir)
        return 0

    total_chunks = 0
    for file_path in files:
        chunk_count = await ingest_file(supabase, file_path, input_dir)
        total_chunks += chunk_count
        logger.info("Ingested %s chunk(s) from %s", chunk_count, file_path)

    logger.info("Completed ingestion: %s chunks total", total_chunks)
    return total_chunks

