"""The explanation layer.

AI explains. It never scores and never prices.

This package may read anything `app.scoring` produces. `app.scoring` may
not import from here, and a test enforces that. Everything in this package
is optional at runtime: with no provider key set, every call returns a
usable result built from static copy.
"""

from . import classify, fallback, report
from .provider import AllProvidersFailed
from .registry import client_for, describe
from .schemas import Answer, CompanyProfile, FixCopy, RiskReport

__all__ = [
    "classify", "report", "fallback",
    "client_for", "describe", "AllProvidersFailed",
    "CompanyProfile", "RiskReport", "FixCopy", "Answer",
]
