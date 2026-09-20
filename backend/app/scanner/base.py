"""The contract every check returns.

One shape for all five checks, so the runner, the scoring engine and the
SSE layer never need to know which check produced a result.

`scoring/` consumes `deductions` and nothing else. That is what keeps the
score reproducible from `findings` + `rubric_version` alone.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Status = Literal["pass", "warn", "fail", "inconclusive"]


@dataclass(slots=True)
class Deduction:
    """One rule fired. `rule` must exist in docs/scoring-and-pricing.md.

    Checks do NOT decide point values — they name the rule and the scoring
    engine looks up the points. A check that invents a number is a check
    that can silently drift from the published rubric.
    """

    rule: str                       # "dmarc.absent"
    note: str = ""                  # optional human detail, e.g. "14 accounts"

    def as_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"rule": self.rule}
        if self.note:
            d["note"] = self.note
        return d


@dataclass(slots=True)
class CheckResult:
    id: str                         # "dmarc" — also the scoring weight key
    label: str                      # "DMARC policy"
    status: Status
    detail: str                     # "No DMARC record found"
    evidence: dict[str, Any] = field(default_factory=dict)
    deductions: list[Deduction] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)   # never serialised to the client

    @classmethod
    def inconclusive(cls, id: str, why: str, label: str | None = None) -> "CheckResult":
        """A check that could not run.

        Its points are removed from the denominator, not scored as zero.
        Never grade a company well because a check failed to run.
        """
        return cls(id=id, label=label or id, status="inconclusive", detail=why)

    def as_event(self) -> dict[str, Any]:
        """The SSE `check` payload. `extra` is deliberately excluded —
        it carries raw HTML and certificate objects meant for internal use."""
        return {
            "type": "check",
            "id": self.id,
            "label": self.label,
            "status": self.status,
            "detail": self.detail,
            "evidence": self.evidence,
        }

    def as_finding(self) -> dict[str, Any]:
        """The stored audit record. `evidence` is mandatory on any result
        that is not inconclusive: if a finding is disputed we must be able
        to show exactly what we observed."""
        return {
            "id": self.id,
            "label": self.label,
            "status": self.status,
            "detail": self.detail,
            "evidence": self.evidence,
            "deductions": [d.as_dict() for d in self.deductions],
        }
