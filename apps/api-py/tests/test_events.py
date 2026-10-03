# Tests for POST /sessions/{id}/events and GET /sessions/{id}/events.
from fastapi.testclient import TestClient

# A made-up session ID that is never in the database.
MISSING_ID = "00000000-0000-0000-0000-000000000000"


def new_session(client: TestClient) -> str:
    """Create a session and return its ID (most tests need one to start with)."""
    response = client.post("/sessions", json={"url": "https://shop.example.com/"})
    return response.json()["id"]


def test_add_events_saves_batch_and_counts(client: TestClient) -> None:
    session_id = new_session(client)

    response = client.post(
        f"/sessions/{session_id}/events",
        json={"events": [{"type": 2, "timestamp": 1}, {"type": 3, "timestamp": 2}]},
    )

    assert response.status_code == 201
    assert response.json() == {"received": 2, "eventCount": 2}


def test_event_count_adds_up_over_batches(client: TestClient) -> None:
    session_id = new_session(client)

    client.post(f"/sessions/{session_id}/events", json={"events": [{"type": 2}, {"type": 3}]})
    client.post(f"/sessions/{session_id}/events", json={"events": [{"type": 3}]})

    sessions = client.get("/sessions").json()
    assert sessions[0]["eventCount"] == 3


def test_list_events_returns_all_batches_in_order(client: TestClient) -> None:
    session_id = new_session(client)
    client.post(f"/sessions/{session_id}/events", json={"events": [{"n": 1}, {"n": 2}]})
    client.post(f"/sessions/{session_id}/events", json={"events": [{"n": 3}]})

    response = client.get(f"/sessions/{session_id}/events")

    assert response.status_code == 200
    assert response.json() == [{"n": 1}, {"n": 2}, {"n": 3}]


def test_add_events_to_missing_session_is_404(client: TestClient) -> None:
    response = client.post(f"/sessions/{MISSING_ID}/events", json={"events": [{"type": 2}]})

    assert response.status_code == 404


def test_list_events_of_missing_session_is_404(client: TestClient) -> None:
    response = client.get(f"/sessions/{MISSING_ID}/events")

    assert response.status_code == 404


def test_add_events_rejects_empty_batch(client: TestClient) -> None:
    session_id = new_session(client)

    response = client.post(f"/sessions/{session_id}/events", json={"events": []})

    assert response.status_code == 422
