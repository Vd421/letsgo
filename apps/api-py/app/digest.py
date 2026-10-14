# Turns a visit's raw rrweb events into a short, text-only "digest" for Claude to read.
# Pure functions: events in, text out, no database and no network, so they are easy to test.
#
# PRIVACY: the digest is the ONLY thing we ever send to Claude about a visit. It never contains
# what someone typed, the page's HTML, a full browser string, or the site's query string.
# It only says things like: 'Clicked "Checkout"', 'Typed in the email box (text hidden)'.
import re
from typing import Any
from urllib.parse import urlsplit

from app.analysis import analyze

# rrweb's numbers for event kinds (the same ones app/analysis.py and the dashboard use).
FULL_SNAPSHOT = 2
INCREMENTAL_SNAPSHOT = 3
META = 4
PLUGIN = 6
MUTATION = 0
INPUT = 5
ELEMENT_NODE = 2
TEXT_NODE = 3
CONSOLE_PLUGIN = "rrweb/console@1"

MAX_TIMELINE_LINES = 150  # keeps the prompt small (and cheap) even for very long visits
MAX_CONSOLE_ERRORS = 10
MAX_TEXT_LENGTH = 28  # longest element label we quote
TYPING_GAP_MS = 2000  # typing in one box with pauses shorter than this counts as one moment
CLICKABLE_TAGS = {"button", "a", "label", "summary", "option"}
# Text that looks like personal data (an email, or a long number) is never quoted.
LOOKS_PERSONAL = re.compile(r"@|\d{6,}")


class PageIndex:
    """A small map of the page: element id → its tag, text and children (like moments.ts)."""

    def __init__(self) -> None:
        self.nodes: dict[int, dict[str, Any]] = {}

    def add(self, node: dict[str, Any], parent_id: int | None = None) -> None:
        node_id = node.get("id")
        if not isinstance(node_id, int):
            return
        self.nodes[node_id] = {
            "tag": node.get("tagName") if node.get("type") == ELEMENT_NODE else None,
            "text": node.get("textContent") if node.get("type") == TEXT_NODE else None,
            "attrs": node.get("attributes") or {},
            "children": [],
            "parent": parent_id,
        }
        if parent_id is not None and parent_id in self.nodes:
            self.nodes[parent_id]["children"].append(node_id)
        for child in node.get("childNodes") or []:
            self.add(child, node_id)

    def text_of(self, node_id: int, depth: int = 0) -> str:
        node = self.nodes.get(node_id)
        if node is None or depth > 6:
            return ""
        if node["text"] is not None:
            return str(node["text"])
        return " ".join(self.text_of(child, depth + 1) for child in node["children"])

    def describe(self, node_id: int | None) -> str:
        """A human name for a clicked or typed-in element, e.g. "Checkout" or the email box."""
        node = self.nodes.get(node_id) if node_id is not None else None
        if node is None:
            return "the page"
        tag = node["tag"]
        if tag in ("input", "textarea"):
            kind = str(node["attrs"].get("type", "text"))
            return {"email": "the email box", "password": "the password box"}.get(
                kind, "a text box"
            )
        if tag in ("html", "body"):
            return "an empty part of the page"
        # Only buttons, links and the like have their text quoted (the click may have landed on
        # a <span> inside the button, so we look a few levels up for one). Other text on the page
        # could be anything, including personal data, so it is never quoted.
        clickable = self.clickable_ancestor(node_id)
        if clickable is None:
            return f"a {tag} element" if tag else "the page"
        # Keep letters, numbers and simple punctuation; squash spaces.
        text = re.sub(r"[^\w\s.,:$'&()-]", "", self.text_of(clickable), flags=re.UNICODE)
        text = re.sub(r"\s+", " ", text).strip()
        if text and len(text) <= 40 and not LOOKS_PERSONAL.search(text):
            short = text if len(text) <= MAX_TEXT_LENGTH else text[: MAX_TEXT_LENGTH - 1] + "…"
            return f'"{short}"'
        return f"a {self.nodes[clickable]['tag']} element"

    def clickable_ancestor(self, node_id: int, levels: int = 4) -> int | None:
        """The element itself or the nearest parent that is a button, link, etc."""
        current: int | None = node_id
        for _ in range(levels):
            node = self.nodes.get(current) if current is not None else None
            if node is None:
                return None
            if node["tag"] in CLICKABLE_TAGS:
                return current
            current = node["parent"]
        return None


TOKEN_LIKE = re.compile(r"[A-Za-z0-9_-]{20,}")  # long random-looking text, like an id or token
URL_IN_TEXT = re.compile(r"https?://\S+")


def url_path(url: str) -> str:
    """Just the path of a URL ("/checkout"): no host, no ?query, no #fragment.

    Parts that look like ids or tokens ("/orders/48151623") become ":id".
    """
    segments = urlsplit(url).path.split("/")
    safe = [
        ":id" if LOOKS_PERSONAL.search(part) or TOKEN_LIKE.fullmatch(part) else part
        for part in segments
    ]
    return "/".join(safe) or "/"


def redact(text: str) -> str:
    """Make free text safe to send: URLs shrink to their path, personal-looking words go."""
    text = URL_IN_TEXT.sub(lambda match: url_path(match.group()), text)
    return " ".join("[hidden]" if LOOKS_PERSONAL.search(word) else word for word in text.split())


def browser_family(user_agent: str | None) -> str:
    """ "Edge", "Chrome"... only the browser name, never the full user-agent text."""
    ua = user_agent or ""
    # Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
    for marker, name in (
        ("Edg/", "Edge"),
        ("OPR/", "Opera"),
        ("Firefox/", "Firefox"),
        ("Chrome/", "Chrome"),
        ("Safari/", "Safari"),
    ):
        if marker in ua:
            return name
    return "unknown"


def seconds(ms: int) -> str:
    return f"{ms / 1000:.1f}s"


def console_errors(events: list[dict[str, Any]]) -> list[str]:
    """Error messages the page wrote to the browser console (if the recorder captured them)."""
    errors: list[str] = []
    for event in events:
        data = event.get("data") or {}
        if event.get("type") != PLUGIN or data.get("plugin") != CONSOLE_PLUGIN:
            continue
        payload = data.get("payload") or {}
        if payload.get("level") == "error":
            parts = [str(p) for p in payload.get("payload") or []]
            errors.append(redact(" ".join(parts))[:200])
    return errors[:MAX_CONSOLE_ERRORS]


def build_timeline(events: list[dict[str, Any]], start_ms: int) -> list[tuple[int, str]]:
    """The story of the visit as (milliseconds from start, sentence) pairs, in time order."""
    index = PageIndex()
    moments: list[tuple[int, str]] = []
    last_typing: tuple[Any, int] | None = None  # (box id, time of last keystroke)
    seen_first_page = False

    for event in events:
        data = event.get("data") or {}
        timestamp = event.get("timestamp")
        if not isinstance(timestamp, int | float):
            continue
        at = int(timestamp) - start_ms
        kind = event.get("type")

        if kind == FULL_SNAPSHOT and isinstance(data.get("node"), dict):
            index.add(data["node"])
        elif kind == META and isinstance(data.get("href"), str):
            verb = "Went to" if seen_first_page else "Opened"
            seen_first_page = True
            moments.append((at, f"{verb} page {url_path(data['href'])}"))
        elif kind == INCREMENTAL_SNAPSHOT and data.get("source") == MUTATION:
            for add in data.get("adds") or []:
                if isinstance(add.get("node"), dict):
                    index.add(add["node"], add.get("parentId"))
        elif kind == INCREMENTAL_SNAPSHOT and data.get("source") == INPUT:
            box = data.get("id")
            # Deliberately never reads data["text"]: what people type stays private.
            if last_typing is None or last_typing[0] != box or at - last_typing[1] > TYPING_GAP_MS:
                moments.append((at, f"Typed in {index.describe(box)} (text hidden)"))
            last_typing = (box, at)

    # Clicks come from the shared analysis, which already knows which ones were rage clicks.
    for click in analyze(events).clicks:
        name = index.describe(click.target)
        if click.rage:
            moments.append((click.at_ms, f"Rage click on {name}: page did not react"))
        elif click.dead:
            moments.append((click.at_ms, f"Clicked {name}: page did not react"))
        else:
            moments.append((click.at_ms, f"Clicked {name}"))

    return sorted(moments, key=lambda m: m[0])


def screen_size(events: list[dict[str, Any]]) -> str | None:
    for event in events:
        data = event.get("data") or {}
        if event.get("type") == META and data.get("width") and data.get("height"):
            return f"{data['width']}x{data['height']}"
    return None


def build_digest(page_url: str, user_agent: str | None, events: list[dict[str, Any]]) -> str:
    """The whole text sent to Claude about one visit."""
    result = analyze(events)
    times = [int(e["timestamp"]) for e in events if isinstance(e.get("timestamp"), int | float)]
    start = min(times) if times else 0

    lines = [
        f"Start page: {url_path(page_url)}",
        f"Browser: {browser_family(user_agent)}",
        f"Screen: {screen_size(events) or 'unknown'}",
        f"Duration: {seconds(result.duration_ms)}",
        f"Clicks: {len(result.clicks)} ({result.rage_click_count} part of a rage-click burst)",
        "",
        "Timeline (time since the visit started):",
    ]
    timeline = build_timeline(events, start)
    for at, text in timeline[:MAX_TIMELINE_LINES]:
        lines.append(f"- {seconds(at)} {text}")
    if len(timeline) > MAX_TIMELINE_LINES:
        lines.append(f"- ({len(timeline) - MAX_TIMELINE_LINES} more moments left out)")
    if not timeline:
        lines.append("- (nothing happened)")

    errors = console_errors(events)
    if errors:
        lines += ["", "Browser console errors:"] + [f"- {message}" for message in errors]
    return "\n".join(lines)
