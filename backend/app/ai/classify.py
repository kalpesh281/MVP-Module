"""Call 1 — what does this company actually do?

Input is the homepage HTML that `headers.py` already fetched, so this call
costs no extra request to the target. It runs concurrently with the slow
network checks, not after them: it needs nothing from them, and waiting
would add its latency to the scan's.

What it drives: the revenue band (and therefore the premium), the claim
scenario, and the Stage 2 coverage recommendation. When it fails we
proceed without a profile and price at the smallest revenue band — quoting
low and correcting upward at Tier 1 is recoverable; quoting high and
losing the user at the first screen is not.
docs/ai-layer.md call 1, docs/scoring-and-pricing.md 4.2
"""

from __future__ import annotations

import logging
import re

from ..config import AI_MAX_TOKENS
from .provider import AllProvidersFailed
from .registry import client_for
from .schemas import CompanyProfile

log = logging.getLogger(__name__)

SYSTEM = """You are a commercial insurance underwriting analyst assessing Indian \
technology companies for cyber liability cover.

Infer only what the evidence supports. When uncertain, choose the more
conservative option. estimated_size_band drives pricing — if the page gives no
headcount signal, infer from customer logos, office locations, and team pages,
and prefer the smaller band.

what_they_do must be one plain sentence a non-technical person would understand.
Do not repeat the company's own marketing language back.

dpdp_act_applies is true if the company appears to process personal data of
people in India. For an Indian company with any consumer or user accounts, it
almost always does."""

# Strip everything a browser would not show a reader. Scripts and styles are
# most of a modern homepage's bytes and none of its meaning — removing them
# roughly triples how much actual content fits in the budget.
_NOISE = re.compile(
    r"<(script|style|noscript|svg)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL
)
_TAGS = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"[ \t\r\f\v]+")
_BLANKS = re.compile(r"\n{3,}")

_TEXT_BUDGET = 12_000        # characters of visible text, ≈3K tokens


def _visible_text(html: str) -> str:
    text = _NOISE.sub(" ", html)
    text = _TAGS.sub("\n", text)
    text = _SPACE.sub(" ", text)
    return _BLANKS.sub("\n\n", text).strip()[:_TEXT_BUDGET]


def _prompt(domain: str, page: dict) -> str:
    parts = [f"Domain: {domain}"]
    if page.get("title"):
        parts.append(f"Page title: {page['title']}")
    if page.get("description"):
        parts.append(f"Meta description: {page['description']}")
    if page.get("final_url"):
        parts.append(f"Resolved to: {page['final_url']}")
    fingerprint = page.get("fingerprint") or {}
    if fingerprint:
        detected = ", ".join(f"{k}: {v}" for k, v in fingerprint.items())
        parts.append(f"Server technology detected: {detected}")
    parts.append("\nHomepage text:\n" + _visible_text(page.get("html", "")))
    return "\n".join(parts)


async def run(domain: str, page: dict) -> tuple[CompanyProfile | None, str | None]:
    """Return (profile, model name). Both None when classification fails.

    Never raises. A scan that cannot classify the company still produces a
    grade, a premium and a fix list — the deterministic path has no AI
    dependency at all. docs/ai-layer.md section 6
    """
    if not (page.get("html") or page.get("title") or page.get("description")):
        # `headers.py` could not reach the site. There is nothing to read,
        # and asking a model to classify a domain from its name alone
        # invites exactly the invention we cannot allow.
        log.info("classify skipped for %s: no page content", domain)
        return None, None

    client = client_for("classify")
    if client is None:
        log.info("classify skipped for %s: no provider key set", domain)
        return None, None

    try:
        profile, model = await client.parse(
            system=SYSTEM,
            user=_prompt(domain, page),
            schema=CompanyProfile,
            max_tokens=min(AI_MAX_TOKENS, 1000),
        )
    except AllProvidersFailed as exc:
        log.warning("classify failed for %s: %s", domain, exc)
        return None, None

    return profile, model
