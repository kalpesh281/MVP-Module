"""Run a full scan from the terminal, before any of the web layer exists.

    python -m app.cli zerodha.com
    python -m app.cli zerodha.com --stream     # completion order, with timings

The Day 1 checkpoint tool. It drives the real orchestrator, so what you see
here is exactly what the SSE endpoint will emit.
"""

from __future__ import annotations

import asyncio
import sys
import time

from .domain import InvalidDomain, normalise
from .scanner import runner
from .scanner.base import CheckResult

GLYPH = {"pass": "✓", "warn": "⚠", "fail": "✗", "inconclusive": "–"}


def _print(result: CheckResult, elapsed: float | None = None) -> None:
    stamp = f"{elapsed:5.2f}s " if elapsed is not None else ""
    pad = " " * len(stamp)
    print(f"  {stamp}{GLYPH.get(result.status, '?')}  {result.label:<20} {result.detail}")
    for deduction in result.deductions:
        note = f"  · {deduction.note}" if deduction.note else ""
        print(f"  {pad}     └─ {deduction.rule}{note}")


async def main(raw: str, stream: bool = False) -> int:
    try:
        domain = normalise(raw)
    except InvalidDomain as exc:
        print(f"✗  {exc.code}: {exc.message}")
        return 1

    print(f"\nChecking {domain}\n")
    started = time.monotonic()

    if stream:
        # Completion order — what the browser actually receives.
        async for result in runner.run(domain):
            _print(result, time.monotonic() - started)
    else:
        for result in await runner.run_all(domain):
            _print(result)

    print(f"\n  {time.monotonic() - started:.2f}s total\n")
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print("usage: python -m app.cli <domain> [--stream]")
        raise SystemExit(2)
    raise SystemExit(asyncio.run(main(args[0], "--stream" in sys.argv)))
