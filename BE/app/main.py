import logging
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic_settings import BaseSettings, SettingsConfigDict
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import create_router
from app.application.models import AppError
from app.application.billing import BillingService
from app.application.services import AuthService, WorkspaceService
from app.infrastructure.files import LocalStorage, PypdfExtractor
from app.infrastructure.gemini import GeminiAiProvider
from app.infrastructure.ollama import OllamaAiProvider
from app.infrastructure.postgres_repository import PostgresRepository
from app.infrastructure.postgres_storage import PostgresStorage
from app.infrastructure.repository import SqliteRepository
from app.infrastructure.payos_gateway import PayOSGateway


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
    cookie_samesite: Literal["strict", "lax", "none"] = "strict"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"
    allowed_hosts: str = "localhost,127.0.0.1,testserver"
    database_url: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_bucket: str = "paperflow"
    initial_admin_email: str = "lamhoangnhan20000@gmail.com"
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    payos_client_id: str = ""
    payos_api_key: str = ""
    payos_checksum_key: str = ""
    payos_return_url: str = "http://localhost:5173/billing/result"
    payos_cancel_url: str = "http://localhost:5173/billing/result"


def create_app(settings=None, ai=None, pdf=None, payment_gateway=None):
    ai_logger = logging.getLogger("paperflow.ai")
    ai_logger.setLevel(logging.INFO)
    if not ai_logger.handlers:
        ai_logger.addHandler(logging.StreamHandler())
    settings = settings or Settings()
    if settings.environment == "production" and not settings.secure_cookies:
        raise RuntimeError("SECURE_COOKIES must be true in production; terminate HTTPS at the edge.")
    if settings.cookie_samesite == "none" and not settings.secure_cookies:
        raise RuntimeError("COOKIE_SAMESITE=none requires SECURE_COOKIES=true.")
    if settings.environment == "production" and not settings.database_url:
        raise RuntimeError("DATABASE_URL is required in production.")
    gateway = payment_gateway or PayOSGateway(
        settings.payos_client_id, settings.payos_api_key, settings.payos_checksum_key
    )
    payos_ready = gateway.configured
    repo = (
        PostgresRepository(settings.database_url, payos_ready)
        if settings.database_url
        else SqliteRepository(settings.data_dir / "paperflow.db", payos_ready)
    )
    provider = ai or (
        OllamaAiProvider(settings.ollama_model, settings.ollama_url)
        if settings.ai_provider == "ollama"
        else GeminiAiProvider(settings.gemini_api_key, settings.gemini_model)
    )
    storage = (
        PostgresStorage(settings.database_url)
        if settings.database_url
        else LocalStorage(settings.data_dir / "uploads")
    )
    service = WorkspaceService(
        repo,
        provider,
        pdf or PypdfExtractor(),
        storage,
    )
    app = FastAPI(
        title="PaperFlow API",
        version="1.0.0",
        docs_url="/api/docs" if settings.environment == "development" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.environment == "development" else None,
    )
    auth = AuthService(repo, settings.initial_admin_email)
    auth.bootstrap_admin(settings.bootstrap_admin_email, settings.bootstrap_admin_password)
    app.state.service = service
    app.state.repo = repo
    app.state.billing = BillingService(
        repo,
        gateway,
        settings.payos_return_url,
        settings.payos_cancel_url,
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts.split(","))
    origins = set(settings.allowed_origins.split(","))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def boundaries(request: Request, call_next):
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("origin")
            if origin and origin not in origins:
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

    app.include_router(create_router(service, auth, settings, app.state.billing))
    return app


app = create_app()
