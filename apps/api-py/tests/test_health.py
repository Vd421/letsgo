# Tests for the simple "is the server alive?" routes.
# pytest runs every function whose name starts with test_.
from fastapi.testclient import TestClient


def test_health_says_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_says_running(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"message": "Replay API is running"}
