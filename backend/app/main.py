from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.api.admin import router as admin_router
from backend.api.chat import router as chat_router
from backend.app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("bloom")

app = FastAPI(title="Bloom Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "apikey", "x-client-info"],
)

app.include_router(chat_router)
app.include_router(admin_router)


@app.on_event("startup")
async def validate_config() -> None:
    """Check for required environment variables at startup.

    Logs a loud, clear warning so that Render/deployment logs reveal
    config problems immediately — rather than silently on every user message.
    """
    required = {
        "MODEL_API_KEY": settings.model_api_key,
        "SUPABASE_URL": settings.supabase_url,
        "SUPABASE_JWT_SECRET": settings.supabase_jwt_secret,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        logger.critical("=" * 60)
        logger.critical("BLOOM STARTUP — MISSING REQUIRED ENV VARS: %s", ", ".join(missing))
        logger.critical("Chat will fail on every request until these are set in Render.")
        logger.critical("=" * 60)
    else:
        logger.info("Bloom startup OK — all required env vars present.")

    if not settings.stackai_api_url or not settings.stackai_api_key:
        logger.warning("StackAI fallback is NOT configured (STACKAI_API_URL / STACKAI_API_KEY missing). "
                       "The primary RAG backend is the only chat path.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ping")
async def ping() -> dict[str, str]:
    """Keep-alive endpoint. Point UptimeRobot here every 5 minutes to prevent cold starts."""
    return {"status": "ok"}


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    route = getattr(request.state, "route", "unknown")
    user_id = getattr(request.state, "user_id", "anonymous")
    logger.info(
        "request method=%s path=%s status=%s user_id=%s route=%s",
        request.method,
        request.url.path,
        response.status_code,
        user_id,
        route,
    )
    return response
