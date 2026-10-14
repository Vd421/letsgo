# Asks Claude to summarise a visit and flag bugs. This is the only file that talks to the
# Claude API. The model name and API key come from settings (.env), never from the code.
from dataclasses import dataclass

import anthropic
from pydantic import BaseModel, Field, ValidationError

from app.config import settings
from app.prompts import (
    REPORT_TOOL,
    REPORT_TOOL_NAME,
    SYSTEM_PROMPT,
    build_user_message,
)
from app.schemas import BugFlag

MAX_TOKENS = 4096  # room for Claude's thinking plus a short answer
MAX_BUGS = 10


class AiError(Exception):
    """The analysis failed and trying again will not help. The message is safe to show people."""


class AiTemporaryError(AiError):
    """A hiccup (rate limit, timeout, busy servers). Trying again later may work."""


class ReportInput(BaseModel):
    """What Claude must send back through the tool. Pydantic checks it before we trust it."""

    summary: str = Field(min_length=1, max_length=2000)
    bugs: list[BugFlag] = Field(max_length=MAX_BUGS)


@dataclass
class AnalysisResult:
    summary: str
    bugs: list[BugFlag]


def make_client() -> anthropic.Anthropic:
    """The Claude client. The key is passed in explicitly because .env is not in os.environ."""
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.claude_timeout_seconds,
        max_retries=1,  # the SDK retries once quickly; Celery retries later with a longer wait
    )


def parse_report(raw: object) -> AnalysisResult:
    """Check Claude's tool answer. Anything unexpected becomes a safe AiError."""
    try:
        report = ReportInput.model_validate(raw)
    except ValidationError as error:
        raise AiError("The AI reply was not in the expected format") from error
    return AnalysisResult(summary=report.summary.strip(), bugs=report.bugs)


def analyze_digest(client: anthropic.Anthropic, model: str, digest: str) -> AnalysisResult:
    """Send the digest to Claude and return its summary and bug list."""
    try:
        response = client.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=[REPORT_TOOL],
            messages=[{"role": "user", "content": build_user_message(digest)}],
        )
    except (anthropic.RateLimitError, anthropic.APIConnectionError) as error:
        # APITimeoutError is a kind of APIConnectionError, so timeouts land here too.
        raise AiTemporaryError("The AI is busy or slow right now") from error
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as error:
        raise AiError("The AI key was rejected. Check ANTHROPIC_API_KEY") from error
    except anthropic.APIStatusError as error:
        if error.status_code >= 500:
            raise AiTemporaryError("The AI service had a problem") from error
        raise AiError("The AI request was rejected") from error

    if response.stop_reason == "refusal":
        raise AiError("The AI declined to analyse this visit")
    for block in response.content:
        if block.type == "tool_use" and block.name == REPORT_TOOL_NAME:
            return parse_report(block.input)
    raise AiError("The AI reply had no analysis in it")
