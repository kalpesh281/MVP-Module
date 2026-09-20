"""What to fix, what it is worth, and what it saves.

Every number here is computed by rescoring through `rubric.score()` with
the fixed rules removed — not by adding up point values. That matters
because categories are capped: a company with four exposed staging hosts
has 24 raw points of `surface.risk_host` against a 23-point cap, so
removing one host is worth 0 points, not 6. Arithmetic on the rule table
would cheerfully promise a grade improvement that does not arrive, and the
user would find out by doing the work.

The model's job is the prose — title, why it matters, how to do it. The
model never sees a delta it can change. docs/ai-layer.md call 2

The static `title` and `effort` below exist so the product is complete
with every AI key unset. That is a gate-1 requirement, not a nicety:
a scan must produce a usable report with no model in the loop.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable

from .grades import grade_for
from .pricing import DEFAULT_BAND, DEFAULT_LIMIT, Premium, RevenueBand, annual_saving, premium_for
from .rubric import ScoreResult, score

# Effort strings are rendered verbatim in the UI and must come from this
# set. docs/ai-layer.md Fix.effort
EFFORT_HOURS: dict[str, float] = {
    "15 min": 0.25, "30 min": 0.5, "1 hr": 1.0,
    "2 hrs": 2.0, "1 day": 8.0, "1 week": 40.0,
}


@dataclass(frozen=True, slots=True)
class FixDefinition:
    id: str
    rules: frozenset[str]
    title: str          # plain-language default; AI call 2 may replace it
    effort: str


# One entry per thing a person can actually go and do. Grouping matters:
# HSTS and a Content-Security-Policy are both "headers" but one is a
# one-line change at the edge and the other is a week of finding out what
# your own site loads. Presenting them as one item would make the effort
# estimate a lie in both directions.
#
# Deliberately absent: `breach.*`. A disclosed breach cannot be undone, so
# offering it as a fix would be dishonest. It is reported as context — and
# saying "this one stays on your record" out loud is worth more than
# pretending otherwise.
CATALOG: tuple[FixDefinition, ...] = (
    FixDefinition(
        "dmarc",
        frozenset({"dmarc.absent", "dmarc.monitor_only", "dmarc.quarantine",
                   "dmarc.reject_no_reporting"}),
        "Anyone can send email that looks like it came from you",
        "2 hrs",
    ),
    FixDefinition(
        "spf",
        frozenset({"spf.absent", "spf.permissive", "spf.softfail", "spf.lookup_overflow"}),
        "Your domain does not say which servers may send its mail",
        "1 hr",
    ),
    FixDefinition(
        "dkim",
        frozenset({"dkim.not_found"}),
        "Your outgoing mail is not signed",
        "2 hrs",
    ),
    FixDefinition(
        "tls_certificate",
        frozenset({"tls.invalid", "tls.self_signed"}),
        "Visitors get a browser security warning",
        "2 hrs",
    ),
    FixDefinition(
        "tls_expiry",
        frozenset({"tls.expiring_urgent", "tls.expiring_soon"}),
        "Your certificate is about to expire",
        "30 min",
    ),
    FixDefinition(
        "tls_legacy",
        frozenset({"tls.legacy_protocol"}),
        "Your server still accepts obsolete encryption",
        "1 hr",
    ),
    FixDefinition(
        "tls_redirect",
        frozenset({"tls.no_redirect"}),
        "Plain HTTP is served without redirecting to HTTPS",
        "30 min",
    ),
    FixDefinition(
        "hsts",
        frozenset({"hdr.no_hsts"}),
        "Browsers are not told to always use HTTPS",
        "30 min",
    ),
    FixDefinition(
        "csp",
        frozenset({"hdr.no_csp"}),
        "Nothing limits what code can run on your site",
        "1 day",
    ),
    FixDefinition(
        "headers_basic",
        frozenset({"hdr.no_framing_protection", "hdr.no_nosniff"}),
        "Two one-line browser protections are missing",
        "30 min",
    ),
    FixDefinition(
        "risk_hosts",
        frozenset({"surface.risk_host"}),
        "Internal systems are reachable from the public internet",
        "1 day",
    ),
    FixDefinition(
        "directory_listing",
        frozenset({"surface.directory_listing"}),
        "A server is listing its own files to anyone who asks",
        "1 hr",
    ),
    FixDefinition(
        "plaintext_hosts",
        frozenset({"surface.plaintext_host"}),
        "Some of your sites are served without encryption",
        "2 hrs",
    ),
    FixDefinition(
        "subdomain_sprawl",
        frozenset({"surface.sprawl"}),
        "You have more public hostnames than anyone is tracking",
        "1 week",
    ),
)

BY_ID: dict[str, FixDefinition] = {f.id: f for f in CATALOG}


@dataclass(slots=True)
class Fix:
    id: str
    title: str
    effort: str
    rules: list[str]                # the rules this fix actually clears
    score_delta: int                # points gained, after caps and rescaling
    score_if_fixed: int
    grade_if_fixed: str | None
    premium_if_fixed: Premium
    saving: int
    priority: int = 0
    # Filled by the AI layer; safe defaults so an offline report renders.
    why_it_matters: str = ""
    how_to_fix: str = ""
    notes: list[str] = field(default_factory=list)   # e.g. affected hostnames

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "why_it_matters": self.why_it_matters,
            "how_to_fix": self.how_to_fix,
            "effort": self.effort,
            "score_delta": self.score_delta,
            "score_if_fixed": self.score_if_fixed,
            "grade_if_fixed": self.grade_if_fixed,
            "premium_if_fixed": self.premium_if_fixed.as_dict(),
            "annual_saving": self.saving,
            "priority": self.priority,
            "notes": self.notes,
            "rules": self.rules,
        }


def _fired_rules(findings: Iterable[Any]) -> dict[str, list[str]]:
    """rule id -> the notes attached to each time it fired."""
    hits: dict[str, list[str]] = {}
    for record in findings:
        data = record if isinstance(record, dict) else record.as_finding()
        for deduction in data.get("deductions", ()):
            if isinstance(deduction, dict):
                rule, note = deduction["rule"], deduction.get("note", "")
            else:
                rule, note = deduction.rule, deduction.note
            hits.setdefault(rule, [])
            if note:
                hits[rule].append(note)
    return hits


def build(
    findings: list[Any],
    current: ScoreResult,
    *,
    revenue_band: RevenueBand = DEFAULT_BAND,
    limit: int = DEFAULT_LIMIT,
    data_type: str | None = None,
) -> tuple[list[Fix], dict[str, Any]]:
    """Return (fixes worth doing, the all-fixed summary).

    Ordered by points per hour, descending. A founder with an afternoon
    should be able to start at the top and stop whenever they run out of
    afternoon, and still have spent it on the highest-value work.
    docs/ai-layer.md call 2 ordering rule
    """
    fired = _fired_rules(findings)
    current_premium = premium_for(current.grade, revenue_band, limit, data_type)

    fixes: list[Fix] = []
    for definition in CATALOG:
        hit = definition.rules & fired.keys()
        if not hit:
            continue

        after = score(findings, exclude_rules=definition.rules)
        delta = after.score - current.score
        if delta <= 0:
            # The category was already at its cap, or these points were
            # rescaled away. Offering a fix worth nothing wastes the one
            # thing we are asking of them: attention.
            continue

        after_premium = premium_for(after.grade, revenue_band, limit, data_type)
        notes = sorted({n for rule in hit for n in fired[rule]})
        fixes.append(Fix(
            id=definition.id,
            title=definition.title,
            effort=definition.effort,
            rules=sorted(hit),
            score_delta=delta,
            score_if_fixed=after.score,
            grade_if_fixed=after.grade,
            premium_if_fixed=after_premium,
            saving=annual_saving(current_premium, after_premium),
            notes=notes[:5],
        ))

    fixes.sort(key=lambda f: (-f.score_delta / EFFORT_HOURS[f.effort], -f.score_delta))
    for i, fix in enumerate(fixes, start=1):
        fix.priority = i

    # --- everything fixed at once ---------------------------------------
    all_rules: frozenset[str] = frozenset().union(
        *(BY_ID[f.id].rules for f in fixes)
    ) if fixes else frozenset()
    combined = score(findings, exclude_rules=all_rules)
    combined_premium = premium_for(combined.grade, revenue_band, limit, data_type)

    summary = {
        "score": combined.score,
        "grade": combined.grade,
        "premium": combined_premium.as_dict(),
        "annual_saving": annual_saving(current_premium, combined_premium),
        "total_effort_hours": round(sum(EFFORT_HOURS[f.effort] for f in fixes), 2),
    }
    return fixes, summary


def strengths(findings: Iterable[Any]) -> list[str]:
    """What they already do right, from the checks that passed.

    Never returned empty unless everything failed. A page that is only bad
    news gets closed; a page that opens with three things you got right
    earns the attention the bad news needs. docs/education-layer.md
    """
    out: list[str] = []
    for record in findings:
        data = record if isinstance(record, dict) else record.as_finding()
        if data.get("status") == "pass":
            out.append(f"{data.get('label', data.get('id'))}: {data.get('detail', '')}".strip(": "))
    return out
