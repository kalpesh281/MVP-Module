"""One interface over every provider, with a fallback chain per call.

All three providers we use — OpenAI, Groq, OpenRouter — speak the same
OpenAI-compatible HTTP API, so one client covers all of them and switching
is a base URL plus a key. That is the whole reason this project does not
need LangChain. docs/ai-framework.md section 3

Two things this layer guarantees to everything above it:

  1. It returns a validated Pydantic object, or it raises. Never a dict
     of unknown shape, never a half-parsed string.
  2. It never raises for a reason the caller could have survived. A dead
     provider falls through to the next one in the chain; only an empty
     chain is a real failure — and even then the caller falls back to
     static copy, because the product must work with AI entirely offline.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Models wrap JSON in markdown fences no matter how firmly you ask them not to.
_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.MULTILINE)


class AllProvidersFailed(Exception):
    """Every provider in the chain failed. The caller uses static copy."""


@dataclass(frozen=True, slots=True)
class Model:
    """A provider plus a model name. The unit of failover."""

    name: str           # "groq/gpt-oss-120b" — for logs and the report's generated_by
    base_url: str
    api_key: str
    model: str
    supports_json_mode: bool = True


def _extract_json(text: str) -> str:
    """Pull the JSON object out of whatever the model actually returned."""
    text = _FENCE.sub("", text).strip()
    start, end = text.find("{"), text.rfind("}")
    return text[start : end + 1] if start != -1 and end > start else text


class Client:
    """Calls a chain of models in order until one returns a valid object."""

    def __init__(self, chain: list[Model], timeout: float = 60.0) -> None:
        if not chain:
            raise ValueError("a provider chain needs at least one model")
        self.chain = chain
        self._timeout = timeout

    async def parse(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        max_tokens: int = 4000,
    ) -> tuple[T, str]:
        """Return (validated object, model name that produced it)."""
        failures: list[str] = []

        async with httpx.AsyncClient(timeout=self._timeout) as http:
            for model in self.chain:
                try:
                    # wait_for, not just the httpx timeout. httpx applies its
                    # timeout per read; a free-tier model that returns one
                    # byte every few seconds never trips it and can run for
                    # a minute. One observed call took 75s that way, which
                    # would blow SCAN_HARD_LIMIT on its own.
                    raw = await asyncio.wait_for(
                        self._call(http, model, system, user, schema, max_tokens),
                        self._timeout,
                    )
                except (asyncio.TimeoutError, TimeoutError):
                    failures.append(f"{model.name}: timed out after {self._timeout}s")
                    log.warning("provider %s timed out after %ss", model.name, self._timeout)
                    continue
                except Exception as exc:
                    failures.append(f"{model.name}: {type(exc).__name__}: {exc}")
                    log.warning("provider %s failed: %s", model.name, exc)
                    continue

                try:
                    return schema.model_validate_json(_extract_json(raw)), model.name
                except (ValidationError, json.JSONDecodeError) as exc:
                    # A model that cannot produce the schema will not produce it
                    # on a retry either. Move on rather than burn the budget.
                    failures.append(f"{model.name}: bad schema: {exc}")
                    log.warning("provider %s returned unusable JSON: %s", model.name, exc)

        raise AllProvidersFailed("; ".join(failures))

    async def _call(
        self,
        http: httpx.AsyncClient,
        model: Model,
        system: str,
        user: str,
        schema: type[T],
        max_tokens: int,
    ) -> str:
        # Every provider here honours the OpenAI chat-completions shape.
        # The schema goes in the prompt as well as in response_format,
        # because JSON mode guarantees valid JSON, not the right JSON.
        body: dict[str, Any] = {
            "model": model.model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": (
                        f"{user}\n\n"
                        f"Respond with JSON matching exactly this schema. "
                        f"No prose, no markdown fence.\n"
                        f"{json.dumps(schema.model_json_schema())}"
                    ),
                },
            ],
        }
        if model.supports_json_mode:
            body["response_format"] = {"type": "json_object"}

        response = await http.post(
            f"{model.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {model.api_key}",
                "Content-Type": "application/json",
                # OpenRouter attributes traffic by these; harmless elsewhere.
                "HTTP-Referer": "https://example.com",
                "X-Title": "Boundry",
            },
            json=body,
        )
        response.raise_for_status()

        choices = response.json().get("choices") or []
        if not choices:
            raise RuntimeError("no choices returned")

        content = choices[0].get("message", {}).get("content")
        if not content:
            # Reasoning models sometimes put everything in `reasoning` and
            # leave `content` empty. That is unusable for structured output.
            raise RuntimeError("empty content")
        return content
