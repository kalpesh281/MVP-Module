"""Premium estimation. Rate card v1.0.

**Every figure in this module is a placeholder.** They are informed guesses
at the Indian cyber market for a small SaaS company, not insurer-validated
rates. They must be replaced with a partner insurer's rates before anything
here is presented as a quote rather than an estimate.

That is not a disclaimer to bury. Every surface that renders these numbers
says "estimated", and `defending_the_score` gives the honest answer when a
client asks where they came from: judgment, to be calibrated.
docs/scoring-and-pricing.md section 4, docs/defending-the-score.md

Like the rubric, this is pure arithmetic over a published table. No model
is ever asked for a price.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from ..config import RATE_VERSION

RevenueBand = Literal["under_5cr", "5_25cr", "25_100cr"]

CURRENCY = "INR"

# The Tier 0 default limit, in rupees. ₹5 Cr.
DEFAULT_LIMIT = 50_000_000

# Annual premium in INR at the ₹5 Cr limit, before multipliers.
# An F is not priced: it is referred. Showing a number for a company most
# insurers would decline would be the one outright dishonest thing in the
# product.
BASE_TABLE: dict[RevenueBand, dict[str, tuple[int, int] | None]] = {
    "under_5cr": {
        "A": (45_000, 60_000),
        "B": (60_000, 85_000),
        "C": (85_000, 120_000),
        "D": (130_000, 180_000),
        "F": None,
    },
    "5_25cr": {
        "A": (70_000, 95_000),
        "B": (95_000, 130_000),
        "C": (140_000, 190_000),
        "D": (200_000, 280_000),
        "F": None,
    },
    "25_100cr": {
        "A": (120_000, 160_000),
        "B": (160_000, 220_000),
        "C": (230_000, 320_000),
        "D": (340_000, 450_000),
        "F": None,
    },
}

BAND_LABEL: dict[RevenueBand, str] = {
    "under_5cr": "under ₹5 Cr revenue",
    "5_25cr": "₹5–25 Cr revenue",
    "25_100cr": "₹25–100 Cr revenue",
}

# Limit (rupees) -> multiplier on the ₹5 Cr base.
LIMIT_MULTIPLIERS: dict[int, float] = {
    10_000_000: 0.45,     # ₹1 Cr
    20_000_000: 0.65,     # ₹2 Cr
    50_000_000: 1.00,     # ₹5 Cr — the base
    100_000_000: 1.55,    # ₹10 Cr
    250_000_000: 2.60,    # ₹25 Cr
}

# Tier 1+ only. Apply the single highest applicable multiplier, never a
# product of several — compounding them produces numbers no underwriter
# would recognise.
DATA_TYPE_MULTIPLIERS: dict[str, float] = {
    "PHI": 1.40,
    "payment_card": 1.30,
    "PII_large": 1.25,
    "B2B_only": 1.00,
}

# Headcount band from AI call 1 -> revenue band. The single largest source
# of Tier 0 imprecision, and exactly what the Tier 1 questions resolve.
# When classification fails entirely we assume the smallest band: quoting
# low and correcting upward at Tier 1 is recoverable; quoting high and
# losing the user at the first screen is not.
HEADCOUNT_TO_BAND: dict[str, RevenueBand] = {
    "1-10": "under_5cr",
    "11-50": "under_5cr",
    "51-200": "5_25cr",
    "200+": "25_100cr",
}
DEFAULT_BAND: RevenueBand = "under_5cr"


@dataclass(slots=True)
class Premium:
    low: int | None
    high: int | None
    currency: str = CURRENCY
    limit: int = DEFAULT_LIMIT
    referred: bool = False          # True for grade F — priced by a human

    @property
    def midpoint(self) -> int:
        if self.low is None or self.high is None:
            return 0
        return (self.low + self.high) // 2

    def as_dict(self) -> dict[str, Any]:
        return {
            "low": self.low,
            "high": self.high,
            "currency": self.currency,
            "limit": self.limit,
            "referred": self.referred,
        }


def band_for_headcount(headcount: str | None) -> RevenueBand:
    return HEADCOUNT_TO_BAND.get(headcount or "", DEFAULT_BAND)


def _round(amount: float) -> int:
    """To the nearest ₹500. A premium ending in 73 implies a precision we
    do not have, and invites a question we cannot answer."""
    return int(round(amount / 500.0) * 500)


def premium_for(
    grade: str | None,
    revenue_band: RevenueBand = DEFAULT_BAND,
    limit: int = DEFAULT_LIMIT,
    data_type: str | None = None,
) -> Premium:
    """Estimated annual premium. `data_type` is Tier 1+; omit it at Tier 0.

    A suppressed grade (too many inconclusive checks) prices as a referral
    rather than defaulting to something cheerful.
    """
    table = BASE_TABLE[revenue_band]
    if grade is None or table.get(grade) is None:
        return Premium(low=None, high=None, limit=limit, referred=True)

    low, high = table[grade]           # type: ignore[misc]
    multiplier = LIMIT_MULTIPLIERS.get(limit, 1.0)
    if data_type:
        multiplier *= DATA_TYPE_MULTIPLIERS.get(data_type, 1.0)

    return Premium(low=_round(low * multiplier), high=_round(high * multiplier), limit=limit)


def premium_table(
    revenue_band: RevenueBand = DEFAULT_BAND,
    limit: int = DEFAULT_LIMIT,
    data_type: str | None = None,
) -> dict[str, Any]:
    """Every grade priced at this band and limit.

    Shipped in the `result` payload so the fix simulator can reprice
    instantly in the browser with no network call. A spinner between
    "what if I fixed this" and the answer is where the insight dies.
    docs/frontend.md simulate.js
    """
    return {
        "revenue_band": revenue_band,
        "revenue_band_label": BAND_LABEL[revenue_band],
        "limit": limit,
        "currency": CURRENCY,
        "rate_version": RATE_VERSION,
        "by_grade": {
            g: (None if p.referred else {"low": p.low, "high": p.high})
            for g in ("A", "B", "C", "D", "F")
            for p in (premium_for(g, revenue_band, limit, data_type),)
        },
    }


def annual_saving(current: Premium, improved: Premium) -> int:
    """Midpoint-to-midpoint, floored at zero.

    Midpoints, not best-case-to-best-case: comparing the bottom of one band
    with the bottom of another overstates the saving, and this number is
    the one a founder repeats to their co-founder.
    """
    if current.referred or improved.referred:
        return 0
    return max(0, current.midpoint - improved.midpoint)
