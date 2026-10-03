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


def test_cors_allows_demo_shop(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    # This header is the browser's "yes, this page may read the answer".
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_blocks_other_sites(client: TestClient) -> None:
    response = client.get("/health", headers={"Origin": "https://evil.example.com"})

    assert "access-control-allow-origin" not in response.headers
