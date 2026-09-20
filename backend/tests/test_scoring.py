"""Gate 1 scoring tests.

The first test in this file is the one that decides whether the rubric
ships. docs/testing.md GATE 1:

    "If that number isn't exactly 56, stop and fix the rubric before
     going further."

It is written against the worked example in docs/scoring-and-pricing.md
section 6 and it must never be edited to match the code. If the code and
the document disagree, the document is right.
"""

from __future__ import annotations

import pytest

from app.scoring import grades, pricing, rubric
from app.scoring.fixes import build as build_fixes


def finding(check_id, status, *rules, label=None, detail="", note=""):
    return {
        "id": check_id,
        "label": label or check_id,
        "status": status,
        "detail": detail,
        "evidence": {},
        "deductions": [
            {"rule": r, **({"note": note} if note else {})} for r in rules
        ],
    }


# The worked example, transcribed from the document. Nothing else.
WORKED_EXAMPLE = [
    finding("dmarc", "fail", "dmarc.absent", detail="No DMARC record"),
    finding("spf", "warn", "spf.softfail", detail="Ends ~all"),
    finding("dkim", "pass", detail="Found at selector google"),
    finding("creds", "warn", "breach.historic", detail="One breach, 2019"),
    finding("tls", "pass", detail="Valid, 240 days remaining"),
    finding("headers", "fail", "hdr.no_hsts", "hdr.no_csp", detail="Missing HSTS, CSP"),
    finding("subdomains", "fail", "surface.risk_host",
            detail="staging.yourco.com live, returns 200", note="staging.yourco.com"),
]


# --- the gate ------------------------------------------------------------

def test_worked_example_reproduces_exactly():
    result = rubric.score(WORKED_EXAMPLE)
    assert result.deductions == 39
    assert result.available_points == 88        # 100 - 12 keyed breach half
    assert result.inconclusive_points == 12
    assert result.score == 56
    assert result.grade == "C"
    assert result.grade_suppressed is False


def test_worked_example_fix_ladder():
    """The document's projection table, in order."""
    current = rubric.score(WORKED_EXAMPLE)

    after_dmarc = rubric.score(WORKED_EXAMPLE, exclude_rules={"dmarc.absent"})
    assert after_dmarc.deductions == 21
    assert after_dmarc.score == 76 and after_dmarc.grade == "B"

    after_headers = rubric.score(
        WORKED_EXAMPLE, exclude_rules={"dmarc.absent", "hdr.no_hsts", "hdr.no_csp"}
    )
    assert after_headers.deductions == 12
    assert after_headers.score == 86 and after_headers.grade == "A"

    after_all = rubric.score(
        WORKED_EXAMPLE,
        exclude_rules={"dmarc.absent", "hdr.no_hsts", "hdr.no_csp", "surface.risk_host"},
    )
    assert after_all.deductions == 6
    assert after_all.score == 93 and after_all.grade == "A"

    # The product's core message: one afternoon of work, one grade, real money.
    assert current.score < after_dmarc.score


def test_worked_example_premium_and_saving():
    current = rubric.score(WORKED_EXAMPLE)
    now = pricing.premium_for(current.grade)
    assert (now.low, now.high) == (85_000, 120_000)

    best = pricing.premium_for("A")
    assert (best.low, best.high) == (45_000, 60_000)
    assert pricing.annual_saving(now, best) == 50_000      # document says ≈ ₹50,000


# --- rubric integrity ----------------------------------------------------

def test_weights_sum_to_one_hundred():
    assert sum(rubric.CHECK_POINTS.values()) == 100


def test_every_rule_belongs_to_a_known_check():
    for rule, (points, owner) in rubric.RULE_POINTS.items():
        assert owner in rubric.CHECK_POINTS, rule
        assert 0 <= points <= rubric.CHECK_POINTS[owner], rule


def test_unknown_rule_is_fatal():
    """A silently dropped rule is a finding shown and not charged for."""
    with pytest.raises(rubric.RubricError):
        rubric.score([finding("dmarc", "fail", "dmarc.made_up")])


# --- inconclusive handling ----------------------------------------------

def test_inconclusive_check_leaves_the_denominator():
    """Never grade a company well because our own scanner failed."""
    base = [f for f in WORKED_EXAMPLE if f["id"] != "subdomains"]
    with_inconclusive = base + [finding("subdomains", "inconclusive")]
    result = rubric.score(with_inconclusive)

    # 23 subdomain points gone as well as the 12 keyed points.
    assert result.available_points == 65
    assert result.deductions == 33              # 39 - the 6-point risk host
    assert result.inconclusive_points == 35


def test_grade_suppressed_when_too_much_is_unknown():
    result = rubric.score(
        [f for f in WORKED_EXAMPLE if f["id"] != "subdomains"]
        + [finding("subdomains", "inconclusive")]
    )
    assert result.inconclusive_points > rubric.INCONCLUSIVE_SUPPRESS_ABOVE
    assert result.grade_suppressed is True
    assert result.grade is None


def test_missing_check_counts_as_inconclusive_not_as_a_pass():
    partial = [f for f in WORKED_EXAMPLE if f["id"] != "tls"]
    result = rubric.score(partial)
    assert result.available_points == 73        # 88 - 15
    assert any(c.check_id == "tls" and c.inconclusive for c in result.categories)


def test_account_exposure_is_inconclusive_by_default():
    result = rubric.score(WORKED_EXAMPLE)
    keyed = next(c for c in result.categories if c.check_id == "creds_accounts")
    assert keyed.inconclusive is True
    assert keyed.max_points == 12


def test_account_exposure_scores_when_the_keyed_half_reports():
    """Tier 2 turns this on with no change to the rubric."""
    with_keyed = WORKED_EXAMPLE + [finding("creds_accounts", "fail", "creds.high")]
    result = rubric.score(with_keyed)
    assert result.available_points == 100
    assert result.deductions == 48              # 39 + 9
    assert result.inconclusive_points == 0


# --- caps ----------------------------------------------------------------

def test_category_deduction_is_capped():
    """Five exposed hosts is 30 raw points against a 23-point category."""
    many = [finding("subdomains", "fail", *["surface.risk_host"] * 5)]
    result = rubric.score(many)
    surface = next(c for c in result.categories if c.check_id == "subdomains")
    assert surface.raw_deducted == 30
    assert surface.deducted == 23
    assert surface.capped is True


def test_score_floors_at_zero_not_below():
    everything = [
        finding("dmarc", "fail", "dmarc.absent"),
        finding("spf", "fail", "spf.absent"),
        finding("dkim", "fail", "dkim.not_found"),
        finding("creds", "fail", "breach.multiple"),
        finding("tls", "fail", "tls.invalid"),
        finding("headers", "fail", "hdr.no_hsts", "hdr.no_csp",
                "hdr.no_framing_protection", "hdr.no_nosniff"),
        finding("subdomains", "fail", *["surface.risk_host"] * 6),
    ]
    result = rubric.score(everything)
    assert result.score == 0
    assert result.grade == "F"


# --- rounding ------------------------------------------------------------

def test_rounding_is_half_up_not_bankers():
    """round(56.5) is 56 in Python. On a grade boundary that decides a
    letter by parity, which is not something we can defend."""
    assert rubric._round_half_up(55.5) == 56
    assert rubric._round_half_up(56.5) == 57
    assert rubric._round_half_up(84.5) == 85


# --- grades --------------------------------------------------------------

@pytest.mark.parametrize("score_value,expected", [
    (100, "A"), (85, "A"), (84, "B"), (70, "B"),
    (69, "C"), (55, "C"), (54, "D"), (40, "D"), (39, "F"), (0, "F"),
])
def test_grade_boundaries(score_value, expected):
    assert grades.grade_for(score_value) == expected


def test_points_to_next_grade():
    assert grades.points_to_next_grade(56) == 14        # C -> B at 70
    assert grades.points_to_next_grade(84) == 1
    assert grades.points_to_next_grade(90) is None


# --- pricing -------------------------------------------------------------

def test_limit_multiplier_applies_to_the_base_table():
    base = pricing.premium_for("C")                          # ₹5 Cr
    smaller = pricing.premium_for("C", limit=10_000_000)     # ₹1 Cr, x0.45
    assert smaller.low == pricing._round(base.low * 0.45)
    assert smaller.limit == 10_000_000


def test_grade_f_is_referred_never_priced():
    f = pricing.premium_for("F")
    assert f.referred is True and f.low is None
    assert pricing.annual_saving(f, pricing.premium_for("A")) == 0


def test_suppressed_grade_is_referred():
    assert pricing.premium_for(None).referred is True


def test_premium_table_covers_every_grade():
    table = pricing.premium_table()
    assert set(table["by_grade"]) == set(grades.GRADES)
    assert table["by_grade"]["F"] is None
    assert table["by_grade"]["C"] == {"low": 85_000, "high": 120_000}


def test_headcount_band_defaults_to_the_smallest():
    assert pricing.band_for_headcount(None) == "under_5cr"
    assert pricing.band_for_headcount("51-200") == "5_25cr"
    assert pricing.band_for_headcount("200+") == "25_100cr"


# --- fixes ---------------------------------------------------------------

def test_fixes_are_built_from_the_worked_example():
    current = rubric.score(WORKED_EXAMPLE)
    fixes, summary = build_fixes(WORKED_EXAMPLE, current)

    by_id = {f.id: f for f in fixes}
    assert set(by_id) == {"dmarc", "spf", "hsts", "csp", "risk_hosts"}

    assert by_id["dmarc"].score_delta == 20         # 18 points over 88, rescaled
    assert by_id["dmarc"].grade_if_fixed == "B"
    assert by_id["dmarc"].saving > 0
    assert by_id["risk_hosts"].notes == ["staging.yourco.com"]

    assert summary["grade"] == "A"
    assert summary["annual_saving"] > 0


def test_fixes_are_ordered_by_value_per_hour():
    current = rubric.score(WORKED_EXAMPLE)
    fixes, _ = build_fixes(WORKED_EXAMPLE, current)
    assert [f.priority for f in fixes] == list(range(1, len(fixes) + 1))
    assert fixes[0].id == "dmarc"        # 20 points for 2 hours beats everything


def test_a_breach_is_never_offered_as_a_fix():
    """It cannot be undone. Offering it would be dishonest."""
    current = rubric.score(WORKED_EXAMPLE)
    fixes, _ = build_fixes(WORKED_EXAMPLE, current)
    assert all("breach" not in r for f in fixes for r in f.rules)


def test_a_fix_worth_nothing_is_not_offered():
    """Six risk hosts is past the 23-point cap; clearing one frees nothing,
    so we do not ask for the afternoon it would take."""
    capped = [
        finding("dmarc", "pass"), finding("spf", "pass"), finding("dkim", "pass"),
        finding("creds", "pass"), finding("tls", "pass"), finding("headers", "pass"),
        finding("subdomains", "fail", *["surface.risk_host"] * 4, "surface.sprawl"),
    ]
    current = rubric.score(capped)
    fixes, _ = build_fixes(capped, current)
    assert "subdomain_sprawl" not in {f.id for f in fixes}


def test_a_clean_domain_produces_no_fixes():
    clean = [finding(cid, "pass") for cid in
             ("dmarc", "spf", "dkim", "creds", "tls", "headers", "subdomains")]
    current = rubric.score(clean)
    assert current.score == 100 and current.grade == "A"
    fixes, summary = build_fixes(clean, current)
    assert fixes == []
    assert summary["annual_saving"] == 0


def test_strengths_come_from_passing_checks():
    from app.scoring.fixes import strengths
    found = strengths(WORKED_EXAMPLE)
    assert any("selector google" in s for s in found)


# --- reproducibility -----------------------------------------------------

def test_stored_findings_rescore_identically():
    """'Reproducible from findings + rubric_version' has to be literally
    true, including through a round trip to the database."""
    import json

    live = rubric.score(WORKED_EXAMPLE)
    replayed = rubric.score(json.loads(json.dumps(WORKED_EXAMPLE)))
    assert (replayed.score, replayed.grade, replayed.available_points) == \
           (live.score, live.grade, live.available_points)


def test_scoring_never_imports_ai():
    """The architectural rule, enforced rather than documented."""
    import pathlib
    root = pathlib.Path(__file__).resolve().parent.parent / "app" / "scoring"
    for path in root.glob("*.py"):
        # Import statements only — the prose in these modules talks about
        # the rule it is obeying, and that must not trip the check.
        for line in path.read_text().splitlines():
            stripped = line.strip()
            if not (stripped.startswith("import ") or stripped.startswith("from ")):
                continue
            assert ".ai" not in stripped and "app.ai" not in stripped, f"{path}: {stripped}"
