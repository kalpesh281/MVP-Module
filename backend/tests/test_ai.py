"""The AI layer's job is prose. These tests are about what it cannot do.

The most important one is `test_full_report_with_no_provider_keys`: a scan
with every key unset must still produce a grade, a premium, a prioritised
fix list and readable copy. That is a GATE 1 requirement, not a fallback
to apologise for. docs/testing.md
"""

from __future__ import annotations

import pytest

from app.ai import fallback, report
from app.ai.schemas import FixCopy, RiskReport
from app.scoring import build_fixes, score
from app.scoring.fixes import CATALOG

from test_scoring import WORKED_EXAMPLE


@pytest.fixture
def scored_example():
    scored = score(WORKED_EXAMPLE)
    fixes, _ = build_fixes(WORKED_EXAMPLE, scored)
    return scored, fixes


# --- the gate ------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_report_with_no_provider_keys(monkeypatch, scored_example):
    """Every key unset. The report must still read like a product."""
    for key in ("GROQ_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY",
                "PROVIDER_REPORT", "PROVIDER_CLASSIFY"):
        monkeypatch.delenv(key, raising=False)

    scored, fixes = scored_example
    prose = await report.write("yourco.com", scored, fixes, WORKED_EXAMPLE,
                               ["SPF configured"])

    assert prose["generated_by"] is None            # static copy, and says so
    assert prose["headline"]
    assert prose["strengths"] == ["SPF configured"]
    for fix in fixes:
        assert fix.why_it_matters, fix.id
        assert fix.how_to_fix, fix.id
        assert fix.score_delta > 0


def test_every_fix_has_fallback_copy():
    """If scoring adds a fix, the offline path must not go silent on it."""
    missing = [f.id for f in CATALOG if f.id not in fallback.COPY]
    assert missing == []


def test_fallback_headline_covers_every_grade_and_none():
    for grade in ("A", "B", "C", "D", "F"):
        assert fallback.headline(grade)
    assert fallback.headline(None) == fallback.NO_GRADE_HEADLINE


# --- what the model is not allowed to do --------------------------------

class _FakeClient:
    """Stands in for a provider chain that returns exactly this report."""

    def __init__(self, response: RiskReport):
        self._response = response
        self.prompt: str | None = None

    async def parse(self, *, system, user, schema, max_tokens):
        self.prompt = user
        return self._response, "fake/model"


@pytest.mark.asyncio
async def test_an_invented_fix_is_dropped(monkeypatch, scored_example):
    """A finding we did not observe is the worst failure the product has."""
    scored, fixes = scored_example
    fake = _FakeClient(RiskReport(
        headline="Here is where you stand.",
        fixes=[
            FixCopy(id="dmarc", title="Real", why_it_matters="w", how_to_fix="h",
                    effort="2 hrs"),
            FixCopy(id="ransomware_insurance", title="Invented",
                    why_it_matters="w", how_to_fix="h", effort="1 day"),
        ],
        strengths=["SPF is configured"],
    ))
    monkeypatch.setattr(report, "client_for", lambda call: fake)

    await report.write("yourco.com", scored, fixes, WORKED_EXAMPLE, [])

    assert "ransomware_insurance" not in {f.id for f in fixes}
    assert next(f for f in fixes if f.id == "dmarc").title == "Real"


@pytest.mark.asyncio
async def test_the_model_cannot_change_a_number(monkeypatch, scored_example):
    scored, fixes = scored_example
    before = {f.id: (f.score_delta, f.grade_if_fixed, f.saving, f.priority,
                     f.effort, f.premium_if_fixed.low) for f in fixes}

    fake = _FakeClient(RiskReport(
        headline="Ignore this.",
        # Claims a different effort, which would reorder the list if honoured.
        fixes=[FixCopy(id=f.id, title="t", why_it_matters="w", how_to_fix="h",
                       effort="15 min") for f in fixes],
    ))
    monkeypatch.setattr(report, "client_for", lambda call: fake)

    await report.write("yourco.com", scored, fixes, WORKED_EXAMPLE, [])

    after = {f.id: (f.score_delta, f.grade_if_fixed, f.saving, f.priority,
                    f.effort, f.premium_if_fixed.low) for f in fixes}
    assert after == before


@pytest.mark.asyncio
async def test_a_fix_the_model_skipped_still_gets_copy(monkeypatch, scored_example):
    scored, fixes = scored_example
    fake = _FakeClient(RiskReport(headline="h", fixes=[
        FixCopy(id="dmarc", title="t", why_it_matters="w", how_to_fix="h",
                effort="2 hrs")
    ]))
    monkeypatch.setattr(report, "client_for", lambda call: fake)

    await report.write("yourco.com", scored, fixes, WORKED_EXAMPLE, [])
    for fix in fixes:
        assert fix.why_it_matters and fix.how_to_fix, fix.id


@pytest.mark.asyncio
async def test_provider_failure_falls_back_silently(monkeypatch, scored_example):
    from app.ai.provider import AllProvidersFailed

    class _Dead:
        async def parse(self, **_):
            raise AllProvidersFailed("everything is down")

    scored, fixes = scored_example
    monkeypatch.setattr(report, "client_for", lambda call: _Dead())

    prose = await report.write("yourco.com", scored, fixes, WORKED_EXAMPLE, ["ok"])
    assert prose["generated_by"] is None
    assert prose["headline"] == fallback.headline(scored.grade)
    assert all(f.why_it_matters for f in fixes)


@pytest.mark.asyncio
async def test_the_prompt_carries_no_premium(monkeypatch, scored_example):
    """It has no use for a rupee figure and cannot be tempted to restate one."""
    scored, fixes = scored_example
    fake = _FakeClient(RiskReport(headline="h", fixes=[]))
    monkeypatch.setattr(report, "client_for", lambda call: fake)

    await report.write("yourco.com", scored, fixes, WORKED_EXAMPLE, [])

    assert "premium" not in fake.prompt.lower()
    assert "85000" not in fake.prompt and "₹" not in fake.prompt


# --- classify ------------------------------------------------------------

@pytest.mark.asyncio
async def test_classify_skips_when_the_page_is_empty():
    """Classifying a domain from its name alone invites invention."""
    from app.ai import classify
    profile, model = await classify.run("yourco.com", {})
    assert (profile, model) == (None, None)


def test_visible_text_strips_scripts_and_tags():
    from app.ai.classify import _visible_text
    html = "<html><script>var x=1;</script><h1>Acme</h1><p>We do payments.</p></html>"
    text = _visible_text(html)
    assert "var x" not in text
    assert "Acme" in text and "We do payments." in text
