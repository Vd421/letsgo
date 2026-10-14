# Reading a session's saved events back out of the database. Used by the sessions routes
# and by the background AI job, so it lives here instead of in either of them.
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EventBatch


def load_events(db: Session, session_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[dict[str, Any]]]:
    """All recorded events for these sessions, in one database query, grouped by session."""
    events: dict[uuid.UUID, list[dict[str, Any]]] = defaultdict(list)
    if session_ids:
        batches = db.scalars(
            select(EventBatch).where(EventBatch.session_id.in_(session_ids)).order_by(EventBatch.id)
        )
        for batch in batches:
            events[batch.session_id].extend(batch.events)
    return events
