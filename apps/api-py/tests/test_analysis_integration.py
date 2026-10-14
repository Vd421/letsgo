# T1 integration tests: real Postgres (replay_test) + real Celery task run eagerly + FAKE Claude.
# No network, no Redis, no real Claude calls. Route-level tests are added once the routes exist.
import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session, sessionmaker

from app import jobs
from app.config import settings
from app.digest import build_digest
from app.jobs import analyze_session
from app.models import EventBatch, ReplaySession, SessionAnalysis
from tests.ai_fakes import GOOD_REPORT, FakeClient, reply, tool_block
from tests.rrweb_fakes import click, console_error, meta, mutation, snapshot, typing

GOOD = reply([tool_block(GOOD_REPORT)])
SECRET = "secret@example.com"


@pytest.fixture
def db(engine: Engine, monkeypatch: pytest.MonkeyPatch) -> Iterator[Session]:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE sessions CASCADE"))
    monkeypatch.setattr(jobs, "SessionLocal", sessionmaker(bind=engine))
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "claude_model", "test-model")
    with Session(engine) as db:
        yield db
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE sessions CASCADE"))


def make_visit(db: Session, events: list | None, status: str | None = "queued") -> uuid.UUID:
    session = ReplaySession(url="http://localhost:5173/checkout?email=a@b.c", user_agent="Edg/1")
    db.add(session)
    db.commit()
    if events is not None:
        db.add(EventBatch(session_id=session.id, events=events))
    if status:
        db.add(SessionAnalysis(session_id=session.id, status=status))
    db.commit()
    return session.id


def row(db: Session, sid: uuid.UUID) -> SessionAnalysis:
    db.expire_all()
    return db.query(SessionAnalysis).filter_by(session_id=sid).one()


# The deliberate checkout bug: user fills the form, clicks Checkout, page never reacts.
BUG_EVENTS = [
    snapshot(),
    meta(),
    typing(500),
    typing(900),
    click(3000),
    click(3300),
    click(3600),
    click(3900),
]


def test_checkout_bug_session_end_to_end(db: Session, monkeypatch) -> None:
    client = FakeClient(GOOD)
    monkeypatch.setattr(jobs, "make_client", lambda: client)
    sid = make_visit(db, BUG_EVENTS)

    analyze_session.apply(args=[str(sid)]).get()

    r = row(db, sid)
    assert r.status == "done" and r.bugs[0]["atMs"] == 4200
    sent = client.calls[0]["messages"][0]["content"]
    assert 'Rage click on "Checkout"' in sent
    assert "/checkout" in sent and "?email" not in sent and "a@b.c" not in sent
    assert SECRET not in sent and "Typed in the email box (text hidden)" in sent


def test_digest_never_contains_typed_text_or_full_user_agent() -> None:
    digest = build_digest("http://x.test/p?q=1#f", "Mozilla/5.0 Edg/1 secretUA", BUG_EVENTS)
    assert SECRET not in digest and "secretUA" not in digest and "Mozilla" not in digest
    assert "Browser: Edge" in digest


def test_digest_calm_session_has_no_rage_and_console_errors_listed() -> None:
    events = [snapshot(), meta(), click(1000), mutation(1100), console_error(1200, "boom")]
    digest = build_digest("http://x.test/", None, events)
    assert "Rage click" not in digest
    assert "boom" in digest and "Browser: unknown" in digest


def test_digest_of_empty_event_list_does_not_crash() -> None:
    digest = build_digest("http://x.test/", None, [])
    assert "nothing happened" in digest


def test_digest_ignores_garbage_events() -> None:
    junk = [{"type": 3}, {"type": 3, "timestamp": "x", "data": None}, {}, snapshot(), meta()]
    assert "Start page" in build_digest("http://x.test/", None, junk)


def test_digest_is_capped_for_long_sessions() -> None:
    events = [snapshot(), meta()] + [typing(i * 5000) for i in range(1, 400)]
    digest = build_digest("http://x.test/", None, events)
    assert "more moments left out" in digest
    assert len(digest.splitlines()) < 200


def test_empty_session_task_fails_safely_without_calling_claude(db: Session, monkeypatch) -> None:
    client = FakeClient(GOOD)
    monkeypatch.setattr(jobs, "make_client", lambda: client)
    sid = make_visit(db, None)
    analyze_session.apply(args=[str(sid)]).get()
    assert client.calls == [] and row(db, sid).status == "failed"


def test_task_for_unknown_session_is_a_noop(db: Session, monkeypatch) -> None:
    client = FakeClient(GOOD)
    monkeypatch.setattr(jobs, "make_client", lambda: client)
    analyze_session.apply(args=[str(uuid.uuid4())]).get()
    assert client.calls == []
    assert db.query(SessionAnalysis).count() == 0


def test_no_api_key_does_not_overwrite_a_done_analysis(db: Session, monkeypatch) -> None:
    sid = make_visit(db, BUG_EVENTS, status="done")
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    analyze_session.apply(args=[str(sid)]).get()
    assert row(db, sid).status == "done"


@pytest.mark.parametrize(
    "bad_reply",
    [
        reply(
            [
                tool_block(
                    {
                        "summary": "ok",
                        "bugs": [{"title": "t", "severity": "critical", "evidence": "e"}],
                    }
                )
            ]
        ),
        reply([tool_block({"summary": "", "bugs": []})]),
        reply([tool_block({"summary": "ok"})]),
        reply([tool_block(GOOD_REPORT, name="some_other_tool")]),
        reply([]),
        reply([tool_block({"summary": "ok", "bugs": [GOOD_REPORT["bugs"][0]] * 11})]),
        reply([tool_block("not even a dict")]),
    ],
)
def test_malformed_claude_replies_become_failed_with_safe_error(db, monkeypatch, bad_reply) -> None:
    monkeypatch.setattr(jobs, "make_client", lambda: FakeClient(bad_reply))
    sid = make_visit(db, BUG_EVENTS)
    analyze_session.apply(args=[str(sid)]).get()
    r = row(db, sid)
    assert r.status == "failed" and r.error and len(r.error) < 200
    assert r.summary is None and r.bugs == []


def test_reanalysis_after_failure_succeeds_and_keeps_one_row(db: Session, monkeypatch) -> None:
    monkeypatch.setattr(jobs, "make_client", lambda: FakeClient(RuntimeError("x")))
    sid = make_visit(db, BUG_EVENTS)
    analyze_session.apply(args=[str(sid)]).get()
    assert row(db, sid).status == "failed"

    # What the POST route will do for a re-analysis: reset to queued, then run again.
    r = row(db, sid)
    r.status, r.error = "queued", None
    db.commit()
    monkeypatch.setattr(jobs, "make_client", lambda: FakeClient(GOOD))
    analyze_session.apply(args=[str(sid)]).get()

    r = row(db, sid)
    assert r.status == "done" and r.error is None and r.model == "test-model"
    assert db.query(SessionAnalysis).count() == 1


def test_bugs_with_null_at_ms_are_stored(db: Session, monkeypatch) -> None:
    report = {
        "summary": "Fine.",
        "bugs": [{"title": "t", "severity": "low", "atMs": None, "evidence": "e"}],
    }
    monkeypatch.setattr(jobs, "make_client", lambda: FakeClient(reply([tool_block(report)])))
    sid = make_visit(db, BUG_EVENTS)
    analyze_session.apply(args=[str(sid)]).get()
    assert row(db, sid).bugs[0]["atMs"] is None


def test_deleting_session_removes_analysis(db: Session, monkeypatch) -> None:
    monkeypatch.setattr(jobs, "make_client", lambda: FakeClient(GOOD))
    sid = make_visit(db, BUG_EVENTS)
    analyze_session.apply(args=[str(sid)]).get()
    db.execute(text("DELETE FROM sessions WHERE id = :i"), {"i": sid})
    db.commit()
    assert db.query(SessionAnalysis).count() == 0


# --- Through the HTTP API, with the real Celery task running eagerly (inline) ---------------

from concurrent.futures import ThreadPoolExecutor  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.celery_app import celery_app  # noqa: E402
from app.routes import analysis as analysis_routes  # noqa: E402


@pytest.fixture
def api(client: TestClient, engine: Engine, monkeypatch) -> TestClient:
    monkeypatch.setattr(jobs, "SessionLocal", sessionmaker(bind=engine))
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "claude_model", "test-model")
    monkeypatch.setattr(celery_app.conf, "task_always_eager", True)
    monkeypatch.setattr(celery_app.conf, "task_eager_propagates", False)
    return client


def new_session(api: TestClient, events: list | None = None) -> str:
    sid = api.post("/sessions", json={"url": "http://localhost:5173/"}).json()["id"]
    if events is not None:
        assert api.post(f"/sessions/{sid}/events", json={"events": events}).status_code < 300
    return sid


def test_api_flow_post_runs_job_then_get_returns_done(api, monkeypatch) -> None:
    client = FakeClient(GOOD)
    monkeypatch.setattr(jobs, "make_client", lambda: client)
    sid = new_session(api, BUG_EVENTS)

    assert api.get(f"/sessions/{sid}/analysis").status_code == 404  # never analysed
    assert api.get(f"/sessions/{sid}").json()["aiStatus"] is None

    post = api.post(f"/sessions/{sid}/analysis")
    assert post.status_code == 202

    body = api.get(f"/sessions/{sid}/analysis").json()
    assert body["status"] == "done" and body["model"] == "test-model"
    assert body["bugs"][0]["atMs"] == 4200 and body["summary"]
    summary = api.get(f"/sessions/{sid}").json()
    assert summary["aiStatus"] == "done" and summary["aiBugCount"] == 1
    listed = next(s for s in api.get("/sessions").json() if s["id"] == sid)
    assert listed["aiBugCount"] == 1 and listed["hasRage"] is True
    assert len(client.calls) == 1


def test_api_reanalysis_calls_claude_again_and_keeps_one_row(api, monkeypatch) -> None:
    client = FakeClient(GOOD)
    monkeypatch.setattr(jobs, "make_client", lambda: client)
    sid = new_session(api, BUG_EVENTS)
    assert api.post(f"/sessions/{sid}/analysis").status_code == 202
    assert api.post(f"/sessions/{sid}/analysis").status_code == 202  # done -> allowed again
    assert len(client.calls) == 2
    assert api.get(f"/sessions/{sid}/analysis").json()["status"] == "done"


def test_api_claude_error_gives_failed_status_and_safe_message(api, monkeypatch) -> None:
    monkeypatch.setattr(jobs, "make_client", lambda: FakeClient(RuntimeError("sk-ant-LEAK")))
    sid = new_session(api, BUG_EVENTS)
    assert api.post(f"/sessions/{sid}/analysis").status_code == 202
    body = api.get(f"/sessions/{sid}/analysis").json()
    assert body["status"] == "failed" and "LEAK" not in (body["error"] or "")
    assert api.get(f"/sessions/{sid}").json()["aiStatus"] == "failed"


def test_api_empty_session_fails_without_calling_claude(api, monkeypatch) -> None:
    client = FakeClient(GOOD)
    monkeypatch.setattr(jobs, "make_client", lambda: client)
    sid = new_session(api)
    assert api.post(f"/sessions/{sid}/analysis").status_code == 202
    assert api.get(f"/sessions/{sid}/analysis").json()["status"] == "failed"
    assert client.calls == []


def test_api_unknown_and_invalid_ids(api) -> None:
    unknown = uuid.uuid4()
    assert api.post(f"/sessions/{unknown}/analysis").status_code == 404
    assert api.get(f"/sessions/{unknown}/analysis").status_code == 404
    assert api.post("/sessions/not-a-uuid/analysis").status_code == 422
    assert api.get("/sessions/not-a-uuid/analysis").status_code == 422


def test_api_no_key_is_503_with_exact_message_and_no_row(api, monkeypatch) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    sid = new_session(api, BUG_EVENTS)
    r = api.post(f"/sessions/{sid}/analysis")
    assert r.status_code == 503
    assert r.json() == {"detail": "AI is not configured: add ANTHROPIC_API_KEY to .env"}
    assert api.get(f"/sessions/{sid}/analysis").status_code == 404
    assert api.get("/config/ai").json()["configured"] is False


def test_api_config_ai_camel_case_and_model(api) -> None:
    assert api.get("/config/ai").json() == {"configured": True, "model": "test-model"}


def test_api_redis_down_gives_503_and_failed_row(api, monkeypatch) -> None:
    from kombu.exceptions import OperationalError

    def boom(*_a, **_k):
        raise OperationalError("redis down")

    monkeypatch.setattr(analysis_routes.analyze_session, "delay", boom)
    sid = new_session(api, BUG_EVENTS)
    r = api.post(f"/sessions/{sid}/analysis")
    assert r.status_code == 503 and "Redis" in r.json()["detail"]
    assert api.get(f"/sessions/{sid}/analysis").json()["status"] == "failed"


def test_api_concurrent_posts_queue_exactly_one_job(api, monkeypatch) -> None:
    queued: list[str] = []
    monkeypatch.setattr(analysis_routes.analyze_session, "delay", lambda s: queued.append(s))
    sid = new_session(api, BUG_EVENTS)
    with ThreadPoolExecutor(6) as pool:
        codes = list(
            pool.map(lambda _: api.post(f"/sessions/{sid}/analysis").status_code, range(6))
        )
    assert sorted(codes) == [202] + [409] * 5
    assert len(queued) == 1


def test_api_409_returns_current_analysis_json(api, monkeypatch) -> None:
    monkeypatch.setattr(analysis_routes.analyze_session, "delay", lambda s: None)
    sid = new_session(api, BUG_EVENTS)
    assert api.post(f"/sessions/{sid}/analysis").status_code == 202
    r = api.post(f"/sessions/{sid}/analysis")
    assert r.status_code == 409 and r.json()["status"] == "queued"
    assert r.json()["sessionId"] == sid
    assert api.get(f"/sessions/{sid}").json()["aiStatus"] == "queued"


def test_api_deleted_data_cleanup_leaves_no_analyses(api, engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE sessions CASCADE"))
        assert conn.scalar(text("SELECT count(*) FROM session_analyses")) == 0
