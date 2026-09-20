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

from .domain import InvalidDomain, normalise
from .scanner import runner
from .scanner.base import CheckResult
from .scoring import (
    GRADE_SUMMARY,
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


def _report(results: list[CheckResult]) -> dict:
    """Findings -> score, grade, premium, fixes. No model anywhere here."""
    findings = [r.as_finding() for r in results]
    scored = score(findings)

    # Tier 0 has no revenue signal until AI call 1 lands, so this is the
    # smallest band. docs/scoring-and-pricing.md 4.2
    premium = premium_for(scored.grade)
    fixes, combined = build_fixes(findings, scored)

    print("  " + "-" * 66)
    if scored.grade_suppressed:
        print(f"  No grade — {scored.inconclusive_points} points could not be measured")
    else:
        gap = points_to_next_grade(scored.score)
        nudge = f"  ({gap} points from the next grade)" if gap else ""
        print(f"  Grade {scored.grade}   score {scored.score}/100"
              f"   over {scored.available_points} measurable points{nudge}")
        print(f"  {GRADE_SUMMARY[scored.grade]}")
    print(f"  Estimated premium   ₹{_rupees(premium.low)} – ₹{_rupees(premium.high)}"
          f"   (₹5 Cr limit, under ₹5 Cr revenue)")

    if fixes:
        print("\n  Worth fixing, best value first:")
        for fix in fixes:
            print(f"   {fix.priority}. {fix.title}")
            print(f"      +{fix.score_delta} points, {fix.effort}"
                  f" → grade {fix.grade_if_fixed or chr(8212)}"
                  f", saves about ₹{_rupees(fix.saving)}/year")
            if fix.notes:
                print(f"      affects: {', '.join(fix.notes)}")
        print(f"\n  All of it: score {combined['score']}, grade {combined['grade'] or chr(8212)}, "
              f"about ₹{_rupees(combined['annual_saving'])}/year"
              f" for {combined['total_effort_hours']} hours of work")

    good = strengths(results)
    if good:
        print("\n  Already right:")
        for line in good:
            print(f"   · {line}")
    print()

    return {
        "domain": None,
        **scored.as_dict(),
        "premium": premium.as_dict(),
        "premium_table": premium_table(),
        "fixes": [f.as_dict() for f in fixes],
        "combined_if_all_fixed": combined,
        "strengths": good,
        "findings": findings,
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

    payload = _report(collected)
    payload["domain"] = domain
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
