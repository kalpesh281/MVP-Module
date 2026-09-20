"""The scan, start to finish, as a stream of events.

This is `docs/backend.md` section 3 in code. It owns the order things
happen in, and that order is the architecture:

    checks stream out as they land
      └─ the moment `headers` returns HTML, AI call 1 starts as a task
    every check is in
      └─ score, grade, premium, fixes   — computed, no model involved
    then and only then
      └─ AI call 2 writes prose around numbers it cannot change

Two deliberate choices worth stating:

**Classification starts mid-scan, not after.** Subdomain enumeration takes
up to 24 seconds. Classification takes two. Running them in sequence would
add two seconds to every scan for no reason.

**Nothing here can fail the scan.** A crashed check becomes inconclusive, a
dead AI provider becomes static copy, an unreachable database becomes no
cache. The only thing that stops a scan is a domain we refused to accept.

Transport-free on purpose: it yields dicts, and `main.py` turns them into
SSE frames. That means the whole request flow is testable without HTTP.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from typing import Any

from . import ai, store
from .config import MIN_SCAN_DWELL, SCAN_HARD_LIMIT
from .scanner import runner
from .scanner.base import CheckResult
from .scoring import (
    band_for_headcount,
    limit_for_band,
    build_fixes,
    premium_for,
    premium_table,
    score,
    strengths,
)

log = logging.getLogger(__name__)

# Below this many seconds left, do not even start the report call — the
# fastest healthy model answers in about 1.5s and anything tighter just
# buys a guaranteed timeout.
_MIN_REPORT_BUDGET = 4.0


def _cached_event(doc: dict[str, Any]) -> dict[str, Any]:
    """Replay a stored scan as a `result` event.

    `cache_age_seconds` travels with it and the UI is required to render
    it — "Last checked 3 hours ago · Re-check". Presenting stale findings
    as live would be the one dishonest thing on the page.
    docs/database.md section 5
    """
    report = doc.get("report") or {}
    return {
        "type": "result",
        "scan_id": doc["_id"],
        "domain": doc["domain"],
        "scanned_at": doc["scanned_at"].isoformat(),
        "cached": True,
        "cache_age_seconds": doc.get("cache_age_seconds", 0),
        "score": doc.get("score"),
        "grade": doc.get("grade"),
        "available_points": doc.get("available_points"),
        "headline": report.get("headline", ""),
        "profile": doc.get("profile"),
        "premium": doc.get("premium"),
        "premium_table": doc.get("premium_table"),
        "fixes": report.get("fixes", []),
        "combined_if_all_fixed": report.get("combined_if_all_fixed"),
        "strengths": report.get("strengths", []),
        "rubric_version": doc.get("rubric_version"),
        "rate_version": doc.get("rate_version"),
    }


async def run(domain: str, *, use_cache: bool = True) -> AsyncIterator[dict[str, Any]]:
    """Yield event dicts for one scan. Never raises for a check failure."""
    started = time.monotonic()

    if use_cache:
        cached = await store.get_cached(domain)
        if cached is not None:
            log.info("cache hit for %s (%ss old)", domain, cached["cache_age_seconds"])
            # Replay every stored finding so the feed still animates, then
            # the result. A cached scan should look like a scan, not like
            # a page that appeared instantly.
            for finding in cached.get("findings", []):
                yield {"type": "check", **{k: finding[k] for k in
                       ("id", "label", "status", "detail", "evidence")
                       if k in finding}}
            yield _cached_event(cached)
            return

    results: list[CheckResult] = []
    classify_task: asyncio.Task | None = None

    try:
        async for result in runner.run(domain):
            results.append(result)
            yield {"type": "check", **{k: v for k, v in result.as_event().items()
                                       if k != "type"}}

            # The homepage HTML arrives with the headers check. Start
            # classification immediately rather than waiting for crt.sh.
            if result.id == "headers" and classify_task is None and result.extra:
                classify_task = asyncio.create_task(ai.classify.run(domain, result.extra))
    except Exception:
        log.exception("scan of %s failed during checks", domain)
        if classify_task is not None:
            classify_task.cancel()
        yield {"type": "error", "code": "internal",
               "message": "Something went wrong while scanning. Please try again."}
        return

    # --- deterministic half: no model has been consulted yet -------------
    findings = [r.as_finding() for r in results]
    scored = score(findings)

    profile = None
    classified_by = None
    if classify_task is not None:
        remaining = max(0.5, SCAN_HARD_LIMIT - (time.monotonic() - started))
        try:
            profile, classified_by = await asyncio.wait_for(classify_task, remaining)
        except (asyncio.TimeoutError, TimeoutError):
            classify_task.cancel()
            log.info("classify for %s did not finish inside the scan budget", domain)
        except Exception:
            log.exception("classify for %s crashed", domain)

    if profile is not None:
        yield {"type": "profile", **profile.model_dump()}

    band = band_for_headcount(profile.estimated_size_band if profile else None)
    # The cover amount follows the band. It used to be fixed at ₹5 Cr for
    # everyone, which priced a large company's policy as a small one's and
    # made the two look comparable on screen.
    limit = limit_for_band(band)
    premium = premium_for(scored.grade, band, limit)
    fixes, combined = build_fixes(findings, scored, revenue_band=band, limit=limit)
    good = strengths(results)

    # --- explanation half: prose only ------------------------------------
    # Bounded by what is left of the scan budget, not by the provider's
    # patience. A chain of four models at 20s each is 80s of failover, and
    # the user is looking at a spinner for every one of them. Better words
    # are not worth a minute; the static copy is already publishable.
    report_budget = SCAN_HARD_LIMIT - (time.monotonic() - started)
    if report_budget < _MIN_REPORT_BUDGET:
        log.info("report for %s skipped: %.1fs left of the scan budget",
                 domain, report_budget)
        prose = ai.report.static(scored, fixes, good)
    else:
        try:
            prose = await asyncio.wait_for(
                ai.report.write(domain, scored, fixes, findings, good, profile),
                report_budget,
            )
        except (asyncio.TimeoutError, TimeoutError):
            log.info("report for %s exceeded its %.1fs budget, using static copy",
                     domain, report_budget)
            prose = ai.report.static(scored, fixes, good)

    scan_id = store.new_scan_id()
    table = premium_table(band, limit)
    duration_ms = int((time.monotonic() - started) * 1000)

    payload: dict[str, Any] = {
        "type": "result",
        "scan_id": scan_id,
        "domain": domain,
        "cached": False,
        "score": scored.score,
        "grade": scored.grade,
        "available_points": scored.available_points,
        "grade_suppressed": scored.grade_suppressed,
        "headline": prose["headline"],
        "profile": profile.model_dump() if profile else None,
        "premium": premium.as_dict(),
        "premium_table": table,
        "fixes": [f.as_dict() for f in fixes],
        "combined_if_all_fixed": combined,
        "strengths": prose["strengths"],
        "rubric_version": scored.rubric_version,
        "rate_version": table["rate_version"],
        "duration_ms": duration_ms,
    }

    # A result that lands in 300ms reads as a lookup, not an inspection —
    # and the streaming feed is where the user learns their own attack
    # surface exists. Hold the floor. docs/education-layer.md section 7
    dwell = MIN_SCAN_DWELL - (time.monotonic() - started)
    if dwell > 0:
        await asyncio.sleep(dwell)

    yield payload

    # --- after the user has their result ---------------------------------
    # Storage happens last and its failure is invisible. Losing an
    # analytics row is preferable to losing the user.
    # docs/database.md section 7
    await store.save_scan({
        "_id": scan_id,
        "domain": domain,
        "findings": findings,
        "profile": payload["profile"],
        "score": scored.score,
        "grade": scored.grade,
        "available_points": scored.available_points,
        "report": {
            "headline": prose["headline"],
            "fixes": payload["fixes"],
            "combined_if_all_fixed": combined,
            "strengths": prose["strengths"],
            "generated_by": prose["generated_by"] or "fallback",
            "classified_by": classified_by,
        },
        "premium": payload["premium"],
        "premium_table": table,
        "duration_ms": duration_ms,
    })
