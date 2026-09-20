"""Attack surface — 23 of the 100 points. The largest single category.

Certificate Transparency logs are a public, append-only record of every
certificate a CA has issued. Reading them tells us which hostnames a
company has published certificates for, without sending a single packet to
their infrastructure. Certificate SANs from `tls.py` are a second free
source and the fallback when crt.sh is unavailable.

The only traffic this check sends to the target is one HEAD request per
candidate host — the same request a link checker makes. No port scanning,
no path guessing, no fuzzing. docs/scan-checks.md legal basis

Why this is worth 23 points: a forgotten `staging.` box running an old
build with a copy of production data is the single most common ransomware
entry path for a company of this size, and it is invisible from the inside
because nobody remembers it exists.
"""

from __future__ import annotations

import asyncio
import re

import httpx

from ..config import (
    SUBDOMAIN_MAX_PROBES,
    SUBDOMAIN_PROBE_CONCURRENCY,
    SUBDOMAIN_RISK_PATTERNS,
    SUBDOMAIN_SPRAWL_THRESHOLD,
    USER_AGENT,
)
from .base import CheckResult, Deduction

_CRTSH = "https://crt.sh/"
# Must leave room inside TIMEOUTS['subdomains'] for the probe sweep
# that follows. crt.sh answers in 3-4s when healthy.
# Measured 2026-09-20: three consecutive requests for the same domain
# returned 404, then a read timeout, then 200 with 717 rows — in ten
# seconds. crt.sh is not rate-limiting us; it is simply this unreliable.
# A healthy response takes 3.8-4.7s, so 8s is the honest ceiling and two
# attempts are not paranoia.
_CRTSH_TIMEOUT = 8.0
_CRTSH_RETRY_DELAY = 1.0

# crt.sh rate-limits by IP and signals it with a 404 — indistinguishable
# from "this domain has no certificates" unless you already know the domain
# has some. One retry after a pause recovers most of them. A process-local
# cache keeps repeat scans of the same domain off the service entirely;
# certificate transparency changes on the order of days, not seconds.
_ct_cache: dict[str, set[str]] = {}

# `Index of /` is Apache/nginx autoindex. It means the directory has no
# index file and the server is listing its contents to anyone who asks.
_DIR_LISTING = re.compile(r"<title>\s*Index of /", re.IGNORECASE)

_LABEL_SPLIT = re.compile(r"[.\-_]")


def _risk_label(host: str) -> str | None:
    """Return the risk pattern this host matches, or None.

    Matches on whole labels, not substrings. `devops.example.com` should
    not be flagged for containing "dev", and `latest.example.com` should
    not be flagged for containing "test". A false positive here reads as
    sloppiness to the one person whose opinion matters — their CTO.
    """
    for part in _LABEL_SPLIT.split(host.lower()):
        if part in SUBDOMAIN_RISK_PATTERNS:
            return part
    return None


def _clean_san(name: str) -> str | None:
    """Normalise a certificate name, or None if it names no single host.

    A wildcard SAN is discarded deliberately. `*.zerodha.com` tells us a
    wildcard certificate exists; it does not tell us that any particular
    subdomain does. Expanding it to the apex would be inventing a finding.
    """
    name = name.strip().lower().rstrip(".")
    if not name or name.startswith("*"):
        return None
    return name


async def _from_crtsh(domain: str, client: httpx.AsyncClient) -> set[str]:
    """Hostnames from Certificate Transparency. Frequently slow or down."""
    if domain in _ct_cache:
        return _ct_cache[domain]

    last: Exception | None = None
    for attempt in (0, 1):
        if attempt:
            await asyncio.sleep(_CRTSH_RETRY_DELAY)
        try:
            response = await client.get(
                _CRTSH,
                params={"q": f"%.{domain}", "output": "json"},
                timeout=_CRTSH_TIMEOUT,
            )
            response.raise_for_status()
            rows = response.json()
        except Exception as exc:
            last = exc
            continue

        hosts: set[str] = set()
        for row in rows:
            for raw in str(row.get("name_value", "")).splitlines():
                name = _clean_san(raw)
                if name and name.endswith(f".{domain}"):
                    hosts.add(name)
        _ct_cache[domain] = hosts
        return hosts

    raise last if last else RuntimeError("crt.sh unavailable")


async def _probe(host: str, client: httpx.AsyncClient, gate: asyncio.Semaphore) -> dict | None:
    """One HEAD request. Returns a live-host record, or None if it is not live.

    A host that resolves but does not answer is not attack surface — it is
    a stale DNS record. Only something that serves a response counts.

    **The HTTPS failure must be a refusal, not a timeout.** An early version
    fell through to HTTP whenever HTTPS raised, and under 40-way concurrency
    that meant a slow TLS handshake got reported as `surface.plaintext_host`
    — three of Zerodha's blog subdomains were flagged as serving plaintext
    when all three answer 200 over HTTPS. A false finding of that kind is
    worse than a missed one: it is the first thing their CTO checks, and it
    is the fastest way to lose the room.
    """
    async with gate:
        https_refused = False
        try:
            response = await client.head(f"https://{host}/", timeout=4.0)
        except (httpx.ConnectError, httpx.UnsupportedProtocol):
            https_refused = True        # genuinely no TLS listener here
            response = None
        except Exception:
            return None                 # timeout or transport error: we do not know

        if response is None and https_refused:
            try:
                response = await client.head(f"http://{host}/", timeout=4.0)
            except Exception:
                return None
            scheme = "http"
        else:
            scheme = "https"

        if response is None or response.status_code >= 400:
            # Reachable but refusing — not exposed content.
            return None

        record = {
            "host": host,
            "scheme": scheme,
            "status": response.status_code,
            "server": response.headers.get("server", ""),
        }

        # Directory listing needs the body, so only fetch it when the host
        # is already known to be live and interesting.
        if _risk_label(host):
            try:
                body = await client.get(f"{scheme}://{host}/", timeout=4.0)
                record["directory_listing"] = bool(_DIR_LISTING.search(body.text[:4000]))
            except Exception:
                record["directory_listing"] = False
        return record


async def run(domain: str, sans: list[str] | None = None) -> CheckResult:
    """`sans` comes from tls.py — certificate hostnames we already paid for."""
    # Wildcard SANs are dropped by _clean_san, so a company using a single
    # wildcard certificate contributes nothing here. That is correct and
    # also a real limitation: when crt.sh is unavailable too, we genuinely
    # cannot enumerate their subdomains and must say so rather than guess.
    candidates: set[str] = set()
    for raw in sans or []:
        name = _clean_san(raw)
        if name and name.endswith(f".{domain}"):
            candidates.add(name)
    source = "certificate SANs"

    async with httpx.AsyncClient(
        follow_redirects=False, headers={"User-Agent": USER_AGENT}
    ) as client:
        try:
            from_ct = await _from_crtsh(domain, client)
            candidates |= from_ct
            source = "certificate transparency" if from_ct else source
        except Exception as exc:
            # crt.sh is down more often than it is up. Fall through to SANs.
            if not candidates:
                # Say why. "Could not read" with no reason is undebuggable
                # six weeks from now, and crt.sh fails in several different
                # ways: timeout, 502, and rate-limiting after repeat queries.
                reason = type(exc).__name__
                if isinstance(exc, httpx.HTTPStatusError):
                    reason = f"HTTP {exc.response.status_code}"
                return CheckResult.inconclusive(
                    "subdomains",
                    f"Certificate transparency logs unavailable ({reason})",
                    "Public subdomains",
                )
            source = f"certificate SANs (crt.sh unavailable: {type(exc).__name__})"

        total_found = len(candidates)

        # Probe the risky-looking hosts first: if we hit the cap, we want
        # to have spent the budget where a finding might actually be.
        ordered = sorted(candidates, key=lambda h: (_risk_label(h) is None, h))
        probe_list = ordered[:SUBDOMAIN_MAX_PROBES]

        # Cap in-flight requests. Forty simultaneous TLS handshakes from
        # one process starves them all and turns healthy hosts into
        # timeouts — which is how the plaintext false positives happened.
        gate = asyncio.Semaphore(SUBDOMAIN_PROBE_CONCURRENCY)
        results = await asyncio.gather(
            *(_probe(h, client, gate) for h in probe_list), return_exceptions=True
        )

    live = [r for r in results if isinstance(r, dict)]

    deductions: list[Deduction] = []
    risky: list[dict] = []

    for record in live:
        label = _risk_label(record["host"])
        if label:
            risky.append({**record, "matched": label})
            deductions.append(Deduction("surface.risk_host", note=record["host"]))
        if record.get("directory_listing"):
            deductions.append(
                Deduction("surface.directory_listing", note=record["host"])
            )
        if record["scheme"] == "http":
            deductions.append(Deduction("surface.plaintext_host", note=record["host"]))

    if total_found > SUBDOMAIN_SPRAWL_THRESHOLD:
        deductions.append(Deduction("surface.sprawl", note=f"{total_found} hostnames"))

    evidence = {
        "source": source,
        "hostnames_found": total_found,
        "probed": len(probe_list),
        "live": len(live),
        "risky_hosts": risky,
        "truncated": total_found > SUBDOMAIN_MAX_PROBES,
    }

    if not deductions:
        return CheckResult(
            id="subdomains", label="Public subdomains", status="pass",
            detail=(f"{len(live)} reachable, nothing exposed that shouldn't be"
                    if live else "Nothing publicly reachable beyond the main site"),
            evidence=evidence,
        )

    names = ", ".join(r["host"] for r in risky[:3])
    if risky:
        detail = (f"{len(risky)} host{'s' if len(risky) != 1 else ''} reachable "
                  f"that look internal — {names}")
    else:
        detail = f"{len(live)} reachable, with configuration issues"

    return CheckResult(
        id="subdomains", label="Public subdomains",
        status="fail" if risky else "warn",
        detail=detail, evidence=evidence, deductions=deductions,
    )
