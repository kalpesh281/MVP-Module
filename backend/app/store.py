"""Reading and writing scans. Every function survives the database being down.

Three rules from docs/database.md, enforced here rather than remembered:

1. **Documents are append-only.** The only permitted updates are setting
   `cta_clicked` and attaching `refinement` once. `findings`, `score` and
   `grade` are never rewritten — a re-scan creates a new document. Scan
   history is the dataset we eventually take to an insurer, and a history
   that has been edited in place is worth nothing to them.
2. **`rubric_version` and `rate_version` are mandatory.** A score is only
   defensible if we can reproduce which rules produced it.
3. **A cached result is never presented as live.** `get_cached` returns the
   document with its age attached so the UI must acknowledge it.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from . import db
from .config import RATE_VERSION, RUBRIC_VERSION, SCAN_CACHE_HOURS

log = logging.getLogger(__name__)


def new_scan_id() -> str:
    """Appears in shareable URLs, so it is app-generated rather than an
    ObjectId — an ObjectId leaks a timestamp and a machine identifier."""
    return f"scn_{uuid4().hex[:20]}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- writing -------------------------------------------------------------

async def save_scan(doc: dict[str, Any]) -> str | None:
    """Insert a completed scan. Returns the id, or None if it was not stored.

    Called **after** the result has been streamed to the user, never
    before. A slow database write must not delay the result, and if the
    insert fails we log it and still serve the page: losing an analytics
    row is preferable to losing the user. docs/database.md section 7
    """
    doc.setdefault("_id", new_scan_id())
    doc["rubric_version"] = RUBRIC_VERSION
    doc["rate_version"] = RATE_VERSION
    doc.setdefault("scanned_at", _now())
    doc.setdefault("cta_clicked", False)

    if not db.available():
        return None
    try:
        await db.db().scans.insert_one(doc)
    except PyMongoError as exc:
        log.error("scan %s not stored (%s)", doc["_id"], type(exc).__name__)
        return None
    return doc["_id"]


async def mark_cta_clicked(scan_id: str) -> None:
    if not db.available():
        return
    try:
        await db.db().scans.update_one({"_id": scan_id}, {"$set": {"cta_clicked": True}})
    except PyMongoError as exc:
        log.error("cta flag not set on %s (%s)", scan_id, type(exc).__name__)


async def attach_refinement(scan_id: str, refinement: dict[str, Any]) -> bool:
    """Tier 1 answers, attached once. Stage 2.5.

    `$exists: False` in the filter is what makes "once" true rather than
    intended — a second submission does not overwrite the first, and the
    caller is told it did not apply.

    `refinement.demand_trigger` is analytics and routing only. It must
    never be read by `scoring` or `pricing`. docs/demand-triggers.md
    """
    if not db.available():
        return False
    refinement = {**refinement, "refined_at": _now()}
    try:
        result = await db.db().scans.update_one(
            {"_id": scan_id, "refinement": {"$exists": False}},
            {"$set": {"refinement": refinement}},
        )
    except PyMongoError as exc:
        log.error("refinement not attached to %s (%s)", scan_id, type(exc).__name__)
        return False
    return result.modified_count == 1


async def record_event(name: str, scan_id: str | None = None, **props: Any) -> None:
    """Analytics. Failure is silent by design — an analytics write must
    never surface to a user or interrupt a scan."""
    if not db.available():
        return
    try:
        await db.db().events.insert_one(
            {"name": name, "scan_id": scan_id, "ts": _now(), "props": props}
        )
    except PyMongoError:
        pass


# --- reading -------------------------------------------------------------

async def get_scan(scan_id: str) -> dict[str, Any] | None:
    """Backs shareable result URLs."""
    if not db.available():
        return None
    try:
        return await db.db().scans.find_one({"_id": scan_id})
    except PyMongoError as exc:
        log.error("scan %s not read (%s)", scan_id, type(exc).__name__)
        return None


async def get_cached(domain: str, hours: int = SCAN_CACHE_HOURS) -> dict[str, Any] | None:
    """The most recent scan of this domain inside the cache window.

    The returned document carries `cache_age_seconds`. A cached result is
    always rendered as "Last checked N hours ago · Re-check" — presenting
    stale findings as live would be the one dishonest thing on the page.
    """
    if not db.available():
        return None
    cutoff = _now() - timedelta(hours=hours)
    try:
        doc = await db.db().scans.find_one(
            {"domain": domain, "scanned_at": {"$gte": cutoff}},
            sort=[("scanned_at", -1)],
        )
    except PyMongoError as exc:
        log.error("cache lookup failed for %s (%s)", domain, type(exc).__name__)
        return None
    if doc is None:
        return None
    doc["cache_age_seconds"] = int((_now() - doc["scanned_at"]).total_seconds())
    return doc


# --- rate limiting -------------------------------------------------------

async def check_rate_limit(key: str, limit: int, window_s: int) -> bool:
    """True if the request is allowed. One atomic upsert, no read-then-write
    race. Mongo's TTL index expires the counters; there is no cleanup job.

    **Fails open.** If the database is unavailable we allow the scan. A
    rate limiter that takes the product down when it cannot count is worse
    than no rate limiter. docs/database.md section 6
    """
    if not db.available():
        return True
    now = _now()
    try:
        doc = await db.db().rate_limits.find_one_and_update(
            {"_id": key},
            {"$inc": {"count": 1}, "$setOnInsert": {"window_start": now}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if (now - doc["window_start"]).total_seconds() > window_s:
            await db.db().rate_limits.replace_one(
                {"_id": key}, {"_id": key, "count": 1, "window_start": now}
            )
            return True
        return doc["count"] <= limit
    except PyMongoError as exc:
        log.error("rate limit check failed for %s (%s)", key, type(exc).__name__)
        return True
