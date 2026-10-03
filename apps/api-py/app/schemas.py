# The "bouncer": shapes of data going in and out of the API (replaces our Zod schemas).
# Models (models.py) = what's in the database. Schemas (this file) = what's in requests/responses.
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    # Python uses snake_case (user_agent), JavaScript uses camelCase (userAgent).
    # This makes the JSON use camelCase, so the API looks exactly like the old Express one.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SessionCreate(CamelModel):
    """What a client must send to POST /sessions."""

    url: HttpUrl  # must be a real http(s) URL
    user_agent: str | None = Field(default=None, max_length=500)


class SessionOut(CamelModel):
    """What the API sends back for one session."""

    # from_attributes lets Pydantic read straight from a database model object.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    user_agent: str | None
    started_at: datetime
    ended_at: datetime | None
    event_count: int


class ClickMark(CamelModel):
    """One click, for drawing the "clicks over time" strip."""

    at: float  # where in the visit: 0 = start, 1 = end
    rage: bool  # part of a rage-click burst?


class SessionSummary(SessionOut):
    """A session plus what the API worked out from its events (see app/analysis.py)."""

    duration_ms: int
    click_count: int
    rage_click_count: int
    has_rage: bool
    clicks: list[ClickMark]


class EventBatchCreate(CamelModel):
    """What the recorder sends to POST /sessions/{id}/events: a few seconds of rrweb events."""

    # Each rrweb event is a JSON object (we don't check its insides). At least 1 per batch,
    # and at most 1000, so one request can't be enormous.
    events: list[dict[str, Any]] = Field(min_length=1, max_length=1000)


class EventBatchSaved(CamelModel):
    """What the API replies after saving a batch."""

    received: int  # events in this batch
    event_count: int  # events saved for this session so far, in total
