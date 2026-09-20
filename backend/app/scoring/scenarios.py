"""Module B — what this finding costs if it happens.

The block that stops the page being a security tool. It names a **sublimit**
and an **endorsement gap**, which are the two things that actually decide
whether a cyber claim pays, and which no security vendor would think to
mention.

The hard rule, and the reason this file is a table rather than a prompt:

> **Cost lines, covered, not-covered and the sublimit warning are rendered
> byte-identical from this catalog.** The model writes the title and a
> two-sentence narrative. Nothing else.

A model that invents a coverage statement is the single mistake this
product genuinely cannot make. Everything else on the page can be argued
about; "your policy covers this" cannot be wrong. So it is not generated.

PROVENANCE, checked 2026-09-20 (docs/policy-wording-evidence.md).

The coverage language below was written from LMA model clauses and has now
been checked line by line against a real, filed, Indian **commercial**
cyber wording: Bajaj Cyber Protect Premium — Digital Business and Data
Protection Insurance, UIN IRDAN113CP0002V02201516. Two of the four
`not_covered` / `sublimit_warning` lines were wrong and are corrected
here. One of them described a cover that does not exist, which is exactly
the failure this module was built to prevent.

The rupee figures remain directional. They are not taken from Indian
claims data, because no public source breaks Indian breach cost down by
company size — IBM's India figure surveys large organisations and does
not segment. Every surface that renders them must carry "typically" or
"estimated". docs/coverage-guidance.md Module B
"""

from __future__ import annotations

from typing import Any

from .fixes import CATALOG as FIX_CATALOG
from .rubric import RULE_POINTS

# Below this, we do not show a scenario. An honest empty state is a
# stronger signal than a manufactured threat, and it sets up the Tier 3
# ask instead of burning credibility on a ₹4-point header finding.
MIN_POINTS_FOR_SCENARIO = 8


# --- the catalog ---------------------------------------------------------
#
# Order matters: it is the deterministic tie-break when two scenarios carry
# the same weight. Most-severe first.
CATALOG: dict[str, dict[str, Any]] = {
    "ransomware": {
        "title": "If that staging server is your way in",
        "triggers": ("surface.risk_host", "surface.directory_listing"),
        "cost_lines": [
            {"label": "Ransom, if paid",        "low": 2_000_000, "high": 8_000_000},
            {"label": "Recovery and forensics", "low": 1_500_000, "high": 4_000_000},
            {"label": "Business interruption",  "low": 1_000_000, "high": 5_000_000},
        ],
        "covered": ["Cyber extortion", "Digital asset restoration", "Business interruption"],
        # Waiting Period is defined by the schedule, not by the wording
        # (Bajaj cl. 3.59), so we no longer assert "8–12 hours" as though
        # the policy said it. Indian market commentary puts it commonly at
        # 24 hours. The 180-day cap is the wording's own (cl. 3.34) and is
        # the part founders never expect.
        "sublimit_warning": (
            "Business interruption is sublimited, and it only starts paying after "
            "a waiting period set in your schedule — commonly 24 hours in India. "
            "It also stops after 180 days, however long the disruption lasts."
        ),
        # Confirmed almost word for word: "the costs to design, upgrade,
        # maintain, or improve a Computer System or Computer Programme,
        # including correcting any deficiencies or problems" (cl. 3.19(f)).
        "not_covered": (
            "Betterment. The policy restores what you had. The cost of upgrading, "
            "or of fixing what was already wrong, is excluded."
        ),
    },
    "account_takeover": {
        "title": "If one of those leaked passwords still works",
        "triggers": ("creds.medium", "creds.high", "creds.severe"),
        "cost_lines": [
            {"label": "Incident response",     "low": 1_000_000, "high": 2_500_000},
            {"label": "Regulatory response",   "low": 500_000,   "high": 2_000_000},
            {"label": "Customer notification", "low": 300_000,   "high": 1_500_000},
        ],
        "covered": ["Network security liability", "Privacy liability", "Regulatory defence"],
        # Fines are covered (cl. 1.4) but sublimited, and the definition
        # only reaches fines "that are insurable by the law applicable"
        # (cl. 3.27). For DPDP penalties specifically, Marsh India and
        # Khaitan & Co conclude there is reasonable support but no
        # certainty — so we say unsettled, not covered and not excluded.
        "sublimit_warning": (
            "Regulatory fines carry their own sublimit, and the policy only pays "
            "fines that are insurable under Indian law. Whether a DPDP Act penalty "
            "qualifies has not been settled."
        ),
        # Exclusion 4.3 excludes liability assumed under any contract
        # except where it would have attached anyway; cl. 3.19(g) excludes
        # contractual penalties outside clauses 1.4 and 1.5.
        "not_covered": (
            "Penalties your own customers charge you under their contract. "
            "Liability you took on by agreement is excluded unless it would have "
            "applied to you anyway."
        ),
    },
    "email_spoof": {
        "title": "If someone spoofs your email tomorrow",
        "triggers": ("dmarc.absent", "dmarc.monitor_only", "spf.permissive"),
        "cost_lines": [
            {"label": "Typical fraudulent transfer",  "low": 1_500_000, "high": 4_000_000},
            {"label": "Forensics and legal",          "low": 800_000,   "high": 1_500_000},
            {"label": "Customer notification (DPDP)", "low": 300_000,   "high": 1_000_000},
        ],
        # NOT "Funds transfer fraud". That was in this list while the
        # warning below said the same wording does not cover it — the two
        # lines contradicted each other on screen. What actually responds
        # to a spoof that reaches a customer is the privacy/breach side
        # (cl. 1.1) and the services (cl. 1.9, 1.10). Never the money.
        "covered": ["Breach response costs", "Privacy liability", "Crisis communication"],
        # This was the worst line in the file. It warned about a sublimit
        # on a cover that the wording does not contain at all: "social
        # engineering", "funds transfer" and "phishing" appear zero times
        # in it. The theft cover that exists (IT-Theft, cl. 3.36) requires
        # "targeted intrusion ... which results in fraudulent and
        # unauthorised deletion or alteration of Data" — an employee who
        # was tricked into paying fails that test, because nobody broke in.
        "sublimit_warning": (
            "A standard Indian cyber wording does not cover this at all. The theft "
            "cover it does carry requires an attacker to have broken in and altered "
            "your data — being tricked into paying does not meet that test."
        ),
        "not_covered": (
            "The money itself, unless you have bought a social engineering or funds "
            "transfer fraud endorsement. Ask for it by that name; it is not standard."
        ),
    },
    "web_compromise": {
        "title": "If your site is used to attack your customers",
        "triggers": ("hdr.no_csp", "tls.invalid"),
        "cost_lines": [
            {"label": "Forensics",          "low": 800_000,   "high": 2_000_000},
            {"label": "Notification",       "low": 300_000,   "high": 1_200_000},
            {"label": "Third-party claims", "low": 1_000_000, "high": 5_000_000},
        ],
        "covered": ["Network security liability", "Media liability"],
        # Every limb of the Business Interruption Event definition
        # (cl. 3.5) is about "the Company's Computer System". A vendor
        # outage is not an omission from the schedule — it is outside the
        # trigger. "May exclude vendors the policy does not name" was too
        # soft: there is no dependent business interruption cover here.
        "sublimit_warning": (
            "Business interruption covers your own systems. If the outage is at a "
            "cloud or SaaS provider you depend on, a standard wording does not "
            "respond at all."
        ),
        # The old line referred to "the policy's defined reputational harm
        # cover". There is no such cover — the word "reputation" does not
        # appear in the wording. Crisis Communication (cl. 1.9) pays public
        # relations expenses, sublimited, and nothing more. Naming a cover
        # that does not exist is the one mistake this module exists to stop,
        # and this module was making it.
        "not_covered": (
            "Lost customers and reputational damage. Public relations costs are "
            "covered and sublimited; the revenue that walks away afterwards is not."
        ),
    },
}

EMPTY_STATE: dict[str, Any] = {
    "id": None,
    "title": "Your exposure is mostly in what we can't see from outside",
    "body": (
        "External posture looks reasonable. The remaining risk sits in access "
        "control, backups and endpoint coverage — things that need a connected "
        "account to verify."
    ),
}

# rule id -> scenario id. Built from the catalog so the two cannot drift.
TRIGGERS: dict[str, str] = {
    rule: scenario_id
    for scenario_id, scenario in CATALOG.items()
    for rule in scenario["triggers"]
}

# rule id -> the fix that clears it. Derived from the fix catalog rather
# than typed out again: `link_to_fix` has to name a fix that is actually on
# the page, and a second hand-written mapping is how that stops being true.
_RULE_TO_FIX: dict[str, str] = {
    rule: definition.id
    for definition in FIX_CATALOG
    for rule in definition.rules
}


def _triggered_rules(findings: list[dict[str, Any]]) -> list[str]:
    rules: list[str] = []
    for finding in findings:
        if finding.get("status") == "inconclusive":
            continue
        for deduction in finding.get("deductions", ()):
            rule = deduction["rule"] if isinstance(deduction, dict) else deduction.rule
            if rule in TRIGGERS:
                rules.append(rule)
    return rules


def select(findings: list[dict[str, Any]]) -> tuple[str | None, str | None, int]:
    """Pick the scenario, its trigger rule, and the weight behind it.

    Weight is the **sum** of every triggering rule's points, not the single
    largest. `surface.risk_host` fires once per exposed host at 6 points
    each, so a company with five reachable internal boxes scores 30 and the
    ransomware scenario wins — which is plainly the right answer, and is
    not what picking the largest single rule would have produced.

    Ties break on catalog order, which is declared most-severe first. Two
    scenarios at equal weight is a real possibility and must not depend on
    dict iteration luck.
    """
    totals: dict[str, int] = {}
    best_rule: dict[str, tuple[int, str]] = {}

    for rule in _triggered_rules(findings):
        scenario_id = TRIGGERS[rule]
        points = RULE_POINTS.get(rule, (0, ""))[0]
        totals[scenario_id] = totals.get(scenario_id, 0) + points
        if points > best_rule.get(scenario_id, (-1, ""))[0]:
            best_rule[scenario_id] = (points, rule)

    if not totals:
        return None, None, 0

    order = list(CATALOG)
    scenario_id = min(totals, key=lambda sid: (-totals[sid], order.index(sid)))
    weight = totals[scenario_id]
    if weight <= MIN_POINTS_FOR_SCENARIO:
        return None, None, weight
    return scenario_id, best_rule[scenario_id][1], weight


def _render(scenario_id: str, trigger_rule: str, weight: int) -> dict[str, Any]:
    scenario = CATALOG[scenario_id]
    return {
        "id": scenario_id,
        "empty": False,
        "weight": weight,
        "trigger_rule": trigger_rule,
        "title": scenario["title"],
        "narrative": "",
        "cost_lines": [dict(line) for line in scenario["cost_lines"]],
        "total": {
            "low": sum(line["low"] for line in scenario["cost_lines"]),
            "high": sum(line["high"] for line in scenario["cost_lines"]),
        },
        "covered": list(scenario["covered"]),
        "sublimit_warning": scenario["sublimit_warning"],
        "not_covered": scenario["not_covered"],
        "link_to_fix": _RULE_TO_FIX.get(trigger_rule),
    }


def rank(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every scenario this company qualifies for, worst first.

    The result page ships all of them, not just the top one, so that
    ticking the fix which closes a scenario can reveal the next exposure
    underneath it — in the browser, with no request in flight, the same
    way the premium reprices.

    Without this the page simulated in two places and not in the third:
    ticking DMARC moved the grade and the premium while the block below
    still described the email spoof that DMARC prevents.
    """
    totals: dict[str, int] = {}
    best_rule: dict[str, tuple[int, str]] = {}

    for rule in _triggered_rules(findings):
        scenario_id = TRIGGERS[rule]
        points = RULE_POINTS.get(rule, (0, ""))[0]
        totals[scenario_id] = totals.get(scenario_id, 0) + points
        if points > best_rule.get(scenario_id, (-1, ""))[0]:
            best_rule[scenario_id] = (points, rule)

    order = list(CATALOG)
    qualifying = [sid for sid, weight in totals.items()
                  if weight > MIN_POINTS_FOR_SCENARIO]
    qualifying.sort(key=lambda sid: (-totals[sid], order.index(sid)))
    return [_render(sid, best_rule[sid][1], totals[sid]) for sid in qualifying]


def build(findings: list[dict[str, Any]]) -> dict[str, Any]:
    """The scenario block, verbatim from the catalog.

    `narrative` is left empty for the AI layer to fill. If it never does,
    the block still renders: a title, real cost lines, and the two lines
    about cover that are the reason this module exists.
    """
    scenario_id, trigger_rule, weight = select(findings)
    if scenario_id is None:
        return dict(EMPTY_STATE, empty=True)
    return _render(scenario_id, trigger_rule or "", weight)


# --- replaying a stored scan --------------------------------------------

# The fields this module owns absolutely. On a cached replay these are
# re-rendered from the catalog above rather than read back from the
# database.
_CATALOG_FIELDS = ("cost_lines", "total", "covered", "sublimit_warning", "not_covered")


def refresh(stored: dict[str, Any] | None) -> dict[str, Any] | None:
    """Re-render the catalog-owned fields of a scenario read from storage.

    Without this, the product's hardest rule quietly weakens from

        coverage text is byte-identical to the catalog

    to

        coverage text is byte-identical to whatever the catalog said on
        the day the scan ran.

    Which is not the same promise. On 2026-09-20 four catalog lines were
    corrected against a real filed Indian wording — one of them named a
    reputational harm cover that does not exist — and every cached scan
    would have kept serving the wrong text until it aged out. A correction
    that does not reach the reader is not a correction.

    Only the five catalog fields move. `title` and `narrative` are the AI
    layer's and are left exactly as stored, because regenerating them
    would mean a model call on a cache hit. Nothing numeric outside the
    catalog is touched, so no stored score or premium can shift.

    An id we no longer recognise is returned untouched: a scenario retired
    from the catalog should replay as it was, not vanish.
    """
    if not stored or stored.get("empty") or stored.get("id") not in CATALOG:
        return stored
    fresh = _render(stored["id"], stored.get("trigger_rule") or "", stored.get("weight", 0))
    return {**stored, **{key: fresh[key] for key in _CATALOG_FIELDS}}


def refresh_all(stored: list[dict[str, Any]] | None) -> list[dict[str, Any]] | None:
    if not stored:
        return stored
    return [refresh(item) for item in stored]
