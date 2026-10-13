# Background jobs. A job runs in the Celery worker, not in the web server.
import logging
import uuid

from anthropic import Anthropic
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import AiError, AiTemporaryError, analyze_digest, make_client
from app.celery_app import celery_app
from app.config import settings
from app.db import SessionLocal
from app.digest import build_digest
from app.event_store import load_events
from app.models import ReplaySession, SessionAnalysis
from app.prompts import PROMPT_VERSION

logger = logging.getLogger(__name__)

MAX_RETRIES = 4
RETRY_BASE_SECONDS = 30  # waits 30s, 60s, 120s, 240s between tries ("exponential backoff")
RETRY_MAX_SECONDS = 600


def retry_delay(retries_so_far: int) -> int:
    """How long to wait before the next try: doubles each time, up to a ceiling."""
    return min(RETRY_BASE_SECONDS * 2**retries_so_far, RETRY_MAX_SECONDS)


def find_analysis(db: Session, session_id: uuid.UUID, lock: bool = False) -> SessionAnalysis | None:
    """The analysis row of a session. lock=True makes other requests wait until we commit."""
    query = select(SessionAnalysis).where(SessionAnalysis.session_id == session_id)
    return db.scalar(query.with_for_update() if lock else query)


def mark_failed(db: Session, analysis: SessionAnalysis, message: str) -> None:
    """Record a failure. The message must be safe to show people (no stack traces, no keys)."""
    analysis.status = "failed"
    analysis.error = message[:500]
    db.commit()


def run_analysis(
    db: Session, session_id: uuid.UUID, client: Anthropic, model: str, can_retry: bool
) -> None:
    """Do one analysis. Safe to run twice: a finished analysis is left alone.

    Raises AiTemporaryError only when `can_retry` is true; the Celery task then tries again later.
    """
    analysis = find_analysis(db, session_id)
    if analysis is None:
        logger.warning("analysis row for session %s is missing; nothing to do", session_id)
        return
    if analysis.status == "done":
        return  # already finished: running twice must not change anything (or cost money)

    # Note: if the queue hands this job to a second worker while the first is still "running",
    # Claude may be called twice. That is accepted (rare); both write the same kind of result.
    session = db.get(ReplaySession, session_id)
    analysis.status = "running"
    analysis.error = None
    db.commit()

    try:
        events = load_events(db, [session_id])[session_id]
        if session is None or not events:
            raise AiError("This visit has no recorded events to analyse")
        digest = build_digest(session.url, session.user_agent, events)
        result = analyze_digest(client, model, digest)
    except AiTemporaryError as error:
        if can_retry:
            analysis.status = "queued"  # waiting for the next try
            db.commit()
            raise
        logger.error("analysis of %s failed after all retries: %s", session_id, error)
        mark_failed(db, analysis, f"{error}. Please try again later")
        return
    except AiError as error:
        logger.error("analysis of %s failed: %s", session_id, error)
        mark_failed(db, analysis, str(error))
        return
    except SoftTimeLimitExceeded:
        raise  # let the task wrapper below record "took too long"
    except Exception:
        # A bug of ours. Log everything for us; show people only a vague message.
        logger.exception("analysis of %s crashed", session_id)
        mark_failed(db, analysis, "Something went wrong while analysing this visit")
        return

    analysis.status = "done"
    analysis.summary = result.summary
    analysis.bugs = [bug.model_dump(by_alias=True) for bug in result.bugs]  # atMs, like the API
    analysis.model = model
    analysis.prompt_version = PROMPT_VERSION
    analysis.error = None
    db.commit()


# The job itself. bind=True gives us `self`, so we know which try this is.
# soft_time_limit makes Celery raise SoftTimeLimitExceeded inside the job (hard limit kills it).
# (Time limits don't work with --pool=solo on Windows; the Claude call has its own timeout.)
@celery_app.task(
    bind=True,
    name="analyze_session",
    max_retries=MAX_RETRIES,
    soft_time_limit=150,
    time_limit=180,
)
def analyze_session(self: Task, session_id: str) -> None:
    sid = uuid.UUID(session_id)
    with SessionLocal() as db:
        if not settings.ai_configured:
            analysis = find_analysis(db, sid)
            if analysis is not None and analysis.status != "done":
                mark_failed(db, analysis, "AI is not configured: add ANTHROPIC_API_KEY to .env")
            return
        try:
            run_analysis(
                db,
                sid,
                make_client(),
                settings.claude_model,
                can_retry=self.request.retries < MAX_RETRIES,
            )
        except AiTemporaryError as error:
            raise self.retry(exc=error, countdown=retry_delay(self.request.retries)) from error
        except SoftTimeLimitExceeded:
            analysis = find_analysis(db, sid)
            if analysis is not None:
                mark_failed(db, analysis, "The analysis took too long")
