"""Orchestration. Runs the five checks concurrently and yields each as it lands.

**Not `asyncio.gather`.** Gather resolves all-at-once, which would make the
scanning screen sit on a spinner for 20 seconds and then fill instantly.
The whole point of the streaming feed is that the user watches a stranger's
software read their infrastructure in real time — that is the first moment
of surprise, and it is what makes them read the rest of the page.
docs/education-layer.md section 7

So: a queue. Workers push results the moment they have them, the generator
yields them in completion order, and the client renders them in a fixed
display order it already knows. docs/backend.md section 4

One dependency exists between checks: `subdomains` wants the certificate
SANs that `tls` produces. It waits for them with a short budget and starts
without them if TLS is slow — being a few hostnames short beats stalling
the largest category behind another check.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator

from ..config import TIMEOUTS
from . import creds, email_auth, headers, subdomains, tls
from .base import CheckResult

log = logging.getLogger(__name__)

# Display order for the client. Checks resolve at wildly different speeds —
# DNS in milliseconds, crt.sh in seconds — so the feed is seeded with these
# as `pending` and filled in place. Rendering in completion order makes the
# list jump. docs/frontend.md section 4
DISPLAY_ORDER = ("spf", "dkim", "dmarc", "tls", "headers", "creds", "subdomains")

_LABELS = {
    "spf": "SPF record",
    "dkim": "DKIM signing",
    "dmarc": "DMARC policy",
    "tls": "Certificate",
    "headers": "Security headers",
    "creds": "Breach history",
    "subdomains": "Public subdomains",
}

# How long `subdomains` will wait for TLS to hand over certificate SANs.
_SANS_WAIT = 6.0


async def run(domain: str) -> AsyncIterator[CheckResult]:
    """Yield CheckResults as they complete. Never raises for a check failure."""
    queue: asyncio.Queue[CheckResult] = asyncio.Queue()

    # Resolved by the tls worker, awaited by the subdomains worker.
    sans_ready: asyncio.Future[list[str]] = asyncio.get_running_loop().create_future()

    async def guard(check_id: str, coro, timeout: float) -> CheckResult | list[CheckResult]:
        """Run one check inside its budget. Any failure becomes `inconclusive`.

        An inconclusive check has its points removed from the denominator
        rather than scored as zero — we never grade a company well because
        a check could not run. docs/scoring-and-pricing.md section 3
        """
        try:
            return await asyncio.wait_for(coro, timeout)
        except (asyncio.TimeoutError, TimeoutError):
            return CheckResult.inconclusive(check_id, "Timed out", _LABELS.get(check_id))
        except Exception as exc:
            log.exception("check %s crashed", check_id)
            return CheckResult.inconclusive(
                check_id, "Could not complete", _LABELS.get(check_id)
            )

    async def emit(result: CheckResult | list[CheckResult]) -> None:
        for item in result if isinstance(result, list) else [result]:
            await queue.put(item)

    # --- workers ---------------------------------------------------------

    async def run_email_auth() -> None:
        # Emits three rows: spf, dkim, dmarc.
        outcome = await guard("email_auth", email_auth.run(domain), TIMEOUTS["email_auth"])
        if isinstance(outcome, CheckResult):     # the whole module timed out
            outcome = [
                CheckResult.inconclusive(cid, outcome.detail, _LABELS[cid])
                for cid in ("spf", "dkim", "dmarc")
            ]
        await emit(outcome)

    async def run_tls() -> None:
        result = await guard("tls", tls.run(domain), TIMEOUTS["tls"])
        if not sans_ready.done():
            sans_ready.set_result(result.extra.get("sans", []) if isinstance(result, CheckResult) else [])
        await emit(result)

    async def run_headers() -> None:
        await emit(await guard("headers", headers.run(domain), TIMEOUTS["headers"]))

    async def run_creds() -> None:
        await emit(await guard("creds", creds.run(domain), TIMEOUTS["creds"]))

    async def run_subdomains() -> None:
        try:
            sans = await asyncio.wait_for(asyncio.shield(sans_ready), _SANS_WAIT)
        except (asyncio.TimeoutError, TimeoutError):
            sans = []       # start without them rather than stall behind TLS
        await emit(await guard(
            "subdomains", subdomains.run(domain, sans), TIMEOUTS["subdomains"]
        ))

    workers = [
        asyncio.create_task(run_email_auth()),
        asyncio.create_task(run_tls()),
        asyncio.create_task(run_headers()),
        asyncio.create_task(run_creds()),
        asyncio.create_task(run_subdomains()),
    ]

    # --- drain -----------------------------------------------------------
    # email_auth emits three rows, the others one each.
    expected = len(DISPLAY_ORDER)
    try:
        for _ in range(expected):
            yield await queue.get()
    finally:
        # A client that disconnects mid-scan must not leave workers running.
        for task in workers:
            if not task.done():
                task.cancel()
        await asyncio.gather(*workers, return_exceptions=True)


async def run_all(domain: str) -> list[CheckResult]:
    """Collect every result, sorted into display order. For the CLI and tests."""
    collected = [result async for result in run(domain)]
    position = {cid: i for i, cid in enumerate(DISPLAY_ORDER)}
    return sorted(collected, key=lambda r: position.get(r.id, 99))
