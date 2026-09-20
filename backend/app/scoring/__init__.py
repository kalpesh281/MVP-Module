"""Deterministic scoring, grading and pricing.

**This package must never import from `app.ai`.** A score has to be
reproducible from `findings` + `rubric_version` alone, forever, with no
model in the path. The dependency direction is one-way: `ai` may read
scoring output, scoring may not ask `ai` anything.
"""

from .fixes import Fix, build as build_fixes, strengths
from .grades import GRADE_SUMMARY, grade_for, points_to_next_grade
from .pricing import (
    DEFAULT_BAND,
    DEFAULT_LIMIT,
    Premium,
    annual_saving,
    band_for_headcount,
    premium_for,
    premium_table,
)
from .rubric import CHECK_POINTS, RULE_POINTS, RubricError, ScoreResult, score

__all__ = [
    "CHECK_POINTS", "RULE_POINTS", "RubricError", "ScoreResult", "score",
    "grade_for", "points_to_next_grade", "GRADE_SUMMARY",
    "Premium", "premium_for", "premium_table", "annual_saving",
    "band_for_headcount", "DEFAULT_BAND", "DEFAULT_LIMIT",
    "Fix", "build_fixes", "strengths",
]
