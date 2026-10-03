# One shared database connection for the whole API (Python version of our old db.ts).
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# The "engine" manages a pool of connections to Postgres.
engine = create_engine(settings.sqlalchemy_database_url)

# A factory that makes database "sessions": one conversation with the database.
# (Not the same thing as a *recorded* session in Replay. Unlucky name clash!)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    """Parent class for every table model. Alembic reads it to know what tables exist."""


def get_db() -> Iterator[Session]:
    # FastAPI "dependency": gives a route a database session, then closes it when the
    # request is finished, even if the route crashed. Tests swap this out for a test DB.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Shortcut for routes: a parameter typed `db: DbSession` gets a database session from get_db.
DbSession = Annotated[Session, Depends(get_db)]
