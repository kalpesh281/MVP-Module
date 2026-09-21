"""The published methodology, served from the constants that do the work.

A rubric is only credible if anyone can check it, and a copy of it in a
document is a copy that drifts. Every number below is read from
`scoring/rubric.py`, `scoring/grades.py` and `scoring/pricing.py` at
request time, so the page a client reads and the table that scored them
cannot disagree. Change a point value and this endpoint changes with it.

docs/defending-the-score.md, docs/defending-the-premium.md
"""

from __future__ import annotations

from typing import Any

from .config import RATE_VERSION, RUBRIC_VERSION
from .scoring import grades, pricing, rubric

# Plain-language names for the eight scoring categories. The rubric keys
# are internal; these are what a founder reads.
CATEGORY_LABEL: dict[str, str] = {
    "dmarc": "DMARC policy",
    "spf": "SPF record",
    "dkim": "DKIM signing",
    "tls": "Certificate and HTTPS",
    "headers": "Security headers",
    "creds": "Breach history",
    "creds_accounts": "Employee account exposure",
    "subdomains": "Public attack surface",
}

# Why each category is weighted the way it is. The honest answer to "who
# decided 18 points?", stated per category rather than in the abstract.
CATEGORY_REASON: dict[str, str] = {
    "dmarc": "The heaviest single check. It is the only one of the three email "
             "records that decides what actually happens to a forged message, and "
             "business email compromise is among the most frequent and costly "
             "cyber claims.",
    "spf": "Names the servers allowed to send as you. Without it, invoice fraud "
           "against your customers is trivial to attempt.",
    "dkim": "Proves a message was not altered in transit, and gives DMARC "
            "something to verify against.",
    "tls": "Public, dated and visible to every customer. An underwriter reads a "
           "lapsed certificate as a signal about the parts they cannot see.",
    "headers": "The cheapest fixes on the list, which is why missing ones stand "
               "out. They measure whether anyone is maintaining the front end.",
    "creds": "A standard proposal-form question. Under insurance law a prior "
             "breach is a material fact, and answering it wrongly can affect a "
             "claim.",
    "creds_accounts": "Confirming exposure of individual employee accounts "
                      "requires you to verify the domain first, so at this tier "
                      "it is always inconclusive and its points leave the total.",
    "subdomains": "Carries the most points because a forgotten staging box or an "
                  "old admin panel is how a great many incidents actually begin — "
                  "and it is the finding companies are most often surprised by.",
}

# --- where every part of this came from ---------------------------------
#
# Served rather than written into the page, for the same reason the point
# values are: a provenance claim kept in a separate document is a claim
# that drifts away from what the code actually does.
#
# Three tiers, and the order is deliberate. The weakest material is shown
# last but it is shown, in the same list, in the same type. A methodology
# page that only lists its strong sources is marketing.
#
# Every URL here was checked to resolve. A dead link on the one page whose
# job is credibility costs more than the citation earns.
# docs/defending-the-score.md, docs/policy-wording-evidence.md

TIER_STANDARD = "standard"     # public specification; nothing rests on us
TIER_CHECKED = "checked"       # traced to a named document, reviewed internally
TIER_JUDGEMENT = "judgement"   # ours, published and version-controlled

PROVENANCE_REVIEWED = "20 September 2026"

TIER_META: dict[str, dict[str, str]] = {
    TIER_STANDARD: {
        "label": "Published standards",
        "blurb": "Independently verifiable. These are public specifications and "
                 "open methodologies; no part of this rests on our "
                 "interpretation.",
    },
    TIER_CHECKED: {
        "label": "Traced to source documents",
        "blurb": "Each statement maps to a named clause or dataset we can cite. "
                 "Reviewed internally; not yet validated by a broker or an "
                 "insurer.",
    },
    TIER_JUDGEMENT: {
        "label": "Our methodology",
        "blurb": "No public benchmark exists for these. Our figures are "
                 "published and version-controlled so that they can be "
                 "challenged and revised.",
    },
}

PROVENANCE: list[dict[str, Any]] = [
    {
        "id": "findings",
        "what": "Finding definitions",
        "tier": TIER_STANDARD,
        "detail": "Whether a record is valid is determined by published "
                  "specification, not by us. Every finding can be reproduced "
                  "independently.",
        "sources": [
            {"label": "RFC 7208 — SPF", "url": "https://www.rfc-editor.org/rfc/rfc7208"},
            {"label": "RFC 6376 — DKIM", "url": "https://www.rfc-editor.org/rfc/rfc6376"},
            {"label": "RFC 7489 — DMARC", "url": "https://www.rfc-editor.org/rfc/rfc7489"},
            {"label": "RFC 6962 — Certificate Transparency",
             "url": "https://www.rfc-editor.org/rfc/rfc6962"},
        ],
    },
    {
        "id": "method",
        "what": "Scoring methodology",
        "tier": TIER_STANDARD,
        "detail": "The deduct-from-100 model and the letter-band structure are "
                  "adopted from three established open methodologies. Our "
                  "contribution is the weighting, which is directed at "
                  "underwriting relevance rather than security posture.",
        "sources": [
            {"label": "Mozilla HTTP Observatory",
             "url": "https://developer.mozilla.org/en-US/observatory"},
            {"label": "Qualys SSL Labs Rating Guide",
             "url": "https://github.com/ssllabs/research/wiki/SSL-Server-Rating-Guide"},
            {"label": "Internet.nl", "url": "https://internet.nl/"},
        ],
    },
    {
        "id": "coverage",
        "what": "Coverage terms and exclusions",
        "tier": TIER_CHECKED,
        "detail": "Every statement regarding sublimits and exclusions is traced "
                  "to a clause in a filed Indian commercial cyber wording. Two "
                  "statements were found to be incorrect on review and were "
                  "corrected. This reflects a single insurer's wording.",
        "sources": [
            {"label": "Bajaj Cyber Protect Premium — UIN IRDAN113CP0002V02201516",
             "url": "https://www.bajajgeneralinsurance.com/download-documents/"
                    "commercial-insurance/bajaj-allianz-cyber-protect-digital-"
                    "business-data-protection-insurance/Cyber-Protect.pdf"},
        ],
    },
    {
        "id": "breach_cost",
        "what": "Incident cost benchmarks",
        "tier": TIER_CHECKED,
        "detail": "Claims data for organisations of comparable size. We "
                  "deliberately exclude the widely cited Rs 25 crore average "
                  "Indian breach figure: that study surveys large enterprises "
                  "and publishes no segmentation by organisation size, so "
                  "applying it to an SME would overstate the indicated cover by "
                  "approximately an order of magnitude.",
        "sources": [
            {"label": "NetDiligence Cyber Claims Study 2025",
             "url": "https://rsmus.com/content/dam/rsm/insights/services/"
                    "risk-fraud-cybersecurity/1pdf/net-diligence-cyber-claims-"
                    "study-2025-report.inline.pdf"},
        ],
    },
    {
        "id": "weights",
        "what": "Category weightings",
        "tier": TIER_JUDGEMENT,
        "detail": "No standard assigns a point value to DMARC. Our weightings "
                  "follow observed claim frequency and severity rather than "
                  "security-posture convention, which is why DMARC carries 18 "
                  "points and a missing CSP header carries 4. The weightings are "
                  "judgement; the findings beneath them are independently "
                  "verifiable.",
        "sources": [],
    },
    {
        "id": "premium",
        "what": "Premium estimates",
        "tier": TIER_JUDGEMENT,
        "detail": "Indicative only, and not a quotation. Not supplied or "
                  "endorsed by any insurer. The output has been checked against "
                  "the prevailing Indian market range for comparable "
                  "organisations. On receipt of an insurer's loss data the rate "
                  "card will be recalibrated, and because every scan is "
                  "version-stamped the full history can be re-scored against it.",
        "sources": [],
    },
]


def _rules_by_category() -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {key: [] for key in CATEGORY_LABEL}
    for rule_id, (points, category) in rubric.RULE_POINTS.items():
        grouped.setdefault(category, []).append({"id": rule_id, "deducts": points})
    for rules in grouped.values():
        # Worst first: the order a reader wants, and the order that makes
        # a zero-point rule read as "this is the passing case".
        rules.sort(key=lambda r: (-r["deducts"], r["id"]))
    return grouped


def payload() -> dict[str, Any]:
    """Everything needed to reproduce any score or premium we have shown."""
    rules = _rules_by_category()

    return {
        "rubric_version": RUBRIC_VERSION,
        "rate_version": RATE_VERSION,
        "total_points": sum(rubric.CHECK_POINTS.values()),
        "suppress_above_inconclusive": rubric.INCONCLUSIVE_SUPPRESS_ABOVE,
        "categories": [
            {
                "id": key,
                "label": CATEGORY_LABEL.get(key, key),
                "points": points,
                "reason": CATEGORY_REASON.get(key, ""),
                "always_inconclusive": rubric.ALWAYS_INCONCLUSIVE.get(key),
                "rules": rules.get(key, []),
            }
            for key, points in sorted(
                rubric.CHECK_POINTS.items(), key=lambda kv: -kv[1]
            )
        ],
        "provenance": {
            "reviewed": PROVENANCE_REVIEWED,
            "tiers": [
                {"id": tier, **TIER_META[tier],
                 "entries": [e for e in PROVENANCE if e["tier"] == tier]}
                for tier in (TIER_STANDARD, TIER_CHECKED, TIER_JUDGEMENT)
            ],
        },
        "grades": [
            {"grade": grade, "floor": floor, "summary": grades.GRADE_SUMMARY[grade]}
            for grade, floor in grades.BANDS
        ],
        "pricing": {
            "currency": pricing.CURRENCY,
            "bands": [
                {
                    "id": band,
                    "label": pricing.BAND_LABEL[band],
                    "cover": pricing.limit_for_band(band),
                    "cover_label": pricing.limit_label(pricing.limit_for_band(band)),
                    "by_grade": pricing.premium_table(band)["by_grade"],
                }
                for band in pricing.BASE_TABLE
            ],
            "inputs": ["your grade", "your revenue band"],
            "not_used": ["industry", "data types handled", "DPDP applicability"],
        },
    }
