# Contract checks for the Phase 5 AI schemas (camelCase JSON, validation limits).
import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas import AiStatusOut, BugFlag, SessionAnalysisOut


def test_analysis_serialises_camel_case():
    now = datetime(2026, 1, 1, tzinfo=UTC)
    out = SessionAnalysisOut(
        session_id=uuid.uuid4(),
        status="queued",
        summary=None,
        bugs=[],
        model=None,
        error=None,
        created_at=now,
        updated_at=now,
    )
    data = out.model_dump(by_alias=True, mode="json")
    assert set(data) == {
        "sessionId",
        "status",
        "summary",
        "bugs",
        "model",
        "error",
        "createdAt",
        "updatedAt",
    }


def test_bugflag_camel_case_and_null_at_ms():
    bug = BugFlag.model_validate(
        {"title": "Checkout does nothing", "severity": "high", "atMs": None, "evidence": "x"}
    )
    assert bug.at_ms is None
    assert bug.model_dump(by_alias=True)["atMs"] is None


@pytest.mark.parametrize(
    "bad",
    [
        {"title": "", "severity": "low", "atMs": 1, "evidence": "x"},
        {"title": "t", "severity": "critical", "atMs": 1, "evidence": "x"},
        {"title": "t", "severity": "low", "atMs": -5, "evidence": "x"},
    ],
)
def test_bugflag_rejects_bad_input(bad):
    with pytest.raises(ValidationError):
        BugFlag.model_validate(bad)


def test_ai_status_shape():
    assert AiStatusOut(configured=False, model="m").model_dump(by_alias=True) == {
        "configured": False,
        "model": "m",
    }
