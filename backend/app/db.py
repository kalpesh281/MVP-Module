"""The MongoDB connection and the indexes.

One client for the whole process, created at startup and closed at
shutdown. `AsyncMongoClient` owns its own connection pool; constructing
one per request exhausts an Atlas free tier's connection limit within
minutes. docs/database.md section 1

Everything here treats the database as optional. A scan that cannot be
cached or stored is a scan we lose analytics on; a scan that fails because
the database is down is a user we lose. The second is much worse, so
`available()` exists and every caller checks it.
"""

from __future__ import annotations

import logging

from pymongo import AsyncMongoClient
from pymongo.errors import PyMongoError

from .config import MONGODB_DB, MONGODB_URI

log = logging.getLogger(__name__)

_client: AsyncMongoClient | None = None
_healthy = False


def available() -> bool:
    """True once a ping has succeeded. False disables caching and storage
    without disabling scanning."""
    return _healthy


def client() -> AsyncMongoClient:
    global _client
    if _client is None:
        if not MONGODB_URI:
            raise RuntimeError("MONGODB_URI is not set")
        _client = AsyncMongoClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=5000,
            tz_aware=True,               # scanned_at must come back UTC-aware
            appname="cyber-scorecard",
        )
    return _client


def db():
    return client()[MONGODB_DB]


async def connect() -> bool:
    """Ping, then create indexes. Returns False instead of raising.

    Called from the FastAPI lifespan. A failure here logs and the app
    starts anyway — in degraded mode, which the health endpoint reports.
    """
    global _healthy
    if not MONGODB_URI:
        log.warning("MONGODB_URI not set — running without cache or storage")
        _healthy = False
        return False
    try:
        await client().admin.command("ping")
        await ensure_indexes()
    except PyMongoError as exc:
        # Deliberately logs the exception type and message only. The URI is
        # a credential and pymongo puts the host in some messages, so this
        # must never become log.exception with the connection string.
        log.error("mongodb unavailable (%s) — running without cache or storage",
                  type(exc).__name__)
        _healthy = False
        return False
    _healthy = True
    log.info("mongodb connected, database %s", MONGODB_DB)
    return True


async def close() -> None:
    global _client, _healthy
    if _client is not None:
        await _client.close()
        _client = None
    _healthy = False


async def ensure_indexes() -> None:
    """Idempotent. Safe to run on every start.

    The compound (domain, scanned_at desc) index is the one that matters:
    every scan request hits it first for the cache check.
    docs/database.md section 4
    """
    d = db()
    await d.scans.create_index([("domain", 1), ("scanned_at", -1)])
    await d.scans.create_index([("scanned_at", -1)])
    await d.scans.create_index([("grade", 1), ("scanned_at", -1)])

    await d.events.create_index([("name", 1), ("ts", -1)])
    await d.events.create_index([("scan_id", 1)])
    # Analytics rows expire themselves after 90 days. No cleanup job.
    await d.events.create_index([("ts", 1)], expireAfterSeconds=90 * 24 * 3600)

    await d.rate_limits.create_index([("window_start", 1)], expireAfterSeconds=3600)
