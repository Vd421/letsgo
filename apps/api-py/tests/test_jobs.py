# Tests for app/jobs.py: the background analysis job, with a FAKE Claude client.
import uuid
from collections.abc import Iterator

import anthropic
import httpx2
import pytest
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session, sessionmaker

from app import jobs
from app.ai import AiTemporaryError
from app.config import settings
from app.jobs import MAX_RETRIES, analyze_session, retry_delay, run_analysis
from app.models import EventBatch, ReplaySession, SessionAnalysis
from tests.ai_fakes import GOOD_REPORT, FakeClient, reply, tool_block
from tests.rrweb_fakes import click, meta, snapshot

MODEL = "test-model"
GOOD_REPLY = reply([tool_block(GOOD_REPORT)])


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE sessions CASCADE"))
    with Session(engine) as db:
        yield db


def make_visit(db: Session, with_events: bool = True) -> uuid.UUID:
    """A saved session with a queued analysis (what the POST route will create)."""
    session = ReplaySession(url="http://localhost:5173/", user_agent="Firefox/130")
    db.add(session)
    db.commit()
    if with_events:
        events = [snapshot(), meta(), click(1000), click(1200), click(1400)]
        db.add(EventBatch(session_id=session.id, events=events))
    db.add(SessionAnalysis(session_id=session.id, status="queued"))
    db.commit()
    return session.id


def current(db: Session, session_id: uuid.UUID) -> SessionAnalysis:
    db.expire_all()  # forget cached rows, so we see what is really in the database
    return db.query(SessionAnalysis).filter_by(session_id=session_id).one()


def temporary_error() -> anthropic.RateLimitError:
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    return anthropic.RateLimitError(
        "slow down", response=httpx2.Response(429, request=request), body=None
    )


def test_success_saves_summary_bugs_model_and_prompt_version(db: Session) -> None:
    sid = make_visit(db)
    run_analysis(db, sid, FakeClient(GOOD_REPLY), MODEL, can_retry=False)

    row = current(db, sid)
    assert row.status == "done"
    assert row.summary == GOOD_REPORT["summary"]
    assert row.bugs == GOOD_REPORT["bugs"]  # stored with the camelCase key atMs
    assert row.model == MODEL
    assert row.prompt_version == "v1"
    assert row.error is None


def test_running_twice_does_not_call_claude_again(db: Session) -> None:
    sid = make_visit(db)
    client = FakeClient(GOOD_REPLY)
    run_analysis(db, sid, client, MODEL, can_retry=False)
    run_analysis(db, sid, client, MODEL, can_retry=False)

    assert len(client.calls) == 1
    assert current(db, sid).status == "done"
    assert db.query(SessionAnalysis).count() == 1


def test_claude_receives_a_digest_without_private_data(db: Session) -> None:
    sid = make_visit(db)
    client = FakeClient(GOOD_REPLY)
    run_analysis(db, sid, client, MODEL, can_retry=False)

    sent = client.calls[0]["messages"][0]["content"]
    assert "Rage click" in sent
    assert "Firefox" in sent
    assert "localhost" not in sent  # only the path of the page is sent, never the host


def test_temporary_error_with_retries_left_requeues_and_raises(db: Session) -> None:
    sid = make_visit(db)
    with pytest.raises(AiTemporaryError):
        run_analysis(db, sid, FakeClient(temporary_error()), MODEL, can_retry=True)

    assert current(db, sid).status == "queued"


def test_temporary_error_on_last_try_marks_failed_with_a_safe_message(db: Session) -> None:
    sid = make_visit(db)
    run_analysis(db, sid, FakeClient(temporary_error()), MODEL, can_retry=False)

    row = current(db, sid)
    assert row.status == "failed"
    assert "busy or slow" in (row.error or "")
    assert "slow down" not in (row.error or "")  # raw API text is not shown


def test_permanent_error_marks_failed_without_retrying(db: Session) -> None:
    sid = make_visit(db)
    run_analysis(db, sid, FakeClient(reply([], stop_reason="refusal")), MODEL, can_retry=True)

    row = current(db, sid)
    assert row.status == "failed"
    assert row.error == "The AI declined to analyse this visit"


def test_unexpected_crash_marks_failed_without_leaking_details(db: Session) -> None:
    sid = make_visit(db)
    run_analysis(db, sid, FakeClient(RuntimeError("secret internal detail")), MODEL, can_retry=True)

    row = current(db, sid)
    assert row.status == "failed"
    assert "secret" not in (row.error or "")


def test_visit_without_events_fails_and_never_calls_claude(db: Session) -> None:
    sid = make_visit(db, with_events=False)
    client = FakeClient(GOOD_REPLY)
    run_analysis(db, sid, client, MODEL, can_retry=True)

    assert client.calls == []
    assert current(db, sid).status == "failed"


def test_missing_analysis_row_is_ignored(db: Session) -> None:
    client = FakeClient(GOOD_REPLY)
    run_analysis(db, uuid.uuid4(), client, MODEL, can_retry=False)
    assert client.calls == []


def test_retry_delay_doubles_up_to_a_ceiling() -> None:
    assert [retry_delay(n) for n in range(4)] == [30, 60, 120, 240]
    assert retry_delay(20) == 600


# --- the Celery task itself, run "eagerly" (right here, no Redis or worker needed) ---


@pytest.fixture
def task_env(engine: Engine, monkeypatch: pytest.MonkeyPatch) -> Iterator[sessionmaker[Session]]:
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(jobs, "SessionLocal", factory)  # the job uses the test database
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "claude_model", MODEL)
    yield factory


def test_task_without_an_api_key_marks_failed(db: Session, task_env, monkeypatch) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    sid = make_visit(db)

    analyze_session.apply(args=[str(sid)]).get()

    row = current(db, sid)
    assert row.status == "failed"
    assert "ANTHROPIC_API_KEY" in (row.error or "")


def test_task_runs_end_to_end(db: Session, task_env, monkeypatch) -> None:
    client = FakeClient(GOOD_REPLY)
    monkeypatch.setattr(jobs, "make_client", lambda: client)
    sid = make_visit(db)

    analyze_session.apply(args=[str(sid)]).get()

    assert current(db, sid).status == "done"
    assert client.calls[0]["model"] == MODEL


def test_task_retries_then_gives_up(db: Session, task_env, monkeypatch) -> None:
    client = FakeClient(temporary_error())
    monkeypatch.setattr(jobs, "make_client", lambda: client)
    sid = make_visit(db)

    analyze_session.apply(args=[str(sid)])

    assert len(client.calls) == MAX_RETRIES + 1  # the first try plus every retry
    assert current(db, sid).status == "failed"


def test_task_marks_failed_when_the_time_limit_hits(db: Session, task_env, monkeypatch) -> None:
    from celery.exceptions import SoftTimeLimitExceeded

    monkeypatch.setattr(jobs, "make_client", lambda: FakeClient(SoftTimeLimitExceeded()))
    sid = make_visit(db)

    analyze_session.apply(args=[str(sid)])

    row = current(db, sid)
    assert row.status == "failed"
    assert row.error == "The analysis took too long"
