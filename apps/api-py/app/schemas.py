# The "bouncer": shapes of data going in and out of the API (replaces our Zod schemas).
# Models (models.py) = what's in the database. Schemas (this file) = what's in requests/responses.
import uuid
from datetime import datetime

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
