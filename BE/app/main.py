import logging
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic_settings import BaseSettings, SettingsConfigDict
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import create_router
from app.application.models import AppError
from app.application.services import AuthService, WorkspaceService
from app.infrastructure.files import LocalStorage, PypdfExtractor
from app.infrastructure.gemini import GeminiAiProvider
from app.infrastructure.ollama import OllamaAiProvider
from app.infrastructure.repository import SqliteRepository


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    data_dir: Path = Path(__file__).resolve().parents[1] / "data"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    ai_provider: Literal["gemini", "ollama"] = "gemini"
    ollama_model: str = "qwen2.5:3b"
    ollama_url: str = "http://127.0.0.1:11434"
    environment: Literal["development", "production"] = "development"
    secure_cookies: bool = False
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"
    allowed_hosts: str = "localhost,127.0.0.1,testserver"


def create_app(settings=None, ai=None, pdf=None):
    ai_logger = logging.getLogger("paperflow.ai")
    ai_logger.setLevel(logging.INFO)
    if not ai_logger.handlers:
        ai_logger.addHandler(logging.StreamHandler())
    settings = settings or Settings()
    if settings.environment == "production" and not settings.secure_cookies:
        raise RuntimeError("SECURE_COOKIES must be true in production; terminate HTTPS at the edge.")
    repo = SqliteRepository(settings.data_dir / "paperflow.db")
    provider = ai or (
        OllamaAiProvider(settings.ollama_model, settings.ollama_url)
        if settings.ai_provider == "ollama"
        else GeminiAiProvider(settings.gemini_api_key, settings.gemini_model)
    )
    service = WorkspaceService(
        repo,
        provider,
        pdf or PypdfExtractor(),
        LocalStorage(settings.data_dir / "uploads"),
    )
    app = FastAPI(
        title="PaperFlow API",
        version="1.0.0",
        docs_url="/api/docs" if settings.environment == "development" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.environment == "development" else None,
    )
    app.state.service = service
    app.state.repo = repo
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts.split(","))
    origins = set(settings.allowed_origins.split(","))

    @app.middleware("http")
    async def boundaries(request: Request, call_next):
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("origin")
            if (origin and origin not in origins) or request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"message": "Request origin is not allowed."}, status_code=403)
            try:
                if int(request.headers.get("content-length", "0")) > 21 * 1024 * 1024:
                    return JSONResponse({"message": "Upload must be 20 MB or smaller."}, status_code=413)
            except ValueError:
                return JSONResponse({"message": "Invalid request size."}, status_code=400)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(AppError)
    async def app_error(request, exc):
        return JSONResponse({"message": exc.message}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse(
            {
                "message": "Check the submitted fields.",
                "fields": [".".join(map(str, e["loc"])) for e in exc.errors()],
            },
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def unexpected(request, exc):
        logging.getLogger("paperflow").error("Request failed (%s)", type(exc).__name__)
        return JSONResponse(
            {"message": "The request could not be completed. Your saved work is safe."}, status_code=500
        )

    app.include_router(create_router(service, AuthService(repo), settings))
    return app


app = create_app()
