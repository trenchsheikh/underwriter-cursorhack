from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.init_db import init_db
from app.schemas.common import HealthStatus

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(debug=settings.debug)
    init_db()
    log.info("startup", env=settings.app_env, version=__version__)
    yield
    log.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Underwriter API",
        version=__version__,
        description=(
            "Backend service for loan underwriting: applicants, applications, "
            "documents, rule-based risk scoring, and decisioning."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", response_model=HealthStatus, tags=["meta"])
    def health() -> HealthStatus:
        return HealthStatus(status="ok", version=__version__, env=settings.app_env)

    @app.get("/", tags=["meta"])
    def root() -> dict:
        return {
            "name": "Underwriter API",
            "version": __version__,
            "docs": "/docs",
            "health": "/health",
        }

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
