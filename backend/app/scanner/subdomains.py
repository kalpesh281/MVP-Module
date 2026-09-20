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
    CERTSPOTTER_API_KEY,
    SUBDOMAIN_MAX_PROBES,
    SUBDOMAIN_PROBE_CONCURRENCY,
    SUBDOMAIN_RISK_PATTERNS,
    SUBDOMAIN_SPRAWL_THRESHOLD,
    USER_AGENT,
)
from .base import CheckResult, Deduction

_CRTSH = "https://crt.sh/"
_CERTSPOTTER = "https://api.certspotter.com/v1/issuances"

# Measured 2026-09-20 across six Indian SaaS domains, run back to back:
#
#   crt.sh        1/6 succeeded, 3.6-8.5s, ReadTimeout or 502 otherwise
#   certspotter   6/6 succeeded, 1.2-2.6s
#
# Cert Spotter is the SCORING SOURCE. crt.sh is a fallback, used only when
# Cert Spotter returns nothing, and never merged into a successful result.
#
# It used to be a race: both issued together, whatever answered inside a
# 5s wall was unioned, and the grade followed. crt.sh answers in 3.8-8.5s
# and Cert Spotter in 1.2-2.6s, so crt.sh made the deadline perhaps one
# time in six — and when it did it contributed far more hosts (717 rows
# for zerodha.com against Cert Spotter's 39). perseus.de scored D (45) on
# one run and B (72) an hour later for exactly this reason, with nothing
# about the company having changed.
#
# A grade that depends on which server answered first is not a grade. So
# one source scores, and the other only covers its absence — which is
# recorded on the finding, because a result from the fallback is not the
# same measurement and must not silently look like one.
#
# The honest cost: Cert Spotter on the free tier cannot enumerate a large
# domain. Deep pagination trips its burst limit and 429s partway through
# (measured), so `truncated` is a real state and is reported rather than
# hidden. Neither source is authoritative anyway — a CT log records
# certificates, not hosts — so this is always a lower bound. We say
# "publicly visible" rather than "all" for that reason.
_CERTSPOTTER_TIMEOUT = 6.0
_CERTSPOTTER_PAGES = 2          # at most; a short page ends it early
_CERTSPOTTER_PAGE_SIZE = 100    # the API's page size, used to spot the last page

# The two phases of this check, both bounded, both inside
# TIMEOUTS['subdomains'] with room to spare.
# 6.5 + 7.5 = 14.0, inside TIMEOUTS['subdomains'] = 15.0 with a second of
# slack for the client setup and the scoring that follows.
#
# The CT half was 5.0s, which was sized when both sources were merged and
# Cert Spotter almost always answered first. Now that crt.sh is the sole
# fallback it has to be able to finish: measured at exactly 5.0s for
# cowbellcyber.ai, it was being cancelled on the wall a fraction before
# returning, so a Cert Spotter 429 took the whole check to `inconclusive`
# — and 23 inconclusive points on top of the 12 we always carry suppress
# the grade entirely. A working fallback that is never waited for is not
# a fallback.
_CT_BUDGET = 6.5        # certificate transparency lookups
_PROBE_BUDGET = 7.5     # the live-host sweep that follows
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

# Domains whose Cert Spotter enumeration stopped short — our page cap or
# their burst limit. Reported on the finding, never silently ignored.
_truncated: set[str] = set()

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


async def _from_certspotter(domain: str, client: httpx.AsyncClient) -> set[str]:
    """Hostnames from SSLMate's Cert Spotter. Faster and far more reliable
    than crt.sh, but paginated at 100 issuances a page, so we take two
    pages and stop."""
    hosts: set[str] = set()
    after: str | None = None
    # A 429 here is not a transient failure — the quota stays exhausted for
    # the rest of the hour. Measured 2026-09-20 on a free keyed account:
    # 100 requests/hour, over a smaller burst bucket that drains in a few
    # rapid calls and refills on its own. The short-page break below keeps
    # a normal scan to one request, which stays clear of both.

    for page in range(_CERTSPOTTER_PAGES):
        params: dict[str, str] = {
            "domain": domain,
            "include_subdomains": "true",
            "expand": "dns_names",
        }
        if after:
            params["after"] = after
        headers = ({"Authorization": f"Bearer {CERTSPOTTER_API_KEY}"}
                   if CERTSPOTTER_API_KEY else None)
        response = await client.get(_CERTSPOTTER, params=params,
                                    headers=headers,
                                    timeout=_CERTSPOTTER_TIMEOUT)
        if response.status_code == 429 and hosts:
            # The burst bucket ran out partway through. Keep the pages we
            # already have and say the list is short, rather than throwing
            # away a good first page and falling back to a different
            # source — which is the swap that moved the grade.
            _truncated.add(domain)
            break
        response.raise_for_status()
        rows = response.json()
        if not rows:
            break
        for row in rows:
            for raw in row.get("dns_names", ()):
                name = _clean_san(raw)
                if name and name.endswith(f".{domain}"):
                    hosts.add(name)
        # A short page is the last page. Without this we spend a second
        # request discovering that page two is empty — and at 10 requests
        # an hour that doubles the cost of every scan for nothing.
        if len(rows) < _CERTSPOTTER_PAGE_SIZE:
            break
        if page == _CERTSPOTTER_PAGES - 1:
            # Hit our own page cap with more still to come.
            _truncated.add(domain)
        after = str(rows[-1].get("id", "")) or None
        if after is None:
            break
    return hosts


async def _from_ct(domain: str, client: httpx.AsyncClient) -> tuple[set[str], str, bool]:
    """Hostnames from certificate transparency.

    Returns (hostnames, source, degraded).

    **Cert Spotter scores. crt.sh only covers its absence.** Both are still
    issued together — waiting for Cert Spotter to fail before starting an
    8-second crt.sh request would blow the check's budget — but the result
    is chosen by policy, not by whichever finished first:

        Cert Spotter answered  ->  use it, degraded=False
        it did not             ->  use crt.sh, degraded=True
        neither                ->  raise

    The two are never merged. Merging is what made the grade depend on a
    race, because crt.sh makes the deadline about one time in six and
    contributes an order of magnitude more hosts when it does.
    """
    primary = asyncio.create_task(_from_certspotter(domain, client))
    backup = asyncio.create_task(_from_crtsh(domain, client))
    jobs = {primary: "Cert Spotter", backup: "crt.sh"}

    # A shared budget, not the sum of two. crt.sh times out at 8s on most
    # requests; waiting the full 8s for it after Cert Spotter has already
    # answered in 1.5s left no room for the host sweep that follows.
    done, pending = await asyncio.wait(jobs, timeout=_CT_BUDGET)
    for task in pending:
        task.cancel()
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)

    failed: list[str] = [f"{jobs[t]}: no answer in {_CT_BUDGET:.0f}s" for t in pending]

    def outcome(task: asyncio.Task) -> set[str] | None:
        if task not in done:
            return None
        exc = task.exception()
        if exc is not None:
            reason = type(exc).__name__
            if isinstance(exc, httpx.HTTPStatusError):
                reason = f"HTTP {exc.response.status_code}"
            failed.append(f"{jobs[task]}: {reason}")
            return None
        return task.result()

    from_primary = outcome(primary)
    from_backup = outcome(backup)

    # `is not None`, not truthiness. An empty set is an answer: a company
    # whose only certificate is a wildcard names no host, and that is a
    # real finding. Treating it as a failure sent those companies to the
    # other source and scored them on a different measurement — the exact
    # swap this function exists to prevent.
    if from_primary is not None:
        return from_primary, "Cert Spotter", False
    if from_backup is not None:
        # A different measurement, not a worse one. Said out loud on the
        # finding so a grade produced this way is identifiable.
        return from_backup, "crt.sh", True

    raise RuntimeError("; ".join(failed))


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
        degraded = False
        try:
            from_ct, used, degraded = await _from_ct(domain, client)
            candidates |= from_ct
            source = used if from_ct else source
        except Exception as exc:
            # Both CT sources failed. Fall through to the certificate SANs
            # we already have — and if those are empty too (a wildcard
            # certificate names no host), say so rather than reporting a
            # clean surface we never actually looked at.
            if not candidates:
                return CheckResult.inconclusive(
                    "subdomains",
                    f"Certificate transparency logs unavailable ({exc})",
                    "Public subdomains",
                )
            source = f"certificate SANs (CT unavailable: {exc})"

        total_found = len(candidates)

        # Probe the risky-looking hosts first: if we hit the cap, we want
        # to have spent the budget where a finding might actually be.
        ordered = sorted(candidates, key=lambda h: (_risk_label(h) is None, h))
        probe_list = ordered[:SUBDOMAIN_MAX_PROBES]

        # Cap in-flight requests. Forty simultaneous TLS handshakes from
        # one process starves them all and turns healthy hosts into
        # timeouts — which is how the plaintext false positives happened.
        gate = asyncio.Semaphore(SUBDOMAIN_PROBE_CONCURRENCY)
        tasks = [asyncio.create_task(_probe(h, client, gate)) for h in probe_list]

        # asyncio.wait raises on an empty set. This is not a hypothetical:
        # a company whose only certificate is a wildcard contributes no
        # hostnames at all, and _clean_san drops wildcards on purpose.
        if not tasks:
            results, probed, swept_all = [], 0, True
        else:
            # The sweep gets its own wall-clock budget and we keep whatever
            # finished inside it. Letting it run unbounded is what pushed
            # the whole check past the runner's timeout on a company with
            # 200+ hostnames — and the runner then threw away every host we
            # had already confirmed. A partial sweep is a real finding; a
            # timeout is nothing at all.
            done, pending = await asyncio.wait(tasks, timeout=_PROBE_BUDGET)
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
            results = [t.result() for t in done
                       if not t.cancelled() and t.exception() is None]
            probed, swept_all = len(done), not pending

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
        # True when the scoring source was unavailable and this came from
        # the fallback instead. A different measurement, recorded rather
        # than blended in, so two scans of one domain that disagree can be
        # told apart afterwards instead of looking like the company moved.
        "source_degraded": degraded,
        "hostnames_found": total_found,
        "probed": probed,
        "sweep_complete": swept_all,
        "live": len(live),
        "risky_hosts": risky,
        # Either we stopped probing, or the enumeration itself stopped
        # short. Both mean the host list is a floor, not a census.
        "truncated": total_found > SUBDOMAIN_MAX_PROBES or domain in _truncated,
        "enumeration_complete": domain not in _truncated,
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
    elif live:
        detail = f"{len(live)} reachable, with configuration issues"
    else:
        # Sprawl is counted from hostnames on record, not from live hosts,
        # so it can fire when nothing answered a probe. "0 reachable, with
        # configuration issues" is then both confusing and wrong — it
        # sounds like a fault in something that is not there.
        detail = (f"{total_found} public hostnames on record — more than most "
                  f"teams are tracking")

    return CheckResult(
        id="subdomains", label="Public subdomains",
        status="fail" if risky else "warn",
        detail=detail, evidence=evidence, deductions=deductions,
    )
