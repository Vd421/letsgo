# All settings the API needs, read from environment variables in one place.
# Python version of our old config.ts. Values come from the repo-root .env file.
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# This file is apps/api-py/app/config.py, so 3 folders up is the repo root.
REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # Each field = one environment variable (matched by name, ignoring upper/lower case).
    # Pydantic checks the types for us: PORT=abc would fail right away with a clear error.
    port: int = 4000
    database_url: str  # no default → the app refuses to start if DATABASE_URL is missing
    # Websites allowed to call the API from a browser (CORS).
    # 5173 = the demo shop, 5174 = the dashboard (both run with Vite).
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    # Redis: the waiting room for background jobs (Celery).
    redis_url: str = "redis://localhost:6379"
    # Claude API. No key = AI features are switched off (the API says "not configured").
    anthropic_api_key: str | None = None
    claude_model: str = "claude-haiku-5-5"  # cheap and fast; change it in .env
    claude_timeout_seconds: float = 60  # give up on one Claude call after this long

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",  # read .env if it exists (real env vars still win)
        extra="ignore",  # .env may hold keys we don't read (AWS_*, ...)
    )

    @property
    def ai_configured(self) -> bool:
        # `ANTHROPIC_API_KEY=` left empty in .env arrives as "", which counts as not set.
        return bool(self.anthropic_api_key and self.anthropic_api_key.strip())

    @property
    def sqlalchemy_database_url(self) -> str:
        # .env says "postgresql://...". This tells SQLAlchemy to use the psycopg (v3) driver.
        return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)


# One shared settings object. Import it anywhere: `from app.config import settings`
settings = Settings()
