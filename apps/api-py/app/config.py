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
    # 5173 = the demo shop, 5174 = the dashboard (both run with Vite). Browsers may show either
    # "localhost" or "127.0.0.1" for this computer, so both are allowed.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",  # read .env if it exists (real env vars still win)
        extra="ignore",  # .env has other keys (REDIS_URL, ...) we don't need yet
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        # .env says "postgresql://...". This tells SQLAlchemy to use the psycopg (v3) driver.
        return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)


# One shared settings object. Import it anywhere: `from app.config import settings`
settings = Settings()
