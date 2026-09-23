"""FastAPI app and the SSE endpoint.

Thin by design. Everything interesting is in `orchestrator.py`; this
module handles HTTP, and HTTP only.

Two things here are easy to forget and produce a stream that works
perfectly on localhost and silently buffers in production:

  * `X-Accel-Buffering: no` — without it nginx holds the whole response
    and the user sees nothing for 20 seconds, then everything at once.
  * `Cache-Control: no-cache` — an intermediary caching an event stream
    serves one user another user's scan.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import ai, db, methodology, orchestrator, store
from .config import (
    AI_CHAINS,
    RATE_VERSION,
    RATE_LIMIT_PER_IP,
    RATE_LIMIT_WINDOW_S,
    RUBRIC_VERSION,
    SCAN_CACHE_HOURS,
)
from .domain import InvalidDomain, normalise

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()                 # returns False rather than raising
    log.info("AI routing:\n%s", "\n".join(ai.describe()))
    yield
    await db.close()


app = FastAPI(
    title="Boundry",
    version=RUBRIC_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
)

# The frontend is a separate origin in development. Tightened to the real
# origin before anything is deployed — a wildcard here on a service that
# takes a domain and scans it is an open proxy for someone else's traffic.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _client_ip(request: Request) -> str:
    """Behind a proxy the socket address is the proxy's. Trust
    X-Forwarded-For only when we are actually behind one, because a
    client can otherwise set it to anything and bypass the limiter."""
    if os.getenv("TRUST_PROXY", "").lower() in ("1", "true", "yes"):
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse({"type": "error", "code": code, "message": message}, status)


@app.get("/api/health")
async def health():
    """Reports degraded dependencies rather than hiding them. The product
    runs without either of these; the operator should still know."""
    return {
        "ok": True,
        "rubric_version": RUBRIC_VERSION,
        "database": "connected" if db.available() else "unavailable",
        # Derived from AI_CHAINS rather than listed here, so a new call
        # is reported the moment it exists. The list used to be typed out,
        # and `guidance` was missing from it for the whole of its first
        # day: the health endpoint said the AI layer was fine while one of
        # its four calls went unreported.
        "ai": {call: (ai.client_for(call) is not None) for call in AI_CHAINS},
    }


@app.get("/api/scan")
async def scan(request: Request, domain: str, refresh: bool = False):
    try:
        domain = normalise(domain)
    except InvalidDomain as exc:
        return _error(exc.code, exc.message, 400)

    allowed = await store.check_rate_limit(
        f"ip:{_client_ip(request)}", RATE_LIMIT_PER_IP, RATE_LIMIT_WINDOW_S
    )
    if not allowed:
        return _error(
            "rate_limited",
            f"You've run {RATE_LIMIT_PER_IP} scans in the last hour. Try again later.",
            429,
        )

    async def events():
        try:
            async for payload in orchestrator.run(domain, use_cache=not refresh):
                yield _sse(payload)
        except asyncio.CancelledError:
            # The user closed the tab mid-scan. Not an error; the runner's
            # own finally block cancels the workers.
            log.info("client disconnected during scan of %s", domain)
            raise
        except Exception:
            log.exception("scan stream for %s failed", domain)
            yield _sse({"type": "error", "code": "internal",
                        "message": "Something went wrong. Please try again."})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/scan/{scan_id}")
async def get_scan(scan_id: str):
    """Backs shareable result URLs."""
    doc = await store.get_scan(scan_id)
    if doc is None:
        return _error("not_found", "We couldn't find that scan.", 404)
    report = doc.get("report") or {}
    return {
        "type": "result",
        "scan_id": doc["_id"],
        "domain": doc["domain"],
        "scanned_at": doc["scanned_at"].isoformat(),
        "cached": True,
        "cache_age_seconds": 0,
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
        "findings": doc.get("findings", []),
        "rubric_version": doc.get("rubric_version"),
        "rate_version": doc.get("rate_version"),
    }


class CtaClick(BaseModel):
    scan_id: str = Field(min_length=4, max_length=40)


@app.post("/api/cta")
async def cta(body: CtaClick):
    """The Tier 0 → Tier 1 conversion event. The single most important
    number in the prototype's analytics."""
    await store.mark_cta_clicked(body.scan_id)
    await store.record_event("cta_clicked", body.scan_id)
    return {"ok": True}


@app.get("/api/methodology")
async def methodology_endpoint():
    """The published rubric and rate card, read from the live constants.

    Static: no database, no model, no domain. It is the same answer for
    everyone, which is the point — a scoring system nobody can check is
    indistinguishable from one that was invented.
    """
    return methodology.payload()


@app.get("/api/config")
async def config():
    """What the frontend needs to know about the backend's behaviour."""
    return {
        "cache_hours": SCAN_CACHE_HOURS,
        "rate_limit_per_hour": RATE_LIMIT_PER_IP,
        "rubric_version": RUBRIC_VERSION,
        # The footer used to carry these as literal text and went stale the
        # first time a version moved. Versions are served, never typed.
        "rate_version": RATE_VERSION,
    }
