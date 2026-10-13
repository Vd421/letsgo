# Tests for the session_analyses table (model SessionAnalysis): defaults, one row per session,
# and deleting a session removes its analysis.
import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import ReplaySession, SessionAnalysis


@pytest.fixture
def db(engine: Engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE sessions CASCADE"))
    with Session(engine) as db:
        yield db


def make_session(db: Session) -> ReplaySession:
    session = ReplaySession(url="http://localhost:5173/")
    db.add(session)
    db.commit()
    return session


def test_new_analysis_gets_sensible_defaults(db: Session) -> None:
    session = make_session(db)
    db.add(SessionAnalysis(session_id=session.id))
    db.commit()

    row = db.query(SessionAnalysis).one()
    assert row.status == "queued"
    assert row.bugs == []
    assert row.summary is None
    assert row.created_at is not None
    assert row.updated_at is not None


def test_only_one_analysis_per_session(db: Session) -> None:
    session = make_session(db)
    db.add(SessionAnalysis(session_id=session.id))
    db.commit()

    db.add(SessionAnalysis(session_id=session.id))
    with pytest.raises(IntegrityError):
        db.commit()


def test_deleting_a_session_deletes_its_analysis(db: Session) -> None:
    session = make_session(db)
    db.add(SessionAnalysis(session_id=session.id, status="done", summary="ok"))
    db.commit()

    db.execute(text("DELETE FROM sessions"))
    db.commit()
    assert db.query(SessionAnalysis).count() == 0
