"""Grade bands. Rubric v1.0.

The grade is what the page leads with; the number is shown on hover and in
exports. A bare "56/100" reads as a failed exam and makes a founder
defensive before they have read a single finding — a letter invites the
question "what moves it?", which is the entire product.
docs/scoring-and-pricing.md section 2
"""

from __future__ import annotations

# (grade, lowest score that earns it), best first.
BANDS: tuple[tuple[str, int], ...] = (
    ("A", 85),
    ("B", 70),
    ("C", 55),
    ("D", 40),
    ("F", 0),
)

GRADES: tuple[str, ...] = tuple(g for g, _ in BANDS)

# One line per grade, used when the AI layer is unavailable. Deliberately
# plain: this is the sentence a founder reads first.
GRADE_SUMMARY: dict[str, str] = {
    "A": "Strong. Nothing here would hold up an insurance application.",
    "B": "Good, with a few gaps worth closing before you apply.",
    "C": "Workable, but an underwriter will ask about several of these.",
    "D": "Weak. Expect a higher premium or additional conditions.",
    "F": "Serious gaps. Most insurers would want these fixed before quoting.",
}


def grade_for(score: int) -> str:
    for grade, floor in BANDS:
        if score >= floor:
            return grade
    return "F"


def band_for(grade: str) -> tuple[int, int]:
    """Inclusive (low, high) score range for a grade."""
    for i, (g, floor) in enumerate(BANDS):
        if g == grade:
            return (floor, 100 if i == 0 else BANDS[i - 1][1] - 1)
    raise ValueError(f"unknown grade {grade!r}")


def points_to_next_grade(score: int) -> int | None:
    """How many points away the next grade up is. None at A.

    This drives one of the most persuasive lines on the page — "four points
    from a B" — and it is arithmetic, not a model's opinion.
    """
    current = grade_for(score)
    if current == "A":
        return None
    index = GRADES.index(current)
    return BANDS[index - 1][1] - score
