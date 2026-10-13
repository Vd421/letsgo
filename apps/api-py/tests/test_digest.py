# Tests for app/digest.py: events in, privacy-safe text out.
from app.digest import browser_family, build_digest, url_path
from tests.rrweb_fakes import click, console_error, meta, mutation, snapshot, typing

EDGE = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120"


def test_url_path_drops_host_query_and_fragment() -> None:
    assert url_path("http://localhost:5173/cart?token=abc#top") == "/cart"
    assert url_path("http://localhost:5173") == "/"


def test_browser_family_reports_only_the_name() -> None:
    assert browser_family(EDGE) == "Edge"
    assert browser_family("Mozilla/5.0 Firefox/130.0") == "Firefox"
    assert browser_family("Mozilla/5.0 Chrome/120 Safari/537") == "Chrome"
    assert browser_family(None) == "unknown"


def test_digest_tells_the_story_of_a_visit() -> None:
    events = [snapshot(), meta(), mutation(500), click(1000), mutation(1100), typing(2000)]
    digest = build_digest("http://localhost:5173/?x=1", EDGE, events)

    assert "Start page: /" in digest
    assert "Browser: Edge" in digest
    assert "Screen: 1280x720" in digest
    assert "- 0.0s Opened page /cart" in digest
    assert '- 1.0s Clicked "Checkout"' in digest
    assert "- 2.0s Typed in the email box (text hidden)" in digest


def test_digest_flags_rage_and_dead_clicks() -> None:
    events = [snapshot(), meta(), click(1000), click(1200), click(1400), click(1600)]
    digest = build_digest("http://localhost:5173/", None, events)

    assert 'Rage click on "Checkout": page did not react' in digest
    assert "Clicks: 4 (4 part of a rage-click burst)" in digest


def test_a_single_dead_click_is_not_rage() -> None:
    digest = build_digest("http://localhost:5173/", None, [snapshot(), meta(), click(1000)])
    assert 'Clicked "Checkout": page did not react' in digest
    assert "Rage click" not in digest


def test_digest_never_contains_typed_text_or_query_strings_or_full_user_agent() -> None:
    events = [snapshot(), meta(), typing(1000, text="hunter2-password"), typing(1200)]
    digest = build_digest("http://localhost:5173/?token=abc", EDGE, events)

    assert "hunter2" not in digest
    assert "secret@example.com" not in digest
    assert "token" not in digest
    assert "Mozilla" not in digest and "AppleWebKit" not in digest


def test_one_burst_of_typing_is_one_moment() -> None:
    events = [snapshot(), meta(), typing(1000), typing(1300), typing(1600)]
    digest = build_digest("http://localhost:5173/", None, events)
    assert digest.count("Typed in") == 1


def test_digest_includes_console_errors() -> None:
    events = [snapshot(), meta(), console_error(900, "TypeError: cart is undefined")]
    digest = build_digest("http://localhost:5173/", None, events)
    assert "Browser console errors:" in digest
    assert "TypeError: cart is undefined" in digest


def test_long_visits_are_cut_off() -> None:
    events = [snapshot(), meta()] + [click(1000 + i * 3000) for i in range(200)]
    digest = build_digest("http://localhost:5173/", None, events)
    assert "more moments left out" in digest
    assert len(digest.splitlines()) < 200


def test_empty_visit_does_not_crash() -> None:
    digest = build_digest("http://localhost:5173/", None, [])
    assert "Duration: 0.0s" in digest
    assert "(nothing happened)" in digest


def test_url_path_hides_ids_and_tokens() -> None:
    assert url_path("http://x.test/orders/48151623/items") == "/orders/:id/items"
    assert url_path("http://x.test/u/jane@example.com") == "/u/:id"
    assert url_path("http://x.test/reset/Zm9vYmFyYmF6cXV4MTIzNDU2") == "/reset/:id"
    assert url_path("http://x.test/9b2f6c1e-1d3a-4c55-8e0a-0c9f7d6a1b22") == "/:id"


def test_console_errors_are_redacted() -> None:
    message = (
        "Failed to load http://shop.test/api/users/12345678?token=abc123 "
        "for bob@mail.com (order 99887766)"
    )
    digest = build_digest("http://x.test/", None, [snapshot(), meta(), console_error(900, message)])

    assert "Failed to load" in digest
    assert "token" not in digest
    assert "bob@mail.com" not in digest
    assert "12345678" not in digest and "99887766" not in digest
    assert "[hidden]" in digest


def test_clicks_inside_a_button_use_the_buttons_text() -> None:
    digest = build_digest("http://x.test/", None, [snapshot(), meta(), click(1000, target=16)])
    assert 'Clicked "Pay now"' in digest  # the click landed on the <span> inside the button


def test_text_outside_buttons_and_links_is_never_quoted() -> None:
    digest = build_digest("http://x.test/", None, [snapshot(), meta(), click(1000, target=13)])
    assert "Jane" not in digest
    assert "Clicked a h1 element" in digest
