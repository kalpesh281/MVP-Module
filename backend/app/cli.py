"""Run checks from the terminal, before any of the web layer exists.

    python -m app.cli zerodha.com

This is the Day 1 checkpoint tool. It runs whatever checks are implemented
and prints them, so the scanner can be verified against real domains long
before there is an API to call.
"""

from __future__ import annotations

import asyncio
import sys
import time

from .domain import InvalidDomain, normalise
from .scanner.base import CheckResult

GLYPH = {"pass": "✓", "warn": "⚠", "fail": "✗", "inconclusive": "–"}


def _print(result: CheckResult) -> None:
    print(f"  {GLYPH.get(result.status, '?')}  {result.label:<24} {result.detail}")
    for deduction in result.deductions:
        note = f"  ({deduction.note})" if deduction.note else ""
        print(f"       └─ {deduction.rule}{note}")


async def main(raw: str) -> int:
    try:
        domain = normalise(raw)
    except InvalidDomain as exc:
        print(f"✗  {exc.code}: {exc.message}")
        return 1

    print(f"\nChecking {domain}\n")
    started = time.monotonic()

    from .scanner import creds, email_auth

    checks = [("email_auth", email_auth.run), ("creds", creds.run)]

    for name, fn in checks:
        try:
            results = await fn(domain)
        except Exception as exc:                       # never fail the scan
            print(f"  –  {name:<24} crashed: {exc}")
            continue
        for result in results if isinstance(results, list) else [results]:
            _print(result)

    print(f"\n  {time.monotonic() - started:.2f}s\n")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python -m app.cli <domain>")
        raise SystemExit(2)
    raise SystemExit(asyncio.run(main(sys.argv[1])))
