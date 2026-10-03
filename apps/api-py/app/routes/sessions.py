# Routes for /sessions: save a new session, and list saved sessions.
from fastapi import APIRouter, status
from sqlalchemy import select

from app.db import DbSession
from app.models import ReplaySession
from app.schemas import SessionCreate, SessionOut

router = APIRouter(prefix="/sessions", tags=["sessions"])


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


# GET /sessions → list all saved sessions, newest first.
@router.get("", response_model=list[SessionOut])
def list_sessions(db: DbSession) -> list[ReplaySession]:
    return list(db.scalars(select(ReplaySession).order_by(ReplaySession.started_at.desc())))
