"""Rubric v1.0 — the rule-to-points table and the scoring arithmetic.

This module is the whole reason the product is defensible. Everything a
user sees as a number originates here, from a table anyone can read.

Three hard rules, in order of importance:

1. **Nothing in `app.scoring` may import from `app.ai`.** A score must be
   reproducible from `findings` + `rubric_version` alone. If a model is
   anywhere in this path, it is not reproducible and no insurer will grant
   delegated authority over it. docs/scoring-and-pricing.md principle
2. **Checks name rules; this module owns the points.** A `Deduction`
   carries a rule string and nothing else, so a check can never drift from
   the published rubric by inventing its own number.
3. **An inconclusive check leaves the denominator.** It is never scored as
   zero deductions. We do not grade a company well because our own scanner
   failed to run.

The authoritative source for every number below is
docs/scoring-and-pricing.md section 1. If the two disagree, the document
wins and this file is the bug.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Iterable

from ..config import RUBRIC_VERSION

# --- what each check is worth -------------------------------------------
#
# The keys are CheckResult ids. The values must sum to exactly 100 — the
# test at the bottom of this module's test file asserts it, because a
# rubric that sums to 90 silently inflates every score by 11%.
#
# `creds_accounts` is the one entry with no check behind it at Tier 0.
# See the note on ALWAYS_INCONCLUSIVE below.
CHECK_POINTS: dict[str, int] = {
    "dmarc": 18,
    "spf": 7,
    "dkim": 5,
    "creds": 8,             # breach history — free, keyless
    "creds_accounts": 12,   # account exposure — needs a key AND ownership proof
    "tls": 15,
    "headers": 12,
    "subdomains": 23,
}

# Checks that cannot run at Tier 0 and must be counted as inconclusive even
# though no scanner produced a result for them.
#
# Account exposure needs the paid HIBP `/breacheddomain/` endpoint, which
# requires proof that you control the domain. We are scanning a domain cold,
# on behalf of someone who has not verified anything, so we can never have
# that proof at Tier 0. Its 12 points leave the denominator on every single
# scan, by design — not as a degraded mode.
# docs/scoring-and-pricing.md 1.2B
ALWAYS_INCONCLUSIVE: dict[str, str] = {
    "creds_accounts": "Employee account exposure requires domain verification",
}

# --- the rule table ------------------------------------------------------
#
# rule id -> (points, check id it belongs to)
#
# The check id matters for two things: the per-category cap, and knowing
# which points to withdraw when that check is inconclusive.
RULE_POINTS: dict[str, tuple[int, str]] = {
    # DMARC — 18
    "dmarc.enforcing":            (0,  "dmarc"),
    "dmarc.reject_no_reporting":  (3,  "dmarc"),
    "dmarc.quarantine":           (8,  "dmarc"),
    "dmarc.monitor_only":         (13, "dmarc"),
    "dmarc.absent":               (18, "dmarc"),

    # SPF — 7
    "spf.strict":            (0, "spf"),
    "spf.softfail":          (3, "spf"),
    "spf.permissive":        (6, "spf"),
    "spf.absent":            (7, "spf"),
    "spf.lookup_overflow":   (4, "spf"),

    # DKIM — 5
    "dkim.present":   (0, "dkim"),
    "dkim.not_found": (5, "dkim"),

    # Breach history — 8 (free half)
    "breach.none":     (0, "creds"),
    "breach.historic": (3, "creds"),
    "breach.recent":   (8, "creds"),
    "breach.multiple": (8, "creds"),

    # Account exposure — 12 (keyed half, Tier 2+)
    "creds.clean":  (0,  "creds_accounts"),
    "creds.low":    (4,  "creds_accounts"),
    "creds.medium": (6,  "creds_accounts"),
    "creds.high":   (9,  "creds_accounts"),
    "creds.severe": (12, "creds_accounts"),

    # TLS — 15, accumulating, capped
    "tls.invalid":          (15, "tls"),
    "tls.self_signed":      (12, "tls"),
    "tls.legacy_protocol":  (8,  "tls"),
    "tls.expiring_urgent":  (6,  "tls"),
    "tls.expiring_soon":    (3,  "tls"),
    "tls.no_redirect":      (4,  "tls"),

    # Headers — 12
    "hdr.no_hsts":                (5, "headers"),
    "hdr.no_csp":                 (4, "headers"),
    "hdr.no_framing_protection":  (2, "headers"),
    "hdr.no_nosniff":             (1, "headers"),

    # Attack surface — 23, accumulating, capped. risk_host fires per host.
    "surface.risk_host":         (6, "subdomains"),
    "surface.directory_listing": (7, "subdomains"),
    "surface.plaintext_host":    (4, "subdomains"),
    "surface.sprawl":            (3, "subdomains"),
}

# Above this many **unexpectedly** inconclusive points the grade is
# meaningless and we say so rather than publishing a letter we cannot
# stand behind.
#
# "Unexpectedly" is rubric v1.1 and it is the whole of the change. Under
# v1.0 this counted every inconclusive point, including the structural
# `creds_accounts` gap that is inconclusive on every Tier 0 scan by
# design. That gap permanently spent 12 of the 25, leaving 13 — less than
# the subdomain check is worth on its own (23). So any certificate
# transparency outage, on any domain, blanked the grade.
#
# Observed live: a company passed six checks with nothing wrong, scored
# 100/100, and the page said "No grade for this domain" because a third
# party server had a bad second.
#
# A gap that is missing on every single scan is not news and must not eat
# the budget reserved for things going wrong. The budget now measures what
# it was always trying to measure: how much we failed to see *today*.
# docs/scoring-and-pricing.md section 3
INCONCLUSIVE_SUPPRESS_ABOVE = 25


class RubricError(ValueError):
    """A check emitted a rule that does not exist in the rubric.

    Deliberately fatal rather than ignored. A silently dropped rule is a
    finding the user was shown and not charged for — the exact class of
    inconsistency that makes a score indefensible.
    """


@dataclass(slots=True)
class CategoryScore:
    check_id: str
    max_points: int
    deducted: int                   # after the cap
    raw_deducted: int               # before the cap
    inconclusive: bool
    reason: str = ""                # why, when inconclusive
    rules: list[str] = field(default_factory=list)

    @property
    def capped(self) -> bool:
        return self.raw_deducted > self.deducted


@dataclass(slots=True)
class ScoreResult:
    score: int
    grade: str | None               # None when suppressed
    available_points: int
    deductions: int
    inconclusive_points: int
    # Of `inconclusive_points`, the part that is NOT the structural Tier 0
    # gap — i.e. checks that were supposed to run and did not. This is the
    # number suppression is judged on. Kept separate rather than replacing
    # `inconclusive_points`, because that one is what the page means by
    # "scored over 88 measurable points" and it has not changed.
    unexpected_inconclusive_points: int
    grade_suppressed: bool
    categories: list[CategoryScore]
    rubric_version: str = RUBRIC_VERSION

    def as_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "grade": self.grade,
            "available_points": self.available_points,
            "deductions": self.deductions,
            "inconclusive_points": self.inconclusive_points,
            "unexpected_inconclusive_points": self.unexpected_inconclusive_points,
            "grade_suppressed": self.grade_suppressed,
            "rubric_version": self.rubric_version,
            "breakdown": [
                {
                    "check": c.check_id,
                    "max": c.max_points,
                    "deducted": c.deducted,
                    "inconclusive": c.inconclusive,
                    **({"reason": c.reason} if c.reason else {}),
                    **({"capped": True} if c.capped else {}),
                    "rules": c.rules,
                }
                for c in self.categories
            ],
        }


def _round_half_up(value: float) -> int:
    """56 must mean 56 on every machine.

    Python's built-in round() is banker's rounding: round(55.5) is 56 but
    round(56.5) is also 56. On a grade boundary that is the difference
    between a B and a C for the same company, decided by parity. Not
    acceptable in a number we ask an underwriter to rely on.
    """
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def points_for(rule: str) -> int:
    """Points for a rule id. Raises if the rule is not in the rubric."""
    try:
        return RULE_POINTS[rule][0]
    except KeyError:
        raise RubricError(f"unknown rule {rule!r} — not in rubric {RUBRIC_VERSION}") from None


def _findings_to_dicts(findings: Iterable[Any]) -> list[dict[str, Any]]:
    """Accept CheckResult objects or already-stored finding dicts.

    A stored scan must rescore identically to a live one — that is what
    makes "reproducible from findings + rubric_version" a true statement
    rather than an aspiration — so both shapes go through the same path.
    """
    out: list[dict[str, Any]] = []
    for item in findings:
        if isinstance(item, dict):
            out.append(item)
        else:
            out.append(item.as_finding())
    return out


def score(
    findings: Iterable[Any],
    *,
    exclude_rules: frozenset[str] | set[str] | None = None,
) -> ScoreResult:
    """Turn findings into a score, a grade, and a defensible breakdown.

    `exclude_rules` is how `fixes.py` asks "what would this be if they
    fixed X?" — it removes those rules and rescores through this same
    function, so a hypothetical score is produced by exactly the same
    arithmetic as a real one, caps and rescaling included.
    """
    from .grades import grade_for      # local: keeps the import graph a DAG

    exclude = set(exclude_rules or ())
    records = _findings_to_dicts(findings)

    raw: dict[str, int] = {cid: 0 for cid in CHECK_POINTS}
    rules_hit: dict[str, list[str]] = {cid: [] for cid in CHECK_POINTS}
    inconclusive: dict[str, str] = dict(ALWAYS_INCONCLUSIVE)
    # Which inconclusive checks are the structural Tier 0 gap rather than
    # something that went wrong. A check drops out of this set the moment
    # any real result arrives for it — including an inconclusive one,
    # because a scanner that ran and timed out is an outage, not
    # structure. That is what makes this hold at Tier 2: the day the HIBP
    # key lands, `creds_accounts` starts reporting and stops being free.
    structural: set[str] = set(ALWAYS_INCONCLUSIVE)
    seen: set[str] = set()

    for record in records:
        check_id = record.get("id", "")
        if check_id in CHECK_POINTS:
            seen.add(check_id)
            structural.discard(check_id)
            # A real result overrides the ALWAYS_INCONCLUSIVE default —
            # that is how the keyed half switches on at Tier 2 with no
            # change to this module.
            if record.get("status") == "inconclusive":
                inconclusive[check_id] = record.get("detail") or "Could not complete"
                continue
            inconclusive.pop(check_id, None)

        for deduction in record.get("deductions", ()):
            rule = deduction["rule"] if isinstance(deduction, dict) else deduction.rule
            if rule in exclude:
                continue
            pts, owner = RULE_POINTS.get(rule, (None, None))
            if pts is None:
                raise RubricError(
                    f"unknown rule {rule!r} from check {check_id!r} "
                    f"— not in rubric {RUBRIC_VERSION}"
                )
            raw[owner] += pts
            rules_hit[owner].append(rule)

    # A check we never heard from at all is inconclusive too. Silence is
    # not a pass: a crashed worker that emitted nothing must not read as
    # a clean bill of health.
    for cid in CHECK_POINTS:
        if cid not in seen and cid not in inconclusive:
            inconclusive[cid] = "Check did not report"

    categories: list[CategoryScore] = []
    available = 0
    deducted_total = 0
    inconclusive_points = 0
    unexpected_inconclusive_points = 0

    for cid, maximum in CHECK_POINTS.items():
        if cid in inconclusive:
            inconclusive_points += maximum
            if cid not in structural:
                unexpected_inconclusive_points += maximum
            categories.append(CategoryScore(
                check_id=cid, max_points=maximum, deducted=0, raw_deducted=0,
                inconclusive=True, reason=inconclusive[cid],
            ))
            continue
        capped = min(raw[cid], maximum)
        available += maximum
        deducted_total += capped
        categories.append(CategoryScore(
            check_id=cid, max_points=maximum, deducted=capped,
            raw_deducted=raw[cid], inconclusive=False, rules=rules_hit[cid],
        ))

    if available == 0:
        # Every check failed. There is no honest number to show.
        return ScoreResult(
            score=0, grade=None, available_points=0, deductions=0,
            inconclusive_points=inconclusive_points,
            unexpected_inconclusive_points=unexpected_inconclusive_points,
            grade_suppressed=True,
            categories=categories,
        )

    # Rescale over what we could actually measure.
    # docs/scoring-and-pricing.md section 3
    value = 100.0 * (available - deducted_total) / available
    final = max(0, min(100, _round_half_up(value)))

    # v1.1: judged on the unexpected points, not the total. See the note
    # on INCONCLUSIVE_SUPPRESS_ABOVE.
    suppressed = unexpected_inconclusive_points > INCONCLUSIVE_SUPPRESS_ABOVE
    return ScoreResult(
        score=final,
        grade=None if suppressed else grade_for(final),
        available_points=available,
        deductions=deducted_total,
        inconclusive_points=inconclusive_points,
        unexpected_inconclusive_points=unexpected_inconclusive_points,
        grade_suppressed=suppressed,
        categories=categories,
    )
