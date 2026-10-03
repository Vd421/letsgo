# Routes for /sessions: save and list sessions, and save and read their recorded events.
import uuid
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.analysis import analyze
from app.db import DbSession
from app.models import EventBatch, ReplaySession
from app.schemas import (
    ClickMark,
    EventBatchCreate,
    EventBatchSaved,
    SessionCreate,
    SessionOut,
    SessionSummary,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])

# Most click marks sent per session for the "clicks over time" strip (keeps answers small).
MAX_CLICK_MARKS = 300


def load_events(
    db: DbSession, session_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[dict[str, Any]]]:
    """All recorded events for these sessions, in one database query, grouped by session."""
    events: dict[uuid.UUID, list[dict[str, Any]]] = defaultdict(list)
    if session_ids:
        batches = db.scalars(
            select(EventBatch).where(EventBatch.session_id.in_(session_ids)).order_by(EventBatch.id)
        )
        for batch in batches:
            events[batch.session_id].extend(batch.events)
    return events


def summarize(session: ReplaySession, events: list[dict[str, Any]]) -> SessionSummary:
    """The session's own fields, plus what analysis found in its events."""
    result = analyze(events)
    duration = result.duration_ms or 1  # avoid dividing by zero for empty visits
    return SessionSummary(
        **SessionOut.model_validate(session).model_dump(),
        duration_ms=result.duration_ms,
        click_count=len(result.clicks),
        rage_click_count=result.rage_click_count,
        has_rage=result.has_rage,
        clicks=[
            ClickMark(at=round(c.at_ms / duration, 4), rage=c.rage)
            for c in result.clicks[:MAX_CLICK_MARKS]
        ],
    )


# POST /sessions → check the data, save it, reply with the saved session.
# FastAPI checks the body against SessionCreate BEFORE this function runs.
# Bad data gets an automatic 422 reply that says which field is wrong and why.
@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(body: SessionCreate, db: DbSession) -> ReplaySession:
    session = ReplaySession(url=str(body.url), user_agent=body.user_agent)
    db.add(session)  # stage the new row
    db.commit()  # actually save it
    db.refresh(session)  # reload it, so we get values Postgres filled in (started_at)
    return session


# GET /sessions → list all saved sessions, newest first, each with its analysis.
# (Analysing on every request is fine for now; Phase 5 moves heavy work to background jobs.)
@router.get("", response_model=list[SessionSummary])
def list_sessions(db: DbSession) -> list[SessionSummary]:
    sessions = list(db.scalars(select(ReplaySession).order_by(ReplaySession.started_at.desc())))
    events = load_events(db, [s.id for s in sessions])
    return [summarize(s, events[s.id]) for s in sessions]


def get_session_or_404(db: DbSession, session_id: uuid.UUID) -> ReplaySession:
    # 404 = "no session with that ID". Stops here instead of saving events for nobody.
    session = db.get(ReplaySession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


# GET /sessions/{id} → one session's details (the replay page shows these above the player).
@router.get("/{session_id}", response_model=SessionSummary)
def get_session(session_id: uuid.UUID, db: DbSession) -> SessionSummary:
    session = get_session_or_404(db, session_id)
    return summarize(session, load_events(db, [session.id])[session.id])


# POST /sessions/{id}/events → the recorder sends a batch of events every few seconds.
@router.post(
    "/{session_id}/events",
    response_model=EventBatchSaved,
    status_code=status.HTTP_201_CREATED,
)
def add_events(session_id: uuid.UUID, body: EventBatchCreate, db: DbSession) -> EventBatchSaved:
    session = get_session_or_404(db, session_id)

    db.add(EventBatch(session_id=session.id, events=body.events))
    # Let Postgres do the adding ("event_count + 10"), so two batches arriving at the
    # same moment can't overwrite each other's count.
    session.event_count = ReplaySession.event_count + len(body.events)
    db.commit()
    db.refresh(session)  # reload to read the new total

    return EventBatchSaved(received=len(body.events), event_count=session.event_count)


# GET /sessions/{id}/events → every event of a session, oldest first, as one list.
# The replay player (Phase 3) feeds this list to rrweb to rebuild the visit.
@router.get("/{session_id}/events")
def list_events(session_id: uuid.UUID, db: DbSession) -> list[dict[str, Any]]:
    get_session_or_404(db, session_id)

    batches = db.scalars(
        select(EventBatch).where(EventBatch.session_id == session_id).order_by(EventBatch.id)
    )
    # Glue the batches back together: [[a, b], [c]] → [a, b, c]
    return [event for batch in batches for event in batch.events]
