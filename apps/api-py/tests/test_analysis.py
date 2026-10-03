# Tests for the rage-click rule in app/analysis.py. No database needed: events in, answer out.
from app.analysis import analyze


def click(at_ms: int, target: int = 41, x: float = 800, y: float = 450) -> dict:
    """A click event shaped like the ones rrweb records."""
    return {
        "type": 3,
        "timestamp": 1_000_000 + at_ms,
        "data": {"source": 2, "type": 2, "id": target, "x": x, "y": y},
    }


def page_load(at_ms: int = 0) -> dict:
    return {"type": 4, "timestamp": 1_000_000 + at_ms, "data": {"href": "http://shop.test/"}}


def test_no_events_means_empty_summary() -> None:
    result = analyze([])

    assert result.duration_ms == 0
    assert result.clicks == []
    assert not result.has_rage


def test_duration_is_first_to_last_event() -> None:
    result = analyze([page_load(0), click(1500), page_load(9000)])

    assert result.duration_ms == 9000
    assert len(result.clicks) == 1
    assert result.clicks[0].at_ms == 1500


def test_three_fast_clicks_on_one_button_is_rage() -> None:
    result = analyze([page_load(), click(4000), click(4500), click(5000)])

    assert result.has_rage
    assert result.rage_click_count == 3


def test_five_checkout_presses_like_the_demo_shop() -> None:
    adds = [click(1000, target=10), click(2000, target=11)]  # two different "Add" buttons
    checkout = [click(4000 + i * 500, target=41) for i in range(5)]

    result = analyze([page_load(), *adds, *checkout])

    assert result.rage_click_count == 5  # all five checkout presses, not the adds
    assert [c.rage for c in result.clicks] == [False, False, True, True, True, True, True]


def test_two_fast_clicks_is_not_rage() -> None:
    result = analyze([page_load(), click(1000), click(1300)])

    assert not result.has_rage


def test_slow_clicks_are_not_rage() -> None:
    # Three clicks on the same button, but 1.5 s apart: 3 s from first to last, over the 2 s window.
    result = analyze([page_load(), click(0), click(1500), click(3000)])

    assert not result.has_rage


def test_fast_clicks_on_different_buttons_far_apart_are_not_rage() -> None:
    events = [
        page_load(),
        click(1000, target=1, x=100, y=100),
        click(1300, target=2, x=500, y=100),
        click(1600, target=3, x=900, y=100),
    ]

    assert not analyze(events).has_rage


def test_clicks_close_together_count_as_same_spot_without_an_id() -> None:
    events = [page_load()] + [
        {
            "type": 3,
            "timestamp": 1_000_000 + t,
            "data": {"source": 2, "type": 2, "x": 400 + d, "y": 300},
        }
        for t, d in [(1000, 0), (1300, 10), (1600, 20)]
    ]

    assert analyze(events).has_rage


def page_change(at_ms: int) -> dict:
    """rrweb's record of the page changing (a "mutation"), e.g. the cart updating."""
    return {"type": 3, "timestamp": 1_000_000 + at_ms, "data": {"source": 0, "adds": []}}


def test_fast_clicks_that_update_the_page_are_not_rage() -> None:
    # Like adding 4 T-shirts quickly: same button, but the cart changes after every click.
    events = [page_load()]
    for i in range(4):
        events += [click(1000 + i * 100, target=47), page_change(1000 + i * 100 + 3)]

    result = analyze(events)

    assert not result.has_rage
    assert not any(c.dead for c in result.clicks)


def test_page_change_long_after_the_clicks_does_not_count_as_a_response() -> None:
    # Checkout pressed 3 times with no reaction; the page only changes 3 seconds later.
    events = [page_load(), click(1000), click(1400), click(1800), page_change(4800)]

    assert analyze(events).rage_click_count == 3


def test_only_the_dead_clicks_in_a_burst_count() -> None:
    # The first press works (page changes), the next three do nothing: those three are rage.
    events = [page_load(), click(1000), page_change(1010), click(1300), click(1600), click(1900)]

    result = analyze(events)

    assert [c.rage for c in result.clicks] == [False, True, True, True]


def test_other_mouse_events_are_not_clicks() -> None:
    mouse_move = {"type": 3, "timestamp": 1_000_100, "data": {"source": 1, "positions": []}}
    double_click = {"type": 3, "timestamp": 1_000_200, "data": {"source": 2, "type": 4, "id": 41}}

    assert analyze([page_load(), mouse_move, double_click]).clicks == []
