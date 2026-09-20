"""SPF, DKIM and DMARC — 30 of the 100 points.

The highest-signal check in the product. Absence of an enforcing DMARC
policy means anyone can send email that appears to come from the domain,
which is the entry point for business email compromise — among the most
frequent and most expensive cyber claim types.

Pure DNS. Nothing here touches the target's infrastructure.
"""

from __future__ import annotations

import asyncio

import dns.asyncresolver
import dns.exception
import dns.resolver

from ..config import DKIM_SELECTORS, PUBLIC_RESOLVERS, SPF_MAX_LOOKUPS
from .base import CheckResult, Deduction

# Mechanisms that cause a receiver to make a further DNS query.
# RFC 7208 section 4.6.4 caps the total at 10.
_LOOKUP_MECHANISMS = ("include:", "a", "mx", "ptr", "exists:", "redirect=")


async def _txt(name: str, timeout: float = 2.5, soft: bool = False) -> list[str]:
    """Return TXT records at `name`, or [] if there are none.

    A missing record and a missing name are the same answer for our
    purposes, so both give [].

    `soft=True` also swallows timeouts and resolver errors. Use it for
    *secondary* lookups — nested SPF includes, DKIM selector probes — where
    failing to reach one third-party nameserver says nothing about the
    domain we are grading. Primary lookups leave it False so a timeout
    propagates and the check becomes `inconclusive`, which removes its
    points from the denominator rather than scoring it zero.
    """
    last: Exception | None = None

    # Try the system resolver first, then public ones. Consumer routers and
    # some cloud resolvers truncate or drop large TXT responses, which would
    # otherwise mark a perfectly healthy domain `inconclusive`.
    for nameservers in (None, PUBLIC_RESOLVERS):
        resolver = dns.asyncresolver.Resolver()
        resolver.lifetime = timeout
        if nameservers:
            resolver.nameservers = list(nameservers)
        try:
            answers = await resolver.resolve(name, "TXT")
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return []                      # authoritative "there is nothing here"
        except Exception as exc:
            last = exc
            continue
        return ["".join(part.decode() for part in rdata.strings) for rdata in answers]

    if soft:
        return []
    raise last if last else dns.exception.Timeout()


# --------------------------------------------------------------------------
# SPF
# --------------------------------------------------------------------------

async def _count_spf_lookups(record: str, depth: int = 0, seen: set[str] | None = None) -> int:
    """Count DNS-querying mechanisms, recursing into `include:` and `redirect=`.

    Bounded at depth 3 and 15 distinct includes. A domain that exceeds the
    RFC limit is already broken; we only need to know *that*, not the exact
    total, so an approximation with hard bounds is the right trade.
    """
    seen = seen if seen is not None else set()
    if depth > 3 or len(seen) > 15:
        return 0

    count = 0
    for term in record.split():
        lowered = term.lower().lstrip("+-~?")

        if lowered.startswith(("include:", "redirect=")):
            count += 1
            target = term.split(":", 1)[-1].split("=", 1)[-1].strip()
            if target and target not in seen:
                seen.add(target)
                for nested in await _txt(target, timeout=1.5, soft=True):
                    if nested.lower().startswith("v=spf1"):
                        count += await _count_spf_lookups(nested, depth + 1, seen)
                        break
        elif lowered.startswith(("a:", "mx:", "exists:")) or lowered in ("a", "mx", "ptr"):
            count += 1

    return count


async def _check_spf(domain: str) -> CheckResult:
    records = [r for r in await _txt(domain) if r.lower().startswith("v=spf1")]

    if not records:
        return CheckResult(
            id="spf", label="SPF record", status="fail",
            detail="No SPF record found",
            evidence={"lookup": domain, "record": None},
            deductions=[Deduction("spf.absent")],
        )

    if len(records) > 1:
        # Multiple SPF records are invalid per RFC 7208 — receivers must
        # treat it as permerror, so the domain is effectively unprotected.
        return CheckResult(
            id="spf", label="SPF record", status="fail",
            detail=f"{len(records)} SPF records found — that makes all of them invalid",
            evidence={"lookup": domain, "records": records},
            deductions=[Deduction("spf.absent", note="multiple records")],
        )

    record = records[0]
    lookups = await _count_spf_lookups(record)
    evidence = {"lookup": domain, "record": record, "dns_lookups": lookups}

    deductions: list[Deduction] = []
    if lookups > SPF_MAX_LOOKUPS:
        deductions.append(Deduction("spf.lookup_overflow", note=f"{lookups} lookups"))

    tail = record.split()[-1].lower() if record.split() else ""

    if tail.endswith("all"):
        qualifier = tail[0] if tail[0] in "+-~?" else "+"
    else:
        qualifier = None

    if qualifier == "-":
        status, detail, rule = "pass", "Configured and enforcing (-all)", None
    elif qualifier == "~":
        status, detail, rule = "warn", "Configured but only soft-fails (~all)", "spf.softfail"
    elif qualifier in ("?", "+"):
        status, detail, rule = "fail", f"Permissive — anything passes ({qualifier}all)", "spf.permissive"
    else:
        status, detail, rule = "warn", "No all mechanism — the record does nothing", "spf.permissive"

    if rule:
        deductions.append(Deduction(rule))
    if lookups > SPF_MAX_LOOKUPS:
        status = "fail"
        detail += f" · {lookups} DNS lookups, over the limit of {SPF_MAX_LOOKUPS}"

    return CheckResult(id="spf", label="SPF record", status=status, detail=detail,
                       evidence=evidence, deductions=deductions)


# --------------------------------------------------------------------------
# DKIM
# --------------------------------------------------------------------------

async def _check_dkim(domain: str) -> CheckResult:
    """Probe common selectors.

    Absence is reported as `warn`, never `fail`. A custom selector we cannot
    enumerate may well exist, and claiming a failure we cannot prove is the
    fastest way to lose an argument with a competent CTO.
    """
    selectors = list(DKIM_SELECTORS)
    results = await asyncio.gather(
        *(_txt(f"{s}._domainkey.{domain}", timeout=2.0, soft=True) for s in selectors),
        return_exceptions=True,
    )

    found = [
        selector
        for selector, records in zip(selectors, results)
        if isinstance(records, list) and any("p=" in r for r in records)
    ]

    if found:
        return CheckResult(
            id="dkim", label="DKIM signing", status="pass",
            detail=f"Configured (selector: {found[0]})",
            evidence={"selectors_found": found, "selectors_probed": selectors},
        )

    return CheckResult(
        id="dkim", label="DKIM signing", status="warn",
        detail="Not found at any common selector — a custom one may exist",
        evidence={"selectors_found": [], "selectors_probed": selectors},
        deductions=[Deduction("dkim.not_found")],
    )


# --------------------------------------------------------------------------
# DMARC
# --------------------------------------------------------------------------

def _parse_dmarc(record: str) -> dict[str, str]:
    tags: dict[str, str] = {}
    for part in record.split(";"):
        if "=" in part:
            key, _, value = part.partition("=")
            tags[key.strip().lower()] = value.strip()
    return tags


async def _check_dmarc(domain: str) -> CheckResult:
    lookup = f"_dmarc.{domain}"
    records = [r for r in await _txt(lookup) if r.lower().startswith("v=dmarc1")]

    if not records:
        return CheckResult(
            id="dmarc", label="DMARC policy", status="fail",
            detail="No DMARC record found",
            evidence={"lookup": lookup, "record": None},
            deductions=[Deduction("dmarc.absent")],
        )

    record = records[0]
    tags = _parse_dmarc(record)
    policy = tags.get("p", "").lower()
    has_reporting = bool(tags.get("rua"))

    # pct= applies the policy to only a sample of mail. p=reject; pct=20
    # blocks one spoofed message in five — closer to monitoring than to
    # enforcement, so treat it as one step weaker than it claims to be.
    try:
        pct = int(tags.get("pct", "100"))
    except ValueError:
        pct = 100

    evidence = {"lookup": lookup, "record": record, "policy": policy,
                "reporting": has_reporting, "pct": pct}

    if pct < 100 and policy in ("reject", "quarantine"):
        weaker = {"reject": "quarantine", "quarantine": "none"}[policy]
        evidence["effective_policy"] = weaker
        evidence["downgraded_for_pct"] = True
        policy = weaker

    if policy == "reject" and has_reporting:
        return CheckResult(id="dmarc", label="DMARC policy", status="pass",
                           detail="Enforcing (p=reject) with reporting", evidence=evidence)

    if policy == "reject":
        return CheckResult(
            id="dmarc", label="DMARC policy", status="warn",
            detail="Enforcing (p=reject) but no reporting address — you're blind to failures",
            evidence=evidence, deductions=[Deduction("dmarc.reject_no_reporting")],
        )

    if policy == "quarantine":
        detail = "Set to quarantine — spoofed mail lands in spam, not blocked"
        if evidence.get("downgraded_for_pct"):
            detail = (f"Says reject, but only applies to {pct}% of mail — "
                      f"the rest is unprotected")
        return CheckResult(
            id="dmarc", label="DMARC policy", status="warn", detail=detail,
            evidence=evidence, deductions=[Deduction("dmarc.quarantine")],
        )

    if policy == "none":
        detail = "Monitoring only (p=none) — nothing is actually blocked"
        if evidence.get("downgraded_for_pct"):
            detail = (f"Only applies to {pct}% of mail — most spoofed email "
                      f"still gets through")
        return CheckResult(
            id="dmarc", label="DMARC policy", status="fail", detail=detail,
            evidence=evidence, deductions=[Deduction("dmarc.monitor_only")],
        )

    return CheckResult(
        id="dmarc", label="DMARC policy", status="fail",
        detail="Record present but has no usable policy",
        evidence=evidence, deductions=[Deduction("dmarc.absent", note="no p= tag")],
    )


# --------------------------------------------------------------------------

async def run(domain: str) -> list[CheckResult]:
    """Return three CheckResults: spf, dkim, dmarc.

    One module, three scoring keys. The runner fans them into the queue
    individually so each renders as its own row in the check feed.
    """
    labels = {"spf": "SPF record", "dkim": "DKIM signing", "dmarc": "DMARC policy"}
    outcomes = await asyncio.gather(
        _check_spf(domain), _check_dkim(domain), _check_dmarc(domain),
        return_exceptions=True,
    )

    results: list[CheckResult] = []
    for check_id, outcome in zip(("spf", "dkim", "dmarc"), outcomes):
        if isinstance(outcome, CheckResult):
            results.append(outcome)
        else:
            # One resolver failure must not take the other two rows with it.
            results.append(CheckResult.inconclusive(
                check_id, _why(outcome), label=labels[check_id]))
    return results


def _why(exc: BaseException) -> str:
    """A resolver message a user can read, not a stack trace."""
    if isinstance(exc, dns.exception.Timeout):
        return "DNS lookup timed out"
    if isinstance(exc, dns.resolver.NoNameservers):
        return "No nameserver answered"
    return "Could not read DNS records"
