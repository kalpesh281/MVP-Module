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
