from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    app_name: str = "underwriter"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    database_url: str = "sqlite:///./underwriter.db"

    jwt_secret: str = "change-me-in-prod-please"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    cors_origins: list[str] = Field(default_factory=lambda: ["*"])

    bootstrap_admin_email: str = "admin@underwriter.example"
    bootstrap_admin_password: str = "admin12345"

    upload_dir: str = "uploads"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
