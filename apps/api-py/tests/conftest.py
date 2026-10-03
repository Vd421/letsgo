# Shared test setup. pytest loads this file automatically before running any test.
# "Fixtures" (functions marked @pytest.fixture) prepare things tests need, like a client.
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.db import Base, get_db
from app.main import app

# Tests use their own database (replay_test), so they never touch your real data.
TEST_DB_NAME = "replay_test"
TEST_DB_URL = make_url(settings.sqlalchemy_database_url).set(database=TEST_DB_NAME)


def create_test_database() -> None:
    # CREATE DATABASE can't run inside a transaction, hence AUTOCOMMIT.
    admin = create_engine(settings.sqlalchemy_database_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": TEST_DB_NAME}
        )
        if not exists:
            conn.execute(text(f"CREATE DATABASE {TEST_DB_NAME}"))
    admin.dispose()


# scope="session" = run once for the whole test run (not once per test).
@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    create_test_database()
    engine = create_engine(TEST_DB_URL)
    # Build fresh tables straight from our models.
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def client(engine: Engine) -> Iterator[TestClient]:
    """A fake browser that sends requests to our app, using the empty test database."""
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE sessions"))  # every test starts with no rows

    TestingSessionLocal = sessionmaker(bind=engine)

    def get_test_db() -> Iterator[Session]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Swap the real database for the test one, only while this test runs.
    app.dependency_overrides[get_db] = get_test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
