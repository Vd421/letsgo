# A fake Claude client for tests. No real call to Claude is ever made.
from types import SimpleNamespace
from typing import Any

from app.prompts import REPORT_TOOL_NAME

GOOD_REPORT = {
    "summary": "The visitor tried to check out but nothing happened.",
    "bugs": [
        {
            "title": "Checkout button does nothing",
            "severity": "high",
            "atMs": 4200,
            "evidence": "Four clicks in two seconds and the page never changed.",
        }
    ],
}


def reply(content: list[Any], stop_reason: str = "tool_use") -> SimpleNamespace:
    return SimpleNamespace(content=content, stop_reason=stop_reason)


def tool_block(data: object, name: str = REPORT_TOOL_NAME) -> SimpleNamespace:
    return SimpleNamespace(type="tool_use", name=name, input=data)


class FakeClient:
    """Stands in for anthropic.Anthropic. Returns `result`, or raises it if it is an error."""

    def __init__(self, result: object) -> None:
        self.result = result
        self.calls: list[dict[str, Any]] = []
        self.messages = SimpleNamespace(create=self.create)

    def create(self, **kwargs: Any) -> object:
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result
