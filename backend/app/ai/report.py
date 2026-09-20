"""Call 2 — the product's voice.

The most important call in the product, and the one with the least power.
It receives fixes that already have their points, their grade and their
premium attached, and it writes the words around them. Then this module
joins the computed numbers back on, discarding anything the model said
about them.

Three things enforced here rather than requested in the prompt:

1. **A fix the model invented is dropped.** Only ids that the scoring
   engine produced survive. A finding we did not observe is the worst
   failure the product has, because it is the first thing their CTO checks.
2. **The model cannot change a number.** The schema has no numeric field.
   The merge below reads prose from the model and everything else from the
   `Fix` objects it was given.
3. **Order is ours, not the model's.** Priority comes from points per hour,
   computed in `scoring/fixes.py`.

With no provider key set, this module returns the same structure built
from static copy, and the report reads as plainer rather than broken.
docs/ai-layer.md call 2, docs/testing.md GATE 1
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ..config import AI_MAX_TOKENS
from ..scoring import Fix, ScoreResult
from . import fallback
from .provider import AllProvidersFailed
from .registry import client_for
from .schemas import CompanyProfile, RiskReport

log = logging.getLogger(__name__)

SYSTEM = """You explain cyber security findings to startup founders who are not \
security people, in the context of buying cyber insurance.

Rules:
- Never state a finding that is not present in the scan data you are given.
- The score, grade, and premium are computed elsewhere and given to you. Explain
  them. Never restate them as different numbers and never compute your own.
- Return one entry per fix id you were given, using exactly that id. Do not
  invent fixes, do not merge two into one, do not drop one.
- Every title must be free of security jargon. Jargon is allowed in how_to_fix.
- Frame why_it_matters as business impact, in the second person, present tense.
  Not "SPF record lacks a -all qualifier" but "Anyone can send email that looks
  like it's from you."
- how_to_fix must be specific enough to act on without further research.
- Be direct. No hedging, no "may potentially", no exclamation marks.
- strengths must list what the company already does correctly, in plain
  language. Never return it empty unless every check failed.
- headline is one sentence about where this company stands. No number in it."""


def _fix_brief(fix: Fix) -> dict[str, Any]:
    """What the model is told about one fix. Deliberately no premium and no
    grade: it has no use for them and cannot be tempted to restate them."""
    brief: dict[str, Any] = {
        "id": fix.id,
        "what_we_found": fix.title,
        "rules_triggered": fix.rules,
        "suggested_effort": fix.effort,
    }
    if fix.notes:
        brief["affected_hosts"] = fix.notes
    return brief


def _prompt(
    domain: str,
    scored: ScoreResult,
    fixes: list[Fix],
    findings: list[dict],
    profile: CompanyProfile | None,
) -> str:
    observed = [
        {"check": f["label"], "status": f["status"], "detail": f["detail"]}
        for f in findings
    ]
    payload: dict[str, Any] = {
        "domain": domain,
        "grade": scored.grade,
        "score": scored.score,
        "observed_checks": observed,
        "fixes_to_write_copy_for": [_fix_brief(f) for f in fixes],
    }
    if profile is not None:
        payload["company"] = {
            "name": profile.company_name,
            "what_they_do": profile.what_they_do,
            "business_model": profile.business_model,
            "data_types": profile.data_types_handled,
        }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def _apply_static_copy(fixes: list[Fix]) -> None:
    for fix in fixes:
        why, how = fallback.copy_for(fix.id)
        fix.why_it_matters = fix.why_it_matters or why
        fix.how_to_fix = fix.how_to_fix or how


async def write(
    domain: str,
    scored: ScoreResult,
    fixes: list[Fix],
    findings: list[dict],
    strengths: list[str],
    profile: CompanyProfile | None = None,
) -> dict[str, Any]:
    """Attach prose to already-computed fixes. Never raises.

    `fixes` is mutated in place — the caller keeps the same objects with
    their numbers untouched and their text filled in.
    """
    generated_by: str | None = None
    headline = fallback.headline(scored.grade)
    final_strengths = list(strengths)

    client = client_for("report")
    if client is None:
        log.info("report using static copy for %s: no provider key set", domain)
    else:
        try:
            report, generated_by = await client.parse(
                system=SYSTEM,
                user=_prompt(domain, scored, fixes, findings, profile),
                schema=RiskReport,
                max_tokens=AI_MAX_TOKENS,
            )
        except AllProvidersFailed as exc:
            log.warning("report failed for %s, using static copy: %s", domain, exc)
        else:
            known = {f.id: f for f in fixes}
            for written in report.fixes:
                fix = known.get(written.id)
                if fix is None:
                    # A fix we never computed. Dropped and logged — this is
                    # the check that keeps an invented finding off the page.
                    log.warning("report invented fix %r for %s", written.id, domain)
                    continue
                fix.title = written.title.strip() or fix.title
                fix.why_it_matters = written.why_it_matters.strip()
                fix.how_to_fix = written.how_to_fix.strip()
                # The model may disagree about effort — it sees the finding
                # and we only see the rule — but ordering was computed from
                # our value, so accepting a different one here would leave
                # the list sorted by a number no longer shown. Keep ours.
            if report.headline.strip():
                headline = report.headline.strip()
            if report.strengths:
                final_strengths = [s.strip() for s in report.strengths if s.strip()]

    # Any fix the model skipped, or every fix when it never ran.
    _apply_static_copy(fixes)

    return {
        "headline": headline,
        "strengths": final_strengths,
        "generated_by": generated_by,        # None means static copy
    }
