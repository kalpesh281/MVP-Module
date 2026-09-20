"""Run a full scan from the terminal, before any of the web layer exists.

    python -m app.cli zerodha.com
    python -m app.cli zerodha.com --stream     # completion order, with timings
    python -m app.cli zerodha.com --json       # the stored payload shape

The Day 1 checkpoint tool. It drives the real orchestrator and the real
scoring engine, so what you see here is exactly what the SSE endpoint will
emit — minus the AI prose, which is written around these numbers and never
allowed to change them.
"""

from __future__ import annotations

import asyncio
import sys
import time

from . import ai
from .domain import InvalidDomain, normalise
from .scanner import runner
from .scanner.base import CheckResult
from .scoring import (
    GRADE_SUMMARY,
    band_for_headcount,
    build_fixes,
    points_to_next_grade,
    premium_for,
    premium_table,
    score,
    strengths,
)

GLYPH = {"pass": "✓", "warn": "⚠", "fail": "✗", "inconclusive": "–"}


def _print(result: CheckResult, elapsed: float | None = None) -> None:
    stamp = f"{elapsed:5.2f}s " if elapsed is not None else ""
    pad = " " * len(stamp)
    print(f"  {stamp}{GLYPH.get(result.status, '?')}  {result.label:<20} {result.detail}")
    for deduction in result.deductions:
        note = f"  · {deduction.note}" if deduction.note else ""
        print(f"  {pad}     └─ {deduction.rule}{note}")


def _rupees(amount: int | None) -> str:
    """Indian digit grouping. 1,20,000 — not 120,000. Getting this wrong in
    front of an Indian founder is a small thing that reads as a large one."""
    if amount is None:
        return "—"
    text = str(amount)
    if len(text) <= 3:
        return text
    head, tail = text[:-3], text[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return ",".join(parts + [tail])


async def _report(domain: str, results: list[CheckResult]) -> dict:
    """Findings -> score, grade, premium, fixes, then prose around them.

    The order matters and is the architecture in miniature: everything
    numeric is settled before a model is called, and nothing a model
    returns can change it.
    """
    findings = [r.as_finding() for r in results]
    scored = score(findings)

    # Call 1 reads the homepage `headers.py` already fetched — no extra
    # request to the target, and it decides the revenue band.
    page = next((r.extra for r in results if r.id == "headers" and r.extra), {})
    profile, classified_by = await ai.classify.run(domain, page)
    band = band_for_headcount(profile.estimated_size_band if profile else None)

    premium = premium_for(scored.grade, band)
    fixes, combined = build_fixes(findings, scored, revenue_band=band)

    good = strengths(results)
    prose = await ai.report.write(domain, scored, fixes, findings, good, profile)
    good = prose["strengths"]

    print("  " + "-" * 66)
    if profile:
        print(f"  {profile.company_name} — {profile.what_they_do}")
        print(f"  {profile.business_model}, {profile.estimated_size_band} people"
              f"{', DPDP Act applies' if profile.dpdp_act_applies else ''}")
        print()
    print(f"  {prose['headline']}")
    if scored.grade_suppressed:
        print(f"  No grade — {scored.inconclusive_points} points could not be measured")
    else:
        gap = points_to_next_grade(scored.score)
        nudge = (f"  ({gap} point{'s' if gap != 1 else ''} from the next grade)"
                 if gap else "")
        print(f"  Grade {scored.grade}   score {scored.score}/100"
              f"   over {scored.available_points} measurable points{nudge}")
        print(f"  {GRADE_SUMMARY[scored.grade]}")
    table = premium_table(band)
    print(f"  Estimated premium   ₹{_rupees(premium.low)} – ₹{_rupees(premium.high)}"
          f"   (₹5 Cr limit, {table['revenue_band_label']})")

    if fixes:
        print("\n  Worth fixing, best value first:")
        for fix in fixes:
            print(f"   {fix.priority}. {fix.title}")
            print(f"      +{fix.score_delta} points, {fix.effort}"
                  f" → grade {fix.grade_if_fixed or chr(8212)}"
                  f", saves about ₹{_rupees(fix.saving)}/year")
            if fix.why_it_matters:
                print(f"      {fix.why_it_matters}")
            if fix.how_to_fix:
                print(f"      → {fix.how_to_fix}")
            if fix.notes:
                print(f"      affects: {', '.join(fix.notes)}")
        print(f"\n  All of it: score {combined['score']}, grade {combined['grade'] or chr(8212)}, "
              f"about ₹{_rupees(combined['annual_saving'])}/year"
              f" for {combined['total_effort_hours']} hours of work")

    if good:
        print("\n  Already right:")
        for line in good:
            print(f"   · {line}")
    print(f"\n  copy: {prose['generated_by'] or 'static fallback (no AI)'}"
          f"   ·   profile: {classified_by or 'none'}\n")

    return {
        "domain": domain,
        **scored.as_dict(),
        "headline": prose["headline"],
        "profile": profile.model_dump() if profile else None,
        "premium": premium.as_dict(),
        "premium_table": table,
        "fixes": [f.as_dict() for f in fixes],
        "combined_if_all_fixed": combined,
        "strengths": good,
        "findings": findings,
        "generated_by": prose["generated_by"],
    }


async def main(raw: str, stream: bool = False, as_json: bool = False) -> int:
    try:
        domain = normalise(raw)
    except InvalidDomain as exc:
        print(f"✗  {exc.code}: {exc.message}")
        return 1

    print(f"\nChecking {domain}\n")
    started = time.monotonic()

    if stream:
        # Completion order — what the browser actually receives.
        collected = []
        async for result in runner.run(domain):
            _print(result, time.monotonic() - started)
            collected.append(result)
        collected.sort(key=lambda r: runner.DISPLAY_ORDER.index(r.id)
                       if r.id in runner.DISPLAY_ORDER else 99)
    else:
        collected = await runner.run_all(domain)
        for result in collected:
            _print(result)

    print(f"\n  {time.monotonic() - started:.2f}s total\n")

    payload = await _report(domain, collected)
    if as_json:
        import json
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print("usage: python -m app.cli <domain> [--stream] [--json]")
        raise SystemExit(2)
    raise SystemExit(asyncio.run(
        main(args[0], "--stream" in sys.argv, "--json" in sys.argv)
    ))
