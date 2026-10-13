# Database tables, written as Python classes (replaces prisma/schema.prisma).
# After changing a model: create + apply a migration (see README "Python API").
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
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


class EventBatch(Base):
    """One batch of recorded events (a few seconds of clicks, scrolls, typing) for a session.

    One session has many batches: the recorder sends a new batch every few seconds.
    """

    __tablename__ = "session_events"

    id: Mapped[int] = mapped_column(primary_key=True)  # 1, 2, 3... counted up by Postgres
    # Foreign key: must match a real sessions.id. CASCADE = delete the session → delete its batches.
    # index=True makes "find all batches for this session" fast.
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    events: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)  # the rrweb events, as JSON
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),  # when the batch arrived
    )


class SessionAnalysis(Base):
    """The AI's verdict on one visit: a short summary plus the bugs it spotted.

    One row per session (session_id is unique). Analysing again overwrites the same row,
    so running the job twice never creates duplicates.
    """

    __tablename__ = "session_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    # unique=True: at most one analysis per session. CASCADE: delete the session, delete this.
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), unique=True
    )
    # queued → running → done (or failed). Plain text so adding a state needs no migration.
    status: Mapped[str] = mapped_column(String(20), default="queued")
    summary: Mapped[str | None]  # 2-4 sentences, empty until done
    bugs: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )  # list of {title, severity, atMs, evidence}
    model: Mapped[str | None] = mapped_column(String(100))  # which Claude model wrote it
    error: Mapped[str | None] = mapped_column(String(500))  # short, safe message if it failed
    prompt_version: Mapped[str | None] = mapped_column(String(20))  # which prompt text was used
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
