# Small helpers that build fake rrweb events, so tests can describe a visit in a few lines.
from typing import Any

T0 = 1_700_000_000_000  # an arbitrary "start of the visit" in milliseconds


def snapshot(at: int = 0) -> dict[str, Any]:
    """A tiny page: Checkout button (10), email box (11), heading (13), Pay now span (16)."""
    button = {
        "id": 10,
        "type": 2,
        "tagName": "button",
        "attributes": {},
        "childNodes": [{"id": 12, "type": 3, "textContent": "Checkout"}],
    }
    email = {"id": 11, "type": 2, "tagName": "input", "attributes": {"type": "email"}}
    # A heading with a person's name (never quoted) and a button whose text sits in a <span>.
    heading = {
        "id": 13,
        "type": 2,
        "tagName": "h1",
        "attributes": {},
        "childNodes": [{"id": 14, "type": 3, "textContent": "Hello Jane Doe"}],
    }
    pay = {
        "id": 15,
        "type": 2,
        "tagName": "button",
        "attributes": {},
        "childNodes": [
            {
                "id": 16,
                "type": 2,
                "tagName": "span",
                "attributes": {},
                "childNodes": [{"id": 17, "type": 3, "textContent": "Pay now"}],
            }
        ],
    }
    children = [button, email, heading, pay]
    body = {"id": 3, "type": 2, "tagName": "body", "attributes": {}, "childNodes": children}
    document = {"id": 1, "type": 0, "childNodes": [body]}
    return {"type": 2, "timestamp": T0 + at, "data": {"node": document}}


def meta(at: int = 0, href: str = "http://localhost:5173/cart?token=abc#top") -> dict[str, Any]:
    return {
        "type": 4,
        "timestamp": T0 + at,
        "data": {"href": href, "width": 1280, "height": 720},
    }


def click(at: int, target: int = 10) -> dict[str, Any]:
    data = {"source": 2, "type": 2, "id": target, "x": 100, "y": 100}
    return {"type": 3, "timestamp": T0 + at, "data": data}


def typing(at: int, target: int = 11, text: str = "secret@example.com") -> dict[str, Any]:
    return {"type": 3, "timestamp": T0 + at, "data": {"source": 5, "id": target, "text": text}}


def mutation(at: int) -> dict[str, Any]:
    return {"type": 3, "timestamp": T0 + at, "data": {"source": 0, "adds": []}}


def console_error(at: int, message: str) -> dict[str, Any]:
    payload = {"level": "error", "payload": [message]}
    data = {"plugin": "rrweb/console@1", "payload": payload}
    return {"type": 6, "timestamp": T0 + at, "data": data}
