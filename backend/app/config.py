from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


from pydantic import BaseModel

class ModelConfig(BaseModel):
    primary: str = "meta-llama/llama-3.1-8b-instruct:free"
    fallbacks: list[str] = [
        "mistralai/mistral-7b-instruct:free",
        "qwen/qwen-2.5-7b-instruct:free"
    ]
    temperature: float = 0.4
    max_tokens: int = 512
    top_p: float = 0.85
    frequency_penalty: float = 0.3

MODEL_CONFIG = ModelConfig()


@dataclass(frozen=True)
class Settings:
    supabase_url: str = field(default_factory=lambda: _env("SUPABASE_URL"))
    supabase_service_role_key: str = field(default_factory=lambda: _env("SUPABASE_SERVICE_ROLE_KEY"))
    supabase_jwt_secret: str = field(default_factory=lambda: _env("SUPABASE_JWT_SECRET"))
    model_api_key: str = field(default_factory=lambda: _env("MODEL_API_KEY"))
    model_base_url: str = field(default_factory=lambda: _env("MODEL_BASE_URL", "https://api.openai.com/v1"))
    model_name: str = field(default_factory=lambda: _env("MODEL_NAME", "gpt-4o-mini"))
    embedding_model: str = field(default_factory=lambda: _env("EMBEDDING_MODEL", "text-embedding-3-small"))
    routing_percentage: int = field(default_factory=lambda: int(_env("ROUTING_PERCENTAGE", "100") or 100))
    production_frontend_url: str = field(default_factory=lambda: _env("PRODUCTION_FRONTEND_URL"))
    app_name: str = field(default_factory=lambda: _env("APP_NAME", "Bloom"))
    rag_top_k: int = field(default_factory=lambda: int(_env("RAG_TOP_K", "4") or 4))
    embedding_dimension: int = field(default_factory=lambda: int(_env("EMBEDDING_DIMENSION", "1536") or 1536))

    def allowed_origins(self) -> list[str]:
        origins = ["http://localhost:8080", "http://127.0.0.1:8080"]
        if self.production_frontend_url:
            origins.append(self.production_frontend_url.rstrip("/"))
        return origins


settings = Settings()
