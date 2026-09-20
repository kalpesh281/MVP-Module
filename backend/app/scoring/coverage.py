"""Module A — how much cover, and why.

The premium on the result page answers "what does it cost". It does not
answer "how much do I actually need", which is the question it immediately
provokes and the question a broker exists to answer. This module answers
it, deterministically.

Three rules, in order of importance:

1. **A contract requirement always wins.** It is the only driver grounded
   in fact rather than inference, and it is never stepped down. Everything
   else here is our recommendation; that one is their obligation.
2. **Never recommend more than the reasoning supports.** A limit is only
   recommended when the breach cost band for that company exceeds the next
   rung down. A recommendation that does not follow from its own stated
   reasoning is worse than no recommendation, because the reasoning is
   printed directly underneath it.
3. **Nothing here imports from `app.ai`.** The model writes the sentence
   under the number. It never picks the number.

Every rupee figure below is directional, not Indian loss data. Every
surface that renders them must carry "typically" or "estimated".

Sanity-checked 2026-09-20 against the only public numbers that exist for
our segment (docs/policy-wording-evidence.md section 5):

  NetDiligence 2025   small business average claim  $79,000  (~Rs 66 L)
                      SME average claim           $205,000  (~Rs 1.7 Cr)
  CERT-In / market    Indian SME ransomware demand  Rs 15-80 L, 16 days down

The bands below sit inside that range and were left unchanged.

DO NOT raise them to IBM's India figure (Rs 22 Cr in 2025, Rs 25.5 Cr in
2026). It is the number every article quotes and it is the wrong tool
here: that study surveys large organisations and publishes no breakdown by
size, so applying it to a twenty-person SaaS over-recommends cover by an
order of magnitude on a citation that looks authoritative. Written down
because the mistake is tempting.
docs/coverage-guidance.md Module A
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from .pricing import LIMIT_MULTIPLIERS, RevenueBand, limit_label, premium_for, premium_table

Driver = Literal[
    "contract",
    "sensitive_data",
    "financial_data",
    "pii_at_scale",
    "pii",
    "headcount",
    "baseline",
]

# --- the limit ladder ----------------------------------------------------
#
# Deliberately the same keys as pricing.LIMIT_MULTIPLIERS. A rung that has
# no multiplier cannot be priced, and an unpriceable option in a selector
# is a radio button that does nothing.
LADDER: list[int] = sorted(LIMIT_MULTIPLIERS)

# Sizes at which a company stops being small for the purposes of the
# driver hierarchy. `500+` did not exist when the spec was written and is
# included here because it obviously belongs — a 700-person company must
# not fall through to `baseline`.
_LARGE_BANDS = {"51-200", "200+", "500+"}


def options_for(recommended: int) -> list[int]:
    """The recommended rung, plus the one below and the one above.

    Shifted inward at the ends so three options always render. Without the
    clamp the `baseline` driver (₹2 Cr, the second rung) would show only
    two, and a selector that changes shape by company reads as broken.
    """
    if recommended not in LADDER:
        recommended = min(LADDER, key=lambda rung: abs(rung - recommended))
    index = LADDER.index(recommended)
    index = max(1, min(index, len(LADDER) - 2))
    return LADDER[index - 1: index + 2]


# --- breach cost bands — PLACEHOLDER -------------------------------------
#
# Total cost of an incident once notification, forensics, legal and
# regulatory response are counted. Used ONLY to justify the recommendation
# in prose and to enforce rule 2 above. Never priced on.
BREACH_COST: dict[str, tuple[int, int]] = {
    "1-10":    (4_000_000,  12_000_000),    # ₹40 L – 1.2 Cr
    "11-50":   (10_000_000, 30_000_000),    # ₹1 – 3 Cr
    "51-200":  (20_000_000, 60_000_000),    # ₹2 – 6 Cr
    "200+":    (50_000_000, 150_000_000),   # ₹5 – 15 Cr
    "500+":    (100_000_000, 300_000_000),  # ₹10 – 30 Cr
}
_DEFAULT_COST_BAND = BREACH_COST["11-50"]

# Applied one at a time, highest only — never compounded. The same rule as
# pricing.DATA_TYPE_MULTIPLIERS, for the same reason: a product of three
# multipliers produces a figure no underwriter would recognise.
#
# Consumer PII above 100k records carries a ×1.5 in the spec. It is absent
# here on purpose: record counts are not observable from outside, and this
# module may not guess at one. It belongs at Tier 1, where the user states it.
COST_MULTIPLIERS: dict[str, float] = {
    "PHI": 2.0,
    "payment_card": 1.6,
}


def breach_cost_band(size_band: str | None, data_types: list[str] | None = None) -> tuple[int, int]:
    low, high = BREACH_COST.get(size_band or "", _DEFAULT_COST_BAND)
    multiplier = max(
        (COST_MULTIPLIERS[d] for d in (data_types or []) if d in COST_MULTIPLIERS),
        default=1.0,
    )
    return int(low * multiplier), int(high * multiplier)


# --- the driver hierarchy ------------------------------------------------

@dataclass(slots=True)
class Recommendation:
    limit: int
    driver: Driver
    source: str | None = None          # the clause reference, for `contract`
    stepped_down_from: int | None = None


def _select(data_types: set[str], size_band: str | None) -> Recommendation:
    """The worst applicable driver sets the floor. Order is the whole rule."""
    if data_types & {"PHI", "payment_card"}:
        return Recommendation(100_000_000, "sensitive_data")
    if "financial" in data_types:
        return Recommendation(100_000_000, "financial_data")
    if "PII" in data_types and size_band in _LARGE_BANDS:
        return Recommendation(100_000_000, "pii_at_scale")
    if "PII" in data_types:
        return Recommendation(50_000_000, "pii")
    if size_band in _LARGE_BANDS:
        return Recommendation(50_000_000, "headcount")
    return Recommendation(20_000_000, "baseline")


def recommend_limit(
    profile: Any | None = None,
    contract_req: dict[str, Any] | None = None,
) -> Recommendation:
    """Pick a cover amount. `profile` may be None — AI call 1 can fail.

    With no profile we fall through to `baseline`, which is the smallest
    recommendation the hierarchy can make. Recommending high on no
    evidence would be the one place this module could be accused of
    selling rather than advising.
    """
    if contract_req and contract_req.get("cyber_limit"):
        # Never stepped down and never second-guessed. If their MSA says
        # ₹5 Cr, ₹5 Cr is the answer regardless of what we would advise.
        return Recommendation(
            limit=int(contract_req["cyber_limit"]),
            driver="contract",
            source=contract_req.get("clause_reference"),
        )

    data_types = set(getattr(profile, "data_types_handled", None) or [])
    size_band = getattr(profile, "estimated_size_band", None)
    chosen = _select(data_types, size_band)

    # Rule 2. The recommendation must clear the rung below it on the
    # company's own cost band, or it is not a recommendation — it is a
    # number with a paragraph under it that contradicts it.
    low, high = breach_cost_band(size_band, sorted(data_types))
    while chosen.limit > LADDER[0]:
        next_down = LADDER[LADDER.index(chosen.limit) - 1]
        if high > next_down:
            break
        chosen = Recommendation(
            limit=next_down,
            driver=chosen.driver,
            stepped_down_from=chosen.stepped_down_from or chosen.limit,
        )
    return chosen


# --- the payload ---------------------------------------------------------

def build(
    grade: str | None,
    revenue_band: RevenueBand,
    profile: Any | None = None,
    contract_req: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Everything Module A renders, priced, in one dict.

    All three options ship with their premiums so the selector re-prices
    in the browser with no request in flight — the same pattern as the fix
    simulator, for the same reason: a spinner between "what if" and the
    answer is where the insight dies.
    """
    recommended = recommend_limit(profile, contract_req)
    size_band = getattr(profile, "estimated_size_band", None)
    data_types = sorted(set(getattr(profile, "data_types_handled", None) or []))
    low, high = breach_cost_band(size_band, data_types)

    options = []
    for rung in options_for(recommended.limit):
        premium = premium_for(grade, revenue_band, rung)
        option: dict[str, Any] = {
            "limit": rung,
            "limit_label": limit_label(rung),
            "premium": None if premium.referred else {"low": premium.low, "high": premium.high},
            # Every grade priced at this rung, not just the current one.
            #
            # Without it the limit selector and the fix simulator would
            # disagree the moment both were used: pick ₹2 Cr, then tick
            # DMARC, and the headline premium would jump back to the
            # recommended limit's price for the new grade. Two different
            # premiums on one screen, and no way for the reader to tell
            # which one is theirs.
            #
            # Fifteen numbers. It buys instant repricing across both
            # controls with no request in flight.
            "by_grade": premium_table(revenue_band, rung)["by_grade"],
        }
        if rung == recommended.limit:
            option["recommended"] = True
        options.append(option)

    return {
        "recommended_limit": recommended.limit,
        "recommended_limit_label": limit_label(recommended.limit),
        "driver": recommended.driver,
        "source": recommended.source,
        "stepped_down_from": recommended.stepped_down_from,
        "options": options,
        "breach_cost_band": {"low": low, "high": high},
        "size_band": size_band,
        "data_types": data_types,
    }
