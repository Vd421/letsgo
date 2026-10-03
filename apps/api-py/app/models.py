# Database tables, written as Python classes (replaces prisma/schema.prisma).
# After changing a model: create + apply a migration (see README "Python API").
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ReplaySession(Base):
    """One recorded visit to a website.

    Called ReplaySession (not Session) so it can't be confused with SQLAlchemy's
    database Session.
    """

    __tablename__ = "sessions"

    # Mapped[...] says the Python type. "| None" means the column is optional (can be empty).
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    url: Mapped[str]  # page where the recording started
    user_agent: Mapped[str | None] = mapped_column(String(500))  # visitor's browser info
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),  # filled in by Postgres
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event_count: Mapped[int] = mapped_column(default=0, server_default="0")
