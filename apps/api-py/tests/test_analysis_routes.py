# Tests for the AI routes: POST/GET /sessions/{id}/analysis, GET /config/ai, and the
# aiStatus / aiBugCount fields on sessions. The Celery queue is faked, so Redis is not needed.
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from kombu.exceptions import OperationalError
from redis.exceptions import ConnectionError as RedisError
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.config import settings
from app.models import SessionAnalysis
from app.routes import analysis as analysis_routes
from app.routes.analysis import STALE_AFTER
from app.schemas import SessionAnalysisOut
from tests.ai_fakes import GOOD_REPORT


class FakeQueue:
    """Stands in for the Celery task: remembers what was queued instead of using Redis."""

    def __init__(self) -> None:
        self.queued: list[str] = []
        self.error: Exception | None = None

    def delay(self, session_id: str) -> None:
        if self.error:
            raise self.error
        self.queued.append(session_id)


@pytest.fixture
def queue(monkeypatch: pytest.MonkeyPatch) -> FakeQueue:
    fake = FakeQueue()
    monkeypatch.setattr(analysis_routes, "analyze_session", fake)
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    return fake


@pytest.fixture
def set_analysis(engine: Engine):
    """Returns a function that pretends the worker changed an analysis row."""

    def change(session_id: str, **changes: Any) -> None:
        with Session(engine) as db:
            row = db.query(SessionAnalysis).filter_by(session_id=uuid.UUID(session_id)).one()
            for key, value in changes.items():
                setattr(row, key, value)
            db.commit()

    return change


def new_session(client: TestClient) -> str:
    return client.post("/sessions", json={"url": "http://localhost:5173/"}).json()["id"]


def test_ai_status_reports_key_and_model(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    monkeypatch.setattr(settings, "claude_model", "some-model")
    assert client.get("/config/ai").json() == {"configured": False, "model": "some-model"}

    monkeypatch.setattr(settings, "anthropic_api_key", "  ")  # blank counts as not set
    assert client.get("/config/ai").json()["configured"] is False

    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    assert client.get("/config/ai").json()["configured"] is True


def test_post_queues_a_job_and_replies_202(client: TestClient, queue: FakeQueue) -> None:
    sid = new_session(client)
    response = client.post(f"/sessions/{sid}/analysis")

    assert response.status_code == 202
    body = response.json()
    assert body["sessionId"] == sid
    assert body["status"] == "queued"
    assert body["summary"] is None and body["bugs"] == [] and body["error"] is None
    assert queue.queued == [sid]


def test_post_without_a_key_is_503_and_queues_nothing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    queue = FakeQueue()
    monkeypatch.setattr(analysis_routes, "analyze_session", queue)
    sid = new_session(client)

    response = client.post(f"/sessions/{sid}/analysis")

    assert response.status_code == 503
    assert response.json() == {"detail": "AI is not configured: add ANTHROPIC_API_KEY to .env"}
    assert queue.queued == []
    assert client.get(f"/sessions/{sid}/analysis").status_code == 404


def test_post_unknown_session_is_404(client: TestClient, queue: FakeQueue) -> None:
    assert client.post(f"/sessions/{uuid.uuid4()}/analysis").status_code == 404
    assert client.post("/sessions/not-a-uuid/analysis").status_code == 422
    assert queue.queued == []


def test_post_while_busy_is_409_with_the_current_analysis(
    client: TestClient, queue: FakeQueue, set_analysis
) -> None:
    sid = new_session(client)
    client.post(f"/sessions/{sid}/analysis")

    for status in ("queued", "running"):
        set_analysis(sid, status=status)
        response = client.post(f"/sessions/{sid}/analysis")
        assert response.status_code == 409
        assert response.json()["status"] == status
        assert response.json()["sessionId"] == sid
    assert len(queue.queued) == 1  # never queued twice


def test_a_stuck_job_is_restarted_instead_of_409(
    client: TestClient, queue: FakeQueue, set_analysis
) -> None:
    sid = new_session(client)
    client.post(f"/sessions/{sid}/analysis")
    just_inside = datetime.now(UTC) - STALE_AFTER + timedelta(minutes=1)
    set_analysis(sid, status="running", updated_at=just_inside)
    assert client.post(f"/sessions/{sid}/analysis").status_code == 409  # still fresh

    set_analysis(sid, status="running", updated_at=datetime.now(UTC) - STALE_AFTER * 2)
    response = client.post(f"/sessions/{sid}/analysis")

    assert response.status_code == 202
    assert response.json()["status"] == "queued"
    assert len(queue.queued) == 2


def test_post_again_after_done_resets_the_row(
    client: TestClient, queue: FakeQueue, set_analysis
) -> None:
    sid = new_session(client)
    client.post(f"/sessions/{sid}/analysis")
    set_analysis(sid, status="done", summary="old", bugs=GOOD_REPORT["bugs"], model="m")

    response = client.post(f"/sessions/{sid}/analysis")

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert body["summary"] is None and body["bugs"] == [] and body["model"] is None
    assert len(queue.queued) == 2


def test_post_again_restarts_created_at(client: TestClient, queue: FakeQueue, set_analysis) -> None:
    sid = new_session(client)
    client.post(f"/sessions/{sid}/analysis")
    long_ago = datetime.now(UTC) - timedelta(days=2)
    set_analysis(sid, status="done", created_at=long_ago)

    body = client.post(f"/sessions/{sid}/analysis").json()

    created = datetime.fromisoformat(body["createdAt"])
    assert datetime.now(UTC) - created < timedelta(minutes=1)  # the new run, not 2 days ago


def test_post_again_after_failed_resets_the_error(
    client: TestClient, queue: FakeQueue, set_analysis
) -> None:
    sid = new_session(client)
    client.post(f"/sessions/{sid}/analysis")
    set_analysis(sid, status="failed", error="The AI is busy or slow right now")

    body = client.post(f"/sessions/{sid}/analysis").json()

    assert body["status"] == "queued" and body["error"] is None


@pytest.mark.parametrize("error", [OperationalError("connection refused"), RedisError("refused")])
def test_post_when_redis_is_down_is_503_and_marks_failed(
    client: TestClient, queue: FakeQueue, error: Exception
) -> None:
    sid = new_session(client)
    queue.error = error

    response = client.post(f"/sessions/{sid}/analysis")

    assert response.status_code == 503
    assert "Redis" in response.json()["detail"]
    assert "connection refused" not in response.text
    got = client.get(f"/sessions/{sid}/analysis").json()
    assert got["status"] == "failed"  # not stuck on "queued" forever


def test_get_analysis(client: TestClient, queue: FakeQueue, set_analysis) -> None:
    sid = new_session(client)
    assert client.get(f"/sessions/{sid}/analysis").status_code == 404  # never analysed
    assert client.get(f"/sessions/{uuid.uuid4()}/analysis").status_code == 404

    client.post(f"/sessions/{sid}/analysis")
    set_analysis(sid, status="done", summary="All good.", bugs=GOOD_REPORT["bugs"], model="m")
    body = client.get(f"/sessions/{sid}/analysis").json()

    assert body["status"] == "done"
    assert body["summary"] == "All good."
    assert body["bugs"][0]["atMs"] == 4200  # camelCase, like the rest of the API
    assert sorted(body) == sorted(
        ["sessionId", "status", "summary", "bugs", "model", "error", "createdAt", "updatedAt"]
    )


def test_stored_bugs_become_bugflag_objects() -> None:
    class Row:
        session_id = uuid.uuid4()
        status = "done"
        summary = "s"
        bugs = GOOD_REPORT["bugs"]  # plain dicts, as read from the JSONB column
        model = "m"
        error = None
        created_at = datetime.now()
        updated_at = datetime.now()

    out = SessionAnalysisOut.model_validate(Row())
    assert out.bugs[0].title == "Checkout button does nothing"
    assert out.bugs[0].at_ms == 4200


def test_sessions_carry_ai_status_and_bug_count(
    client: TestClient, queue: FakeQueue, set_analysis
) -> None:
    sid = new_session(client)
    plain = client.get(f"/sessions/{sid}").json()
    assert plain["aiStatus"] is None and plain["aiBugCount"] == 0

    client.post(f"/sessions/{sid}/analysis")
    queued = client.get(f"/sessions/{sid}").json()
    assert queued["aiStatus"] == "queued" and queued["aiBugCount"] == 0

    set_analysis(sid, status="done", summary="s", bugs=GOOD_REPORT["bugs"] * 2)
    listed = next(s for s in client.get("/sessions").json() if s["id"] == sid)
    assert listed["aiStatus"] == "done" and listed["aiBugCount"] == 2
