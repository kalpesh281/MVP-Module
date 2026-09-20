"""Breach exposure — 20 of the 100 points, in two halves.

The category has a free half and a paid half, because the useful data is
split across two Have I Been Pwned endpoints with different access rules.

  FREE  (8 pts)  `/breaches?Domain=` — no key, no ownership proof.
                 Has this company itself had a disclosed breach? That is
                 prior-incident history, which is a question on every real
                 proposal form.

  PAID  (12 pts) `/breacheddomain/` — needs a key AND proof that you own
                 the domain. Counts staff addresses appearing in breach
                 corpora. We cannot have this for a domain we are scanning
                 cold, so at Tier 0 it stays inconclusive and its points
                 leave the denominator.

Never display a count we cannot substantiate. docs/scan-checks.md section 2
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from ..config import HIBP_API_KEY, USER_AGENT
from .base import CheckResult, Deduction

_BREACHES_URL = "https://haveibeenpwned.com/api/v3/breaches"

# A breach inside this window still reflects on current practice. Older than
# this and it is history — relevant, but not the same signal.
_RECENT_YEARS = 3


def _years_since(iso_date: str) -> float:
    try:
        when = datetime.strptime(iso_date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return 99.0
    return (datetime.now(timezone.utc) - when).days / 365.25


async def _own_breaches(domain: str, client: httpx.AsyncClient) -> list[dict]:
    """Disclosed breaches of this company's own systems. Free, keyless.

    HIBP asks for a descriptive User-Agent and rate-limits anonymous
    callers. Both are honoured — see docs/scan-checks.md legal basis.
    """
    response = await client.get(
        _BREACHES_URL,
        params={"Domain": domain},
        headers={"User-Agent": USER_AGENT},
        timeout=8.0,
    )
    if response.status_code == 404:
        return []
    response.raise_for_status()
    return response.json() or []


async def run(domain: str) -> CheckResult:
    async with httpx.AsyncClient(follow_redirects=True) as client:
        breaches = await _own_breaches(domain, client)

    # Points that could not be assessed are removed from the denominator,
    # never scored as zero. docs/scoring-and-pricing.md section 3
    unavailable = [] if HIBP_API_KEY else ["creds.account_exposure"]

    if not breaches:
        return CheckResult(
            id="creds", label="Breach history", status="pass",
            detail="No disclosed breach of this company on record",
            evidence={"own_breaches": [], "source": "hibp_public_breaches",
                      "unavailable": unavailable},
        )

    verified = [b for b in breaches if b.get("IsVerified")]
    considered = verified or breaches
    newest = min(_years_since(b.get("BreachDate", "")) for b in considered)
    largest = max(int(b.get("PwnCount") or 0) for b in considered)

    names = ", ".join(
        f"{b.get('Name')} ({str(b.get('BreachDate', ''))[:4]})" for b in considered[:3]
    )
    evidence = {
        "own_breaches": [
            {"name": b.get("Name"), "date": b.get("BreachDate"),
             "accounts": b.get("PwnCount"), "verified": bool(b.get("IsVerified")),
             "data_classes": b.get("DataClasses", [])}
            for b in considered
        ],
        "source": "hibp_public_breaches",
        "unavailable": unavailable,
    }

    if len(considered) > 1:
        return CheckResult(
            id="creds", label="Breach history", status="fail",
            detail=f"{len(considered)} disclosed breaches on record — {names}",
            evidence=evidence,
            deductions=[Deduction("breach.multiple", note=f"{len(considered)} breaches")],
        )

    if newest <= _RECENT_YEARS:
        return CheckResult(
            id="creds", label="Breach history", status="fail",
            detail=f"Disclosed breach in the last {_RECENT_YEARS} years — {names}",
            evidence=evidence,
            deductions=[Deduction("breach.recent", note=f"{largest:,} accounts")],
        )

    return CheckResult(
        id="creds", label="Breach history", status="warn",
        detail=f"Historic breach on record — {names}",
        evidence=evidence,
        deductions=[Deduction("breach.historic", note=f"{largest:,} accounts")],
    )
