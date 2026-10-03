# Reading recorded events to understand a visit: how long it lasted, where the clicks were,
# and whether there were rage clicks. Pure functions: events in, summary out, no database.
import math
from bisect import bisect_left
from dataclasses import dataclass
from typing import Any

# The rage-click rule: this many DEAD clicks on the same spot, within this much time.
# A click is "dead" if the page doesn't change within RESPONSE_MS after it. Without that check,
# quickly adding 4 T-shirts to the cart (the page updates every time) looked like rage too.
RAGE_MIN_CLICKS = 3
RAGE_WINDOW_MS = 2000
RESPONSE_MS = 500
# Clicks count as "the same spot" if they hit the same element, or land this close together.
SAME_SPOT_PX = 30

# How rrweb labels events: an incremental change (type 3), then its source:
# 0 = the page changed (a "mutation"), 2 = the mouse did something (and type 2 = a click).
INCREMENTAL_SNAPSHOT = 3
MUTATION = 0
MOUSE_INTERACTION = 2
CLICK = 2


@dataclass
class Click:
    at_ms: int  # when, counted from the start of the visit
    target: int | None  # rrweb's id for the clicked element
    x: float | None
    y: float | None
    dead: bool = False  # the page didn't react
    rage: bool = False


@dataclass
class Analysis:
    duration_ms: int
    clicks: list[Click]

    @property
    def rage_click_count(self) -> int:
        return sum(1 for c in self.clicks if c.rage)

    @property
    def has_rage(self) -> bool:
        return self.rage_click_count > 0


def find_clicks(events: list[dict[str, Any]], start_ms: int) -> list[Click]:
    """Pick the click events out of everything rrweb recorded."""
    clicks = []
    for event in events:
        data = event.get("data") or {}
        if (
            event.get("type") == INCREMENTAL_SNAPSHOT
            and data.get("source") == MOUSE_INTERACTION
            and data.get("type") == CLICK
            and isinstance(event.get("timestamp"), int | float)
        ):
            clicks.append(
                Click(
                    at_ms=int(event["timestamp"]) - start_ms,
                    target=data.get("id"),
                    x=data.get("x"),
                    y=data.get("y"),
                )
            )
    return sorted(clicks, key=lambda c: c.at_ms)


def same_spot(a: Click, b: Click) -> bool:
    if a.target is not None and a.target == b.target:
        return True
    if a.x is not None and a.y is not None and b.x is not None and b.y is not None:
        return math.hypot(a.x - b.x, a.y - b.y) <= SAME_SPOT_PX  # straight-line distance
    return False


def page_change_times(events: list[dict[str, Any]], start_ms: int) -> list[int]:
    """When the page changed (rrweb "mutation" events), sorted, counted from the start."""
    return sorted(
        int(e["timestamp"]) - start_ms
        for e in events
        if e.get("type") == INCREMENTAL_SNAPSHOT
        and (e.get("data") or {}).get("source") == MUTATION
        and isinstance(e.get("timestamp"), int | float)
    )


def mark_dead_clicks(clicks: list[Click], changes: list[int]) -> None:
    """A click is dead if no page change happens from the click until RESPONSE_MS later."""
    for c in clicks:
        first_change_after = bisect_left(changes, c.at_ms)  # index of the first change at/after it
        c.dead = (
            first_change_after == len(changes)
            or changes[first_change_after] > c.at_ms + RESPONSE_MS
        )


def mark_rage_clicks(clicks: list[Click]) -> None:
    """Flag every click in a burst of RAGE_MIN_CLICKS+ dead clicks on one spot within the window."""
    for i, last in enumerate(clicks):
        if not last.dead:
            continue
        # All earlier dead clicks on the same spot within the window before this one.
        burst = [
            c
            for c in clicks[: i + 1]
            if c.dead and last.at_ms - c.at_ms <= RAGE_WINDOW_MS and same_spot(c, last)
        ]
        if len(burst) >= RAGE_MIN_CLICKS:
            for c in burst:
                c.rage = True


def analyze(events: list[dict[str, Any]]) -> Analysis:
    """Summarise one visit from all of its recorded events."""
    times = [int(e["timestamp"]) for e in events if isinstance(e.get("timestamp"), int | float)]
    if not times:
        return Analysis(duration_ms=0, clicks=[])
    start = min(times)
    clicks = find_clicks(events, start)
    mark_dead_clicks(clicks, page_change_times(events, start))
    mark_rage_clicks(clicks)
    return Analysis(duration_ms=max(times) - start, clicks=clicks)
