# Tests for POST /sessions and GET /sessions.
from fastapi.testclient import TestClient


def test_create_session_saves_and_returns_it(client: TestClient) -> None:
    response = client.post(
        "/sessions", json={"url": "https://shop.example.com/cart", "userAgent": "Firefox"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["url"] == "https://shop.example.com/cart"
    assert body["userAgent"] == "Firefox"  # camelCase in JSON, like the old Express API
    assert body["eventCount"] == 0  # default filled in by the database
    assert body["endedAt"] is None
    assert body["id"]  # an ID was generated
    assert body["startedAt"]  # a start time was filled in


def test_create_session_without_user_agent(client: TestClient) -> None:
    response = client.post("/sessions", json={"url": "https://shop.example.com/"})

    assert response.status_code == 201
    assert response.json()["userAgent"] is None


def test_create_session_rejects_bad_url(client: TestClient) -> None:
    response = client.post("/sessions", json={"url": "not a url"})

    # 422 = "I understood the request, but the data breaks the rules".
    assert response.status_code == 422
    # The error says WHICH field was wrong: ["body", "url"].
    assert response.json()["detail"][0]["loc"] == ["body", "url"]


def test_create_session_rejects_missing_url(client: TestClient) -> None:
    response = client.post("/sessions", json={"userAgent": "Firefox"})

    assert response.status_code == 422


def test_create_session_rejects_too_long_user_agent(client: TestClient) -> None:
    response = client.post(
        "/sessions", json={"url": "https://shop.example.com/", "userAgent": "x" * 501}
    )

    assert response.status_code == 422


def test_get_one_session(client: TestClient) -> None:
    created = client.post("/sessions", json={"url": "https://shop.example.com/"}).json()

    response = client.get(f"/sessions/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created  # the same session we just made


def test_get_missing_session_is_404(client: TestClient) -> None:
    response = client.get("/sessions/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404


def test_get_session_with_bad_id_is_422(client: TestClient) -> None:
    # "banana" isn't a valid ID at all, so FastAPI rejects it before looking anything up.
    response = client.get("/sessions/banana")

    assert response.status_code == 422


def test_list_sessions_is_empty_at_first(client: TestClient) -> None:
    response = client.get("/sessions")

    assert response.status_code == 200
    assert response.json() == []


def test_list_sessions_returns_newest_first(client: TestClient) -> None:
    client.post("/sessions", json={"url": "https://shop.example.com/first"})
    client.post("/sessions", json={"url": "https://shop.example.com/second"})

    response = client.get("/sessions")

    assert response.status_code == 200
    urls = [session["url"] for session in response.json()]
    assert urls == ["https://shop.example.com/second", "https://shop.example.com/first"]
