from __future__ import annotations

import argparse
import asyncio
import logging
from pathlib import Path

import sys

# Ensure the repo root is importable when running this file directly.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.services.ingestion import ingest_directory


async def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Bloom knowledge base documents into Supabase.")
    parser.add_argument(
        "--input",
        default="backend/knowledge_base",
        help="Folder containing .txt or .md knowledge files.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input).resolve()
    if not input_dir.exists():
        raise FileNotFoundError(f"Input folder not found: {input_dir}")
    await ingest_directory(input_dir)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    asyncio.run(main())
