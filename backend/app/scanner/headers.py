"""Security headers — 12 of the 100 points.

One ordinary GET to the homepage, following up to three redirects. Exactly
what a browser does on a first visit.

This check earns its keep twice: the headers are 12 points, and the HTML it
returns is the input to AI call 1, which classifies what the company does
and what data it holds. That classification drives the revenue band, the
coverage recommendation and the claim scenario — so a failure here costs
more than 12 points.
"""

from __future__ import annotations

import re

import httpx

from ..config import USER_AGENT
from .base import CheckResult, Deduction

# Headers we grade, in the order they appear to the user.
# `X-XSS-Protection` is deliberately absent: it is deprecated, browsers
# ignore it, and reporting it signals a tool that has not been maintained.
_GRADED = (
    ("strict-transport-security", "hdr.no_hsts", "HSTS"),
    ("content-security-policy", "hdr.no_csp", "CSP"),
    ("x-frame-options", "hdr.no_framing_protection", "clickjacking protection"),
    ("x-content-type-options", "hdr.no_nosniff", "MIME-sniffing protection"),
)

# Server software that identifies itself in a response header. Not scored —
# it feeds the AI classifier and, later, version-based checks at Tier 2.
_FINGERPRINT_HEADERS = ("server", "x-powered-by", "x-aspnet-version",
                        "x-generator", "x-drupal-cache", "x-shopify-stage")

_TITLE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_META_DESC = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']',
    re.IGNORECASE | re.DOTALL,
)

# Enough of the homepage for a model to work out what the company does.
# 50K characters is roughly 12K tokens — well inside every model's window
# and small enough that the classify call stays cheap.
_HTML_BUDGET = 50_000


def _has_framing_protection(headers: httpx.Headers) -> bool:
    """X-Frame-Options, or a CSP that sets frame-ancestors.

    A modern site may legitimately drop X-Frame-Options entirely and rely
    on CSP. Scoring that as a failure would punish the better configuration.
    """
    if "x-frame-options" in headers:
        return True
    csp = headers.get("content-security-policy", "").lower()
    return "frame-ancestors" in csp


async def run(domain: str) -> CheckResult:
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            max_redirects=3,
            timeout=6.0,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            response = await client.get(f"https://{domain}/")
    except httpx.TimeoutException:
        return CheckResult.inconclusive("headers", "Site did not respond in time",
                                        "Security headers")
    except Exception as exc:
        return CheckResult.inconclusive("headers", f"Could not reach the site: {exc}",
                                        "Security headers")

    headers = response.headers
    present: list[str] = []
    missing: list[str] = []
    deductions: list[Deduction] = []

    for name, rule, label in _GRADED:
        ok = _has_framing_protection(headers) if rule == "hdr.no_framing_protection" \
            else name in headers
        if ok:
            present.append(label)
        else:
            missing.append(label)
            deductions.append(Deduction(rule))

    evidence = {
        "final_url": str(response.url),
        "status_code": response.status_code,
        "present": present,
        "missing": missing,
        "fingerprint": {
            key: headers[key] for key in _FINGERPRINT_HEADERS if key in headers
        },
    }

    body = response.text or ""
    title = _TITLE.search(body)
    description = _META_DESC.search(body)

    if not missing:
        status, detail = "pass", "All four security headers are set"
    elif len(missing) == len(_GRADED):
        status, detail = "fail", "No security headers are set"
    else:
        status = "warn" if len(missing) < 3 else "fail"
        detail = f"Missing {', '.join(missing)}"

    return CheckResult(
        id="headers", label="Security headers", status=status, detail=detail,
        evidence=evidence, deductions=deductions,
        # Never serialised to the client — this is the classify-call input.
        extra={
            "html": body[:_HTML_BUDGET],
            "title": (title.group(1).strip()[:200] if title else ""),
            "description": (description.group(1).strip()[:400] if description else ""),
            "fingerprint": evidence["fingerprint"],
            "final_url": str(response.url),
        },
    )
