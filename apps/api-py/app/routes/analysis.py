# Routes for the AI analysis of a visit, plus a small "is the AI switched on?" check.
# The slow work (asking Claude) never happens here: POST only queues a job for the Celery worker.
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from kombu.exceptions import OperationalError
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.db import DbSession
from app.jobs import analyze_session, find_analysis
from app.models import SessionAnalysis
from app.routes.sessions import get_session_or_404
from app.schemas import AiStatusOut, SessionAnalysisOut

router = APIRouter(prefix="/sessions/{session_id}/analysis", tags=["analysis"])
config_router = APIRouter(prefix="/config", tags=["analysis"])

NOT_CONFIGURED = "AI is not configured: add ANTHROPIC_API_KEY to .env"
BUSY_STATUSES = ("queued", "running")
# A job "queued" or "running" for longer than this is stuck (worker died, Redis lost the job).
# Clicking Analyze again then starts over instead of answering 409 forever.
STALE_AFTER = timedelta(minutes=10)


def is_busy(analysis: SessionAnalysis) -> bool:
    """Waiting or running, and not stuck."""
    fresh = datetime.now(UTC) - analysis.updated_at < STALE_AFTER
    return analysis.status in BUSY_STATUSES and fresh


def busy_response(analysis: SessionAnalysis) -> JSONResponse:
    """409: an analysis is already waiting or running. The body is the current analysis."""
    body = SessionAnalysisOut.model_validate(analysis).model_dump(mode="json", by_alias=True)
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=body)


# GET /config/ai → can the AI button work? (the dashboard shows a hint when it cannot)
@config_router.get("/ai", response_model=AiStatusOut)
def get_ai_status() -> AiStatusOut:
    return AiStatusOut(configured=settings.ai_configured, model=settings.claude_model)


# POST /sessions/{id}/analysis → queue an AI analysis. Replies 202 ("accepted, not done yet").
@router.post("", response_model=SessionAnalysisOut, status_code=status.HTTP_202_ACCEPTED)
def start_analysis(session_id: UUID, db: DbSession) -> SessionAnalysisOut | JSONResponse:
    get_session_or_404(db, session_id)
    if not settings.ai_configured:
        # No key means no job: we say so right away instead of queueing something doomed.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=NOT_CONFIGURED)

    # lock=True: a second click at the same moment waits here, then sees "queued" and gets 409,
    # so one visit never gets two jobs (and never costs two Claude calls).
    analysis = find_analysis(db, session_id, lock=True)
    if analysis is not None and is_busy(analysis):
        return busy_response(analysis)

    if analysis is None:
        analysis = SessionAnalysis(session_id=session_id, status="queued")
        db.add(analysis)
    else:
        # Analysing again: wipe the old result and start over on the same row.
        analysis.status = "queued"
        analysis.summary = None
        analysis.bugs = []
        analysis.model = None
        analysis.error = None
        analysis.prompt_version = None
        analysis.created_at = datetime.now(UTC)  # createdAt = start of the current run
    try:
        db.commit()
    except IntegrityError:
        # Two requests arrived at once and the other one created the row first.
        db.rollback()
        existing = find_analysis(db, session_id)
        if existing is None:
            raise
        return busy_response(existing)
    db.refresh(analysis)

    try:
        analyze_session.delay(str(session_id))
    except (OperationalError, RedisConnectionError) as error:
        # Redis is down, so the job was never queued. Do not leave the row "queued" forever.
        analysis.status = "failed"
        analysis.error = "The job queue is not reachable"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not queue the analysis: is Redis running?",
        ) from error
    return SessionAnalysisOut.model_validate(analysis)


# GET /sessions/{id}/analysis → the current result. 404 also means "never analysed".
@router.get("", response_model=SessionAnalysisOut)
def get_analysis(session_id: UUID, db: DbSession) -> SessionAnalysis:
    get_session_or_404(db, session_id)
    analysis = find_analysis(db, session_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="This visit has not been analysed yet"
        )
    return analysis
