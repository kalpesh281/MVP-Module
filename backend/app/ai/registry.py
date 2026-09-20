"""Builds a provider chain for a call. All configuration lives in config.py.

This module is wiring only — to change a model, a chain, or a provider,
edit `AI_MODELS` / `AI_CHAINS` in app/config.py. Nothing here needs editing.

Set PROVIDER_REPORT / PROVIDER_CLASSIFY / PROVIDER_QA in .env to a model
alias (e.g. `groq-large`) to force one model and skip the chain.
"""

from __future__ import annotations

import os

from ..config import AI_CHAINS, AI_ENDPOINTS, AI_MODELS, AI_TIMEOUT
from .provider import Client, Model


def _model(alias: str) -> Model | None:
    """Resolve an alias to a Model, or None if its key is not set."""
    spec = AI_MODELS.get(alias)
    if spec is None:
        return None
    provider, model_id, key_env = spec
    key = os.getenv(key_env)
    if not key:
        return None
    return Model(
        name=f"{provider}/{model_id}",
        base_url=AI_ENDPOINTS[provider],
        api_key=key,
        model=model_id,
    )


def client_for(call: str, timeout: float | None = None) -> Client | None:
    """Build the provider chain for a call, or None if no key is set.

    None is a supported outcome, not an error. The caller renders static
    fallback copy and the scan still produces a grade and a premium.
    """
    override = os.getenv(f"PROVIDER_{call.upper()}")
    aliases = [override] if override in AI_MODELS else AI_CHAINS.get(call, [])

    chain = [m for m in (_model(a) for a in aliases) if m is not None]
    if not chain:
        return None
    return Client(chain, timeout=timeout if timeout is not None else AI_TIMEOUT)


def describe() -> list[str]:
    """Human-readable routing, for the startup log and the CLI."""
    lines = []
    for call in AI_CHAINS:
        client = client_for(call)
        names = " → ".join(m.name for m in client.chain) if client else "none (static fallback)"
        lines.append(f"  {call:<9} {names}")
    return lines
