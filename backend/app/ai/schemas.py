"""What the model is allowed to return.

Note what is absent from every schema in this file: no score, no grade, no
premium, no percentage, no rupee figure. The model writes prose around
numbers that were computed before it was called and are joined back on
after it returns. It is structurally unable to produce a number that
reaches the user. docs/ai-layer.md call 2
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

BusinessModel = Literal[
    "B2B_SaaS", "B2C", "Marketplace", "Fintech", "Healthtech", "Services", "Other"
]
DataType = Literal["PII", "PHI", "payment_card", "financial", "biometric", "none_sensitive"]
# "500+" was added with rate card v1.1. Without it every company above
# 200 people — a 250-person startup and a listed broker alike — landed
# in the same revenue band and got the same premium.
SizeBand = Literal["1-10", "11-50", "51-200", "200+", "500+"]

# Rendered verbatim in the UI, so the model may not invent a seventh value.
Effort = Literal["15 min", "30 min", "1 hr", "2 hrs", "1 day", "1 week"]


class CompanyProfile(BaseModel):
    """Call 1. Drives the revenue band, the claim scenario and the coverage
    recommendation — which is why a failure here costs more than it looks."""

    company_name: str
    what_they_do: str = Field(description="One plain sentence. No marketing language.")
    industry: str
    business_model: BusinessModel
    data_types_handled: list[DataType] = Field(default_factory=list)
    dpdp_act_applies: bool
    estimated_size_band: SizeBand


class FixCopy(BaseModel):
    """Call 2, one per fix. `id` must match a fix the scoring engine built.

    Anything else is dropped — a model naming a finding we did not observe
    is the single worst failure mode in the product, because the first
    thing their CTO does is check it.
    """

    id: str
    title: str = Field(description="Plain language. No security jargon.")
    why_it_matters: str = Field(description="Business impact, second person, present tense.")
    how_to_fix: str = Field(description="Concrete and actionable. Jargon allowed here.")
    effort: Effort


class RiskReport(BaseModel):
    """Call 2. Prose only."""

    headline: str = Field(description="One sentence summarising where they stand.")
    fixes: list[FixCopy] = Field(default_factory=list)
    strengths: list[str] = Field(
        default_factory=list,
        description="What they already do correctly. Never empty unless every check failed.",
    )


class Answer(BaseModel):
    """Call 3."""

    answer: str
    grounded: bool = Field(
        description="False if the question cannot be answered from the report alone."
    )


class CoverageRationale(BaseModel):
    """Module A. Justifies a limit that a rules engine already chose.

    Note the absence, again: no limit field, no premium field, no cost
    figure. The model cannot propose a different number because there is
    nowhere for a different number to go.
    """

    headline: str = Field(description="One short line, e.g. 'Recommended: Rs 5 Cr'.")
    reasoning: str = Field(description="Two to three sentences. Name the specific reason.")
    downside: str = Field(description="One sentence: what the next limit down leaves exposed.")


class ScenarioCopy(BaseModel):
    """Module B. Title and narrative only.

    Cost lines, covered, not-covered and the sublimit warning are rendered
    verbatim from the catalog and are deliberately not in this schema. A
    model inventing a coverage statement is the one mistake this product
    cannot make, so it is not given the opportunity.
    """

    title: str = Field(description="Short, concrete, second person. No exclamation marks.")
    narrative: str = Field(
        description="Exactly two sentences on how this specific company gets hit."
    )


class Guidance(BaseModel):
    """Calls 4 and 5, issued as one request.

    Two prose blocks that need the same context. Sending them separately
    would add a second round trip to a scan that already spends its whole
    budget, for no gain the reader can see.
    """

    coverage: CoverageRationale
    scenario: ScenarioCopy | None = None
