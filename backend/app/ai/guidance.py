"""Calls 4 and 5 — the prose for the two coverage blocks.

Both blocks already exist as numbers before this module runs. Module A has
its limit, its three priced options and its breach cost band. Module B has
its cost lines and the two sentences about what a policy does and does not
pay. This module writes the English around them and is allowed to change
nothing.

Two design notes worth stating, because both were decisions:

**One request, not two.** The scan already spends its entire budget, and
the report call is issued concurrently with this one. Two extra sequential
round trips would push every scan past `SCAN_HARD_LIMIT` for prose the
reader cannot tell apart.

**The catalog text is never sent for rewriting.** The model is told what
was found and who the company is. It is not shown the covered /
not-covered lines, because a model that has been handed a coverage
statement will eventually paraphrase one.

With no provider key set, both blocks still render — the limit, the
options, the cost lines and the sublimit warning are all computed, and the
static copy below stands in for the narrative.
docs/coverage-guidance.md, docs/ai-layer.md
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ..config import AI_MAX_TOKENS
from . import fallback
from .provider import AllProvidersFailed
from .registry import client_for
from .schemas import CompanyProfile, Guidance

log = logging.getLogger(__name__)

SYSTEM = """You write two short blocks for a cyber insurance report aimed at \
Indian startup founders who are not insurance people.

BLOCK 1 — the cover amount. A rules engine has already chosen the limit. You
justify the one you are given.
- Never suggest a different limit. Never state a rupee figure other than the
  breach cost band you are given.
- Always name the specific reason: the data type, the headcount, or the
  contract clause. "Because cyber risk is rising" is not a reason.
- Quote the breach cost band exactly as it is given to you, character for
  character. Do not convert it, round it, or restate it in other units.
  "This aligns with the cost band" tells the reader nothing.
- Never describe how the number was produced. No "the rules engine", no
  "our model", no "the system determined". The reader wants the reason, not
  our plumbing. Say "you handle financial data", never "because you were
  classified as handling financial data".
- When the driver is `contract`, quote the clause reference and say plainly
  that this is a contractual obligation, not our advice.
- reasoning is two to three sentences. downside is one, and it names the
  next limit down and what it leaves with them.

BLOCK 2 — the claim scenario. Two sentences describing how this specific
company gets hit, using its own business model.
- Never say what is or is not covered by insurance. That text is fixed and
  comes from elsewhere. If you write a coverage statement it will be discarded.
- Never state a cost figure. The costs are shown separately.
- No fear language, no exclamation marks, no "you could lose everything".
  Calm and factual, the way a broker who has seen it before would say it.
- Skip this block entirely if you are not given a scenario.

Across both: British spelling, second person, no hedging, no marketing."""


def _band_label(band: dict[str, int]) -> str:
    return f"{fallback._rupees(band['low'])}–{fallback._rupees(band['high'])}"


def _prompt(
    domain: str,
    coverage: dict[str, Any],
    scenario: dict[str, Any] | None,
    profile: CompanyProfile | None,
) -> str:
    payload: dict[str, Any] = {
        "domain": domain,
        "cover": {
            "recommended_limit_label": coverage["recommended_limit_label"],
            "why_this_limit": coverage["driver"],
            "contract_clause": coverage.get("source"),
            # Pre-formatted, never raw rupees. Handed the integers
            # 50000000 and 150000000 the model rendered them "₹50 L–₹150 L"
            # — a tenfold understatement of the cost band its own
            # recommendation rests on. It does not do arithmetic here
            # because it is never given anything to do arithmetic on.
            "breach_cost_band": _band_label(coverage["breach_cost_band"]),
            "options_offered": [o["limit_label"] for o in coverage["options"]],
        },
    }
    if scenario is not None and not scenario.get("empty"):
        # Deliberately not `covered`, `not_covered` or `sublimit_warning`.
        payload["scenario"] = {
            "what_we_found": scenario["trigger_rule"],
            "working_title": scenario["title"],
        }
    if profile is not None:
        payload["company"] = {
            "name": profile.company_name,
            "what_they_do": profile.what_they_do,
            "business_model": profile.business_model,
            "data_types": profile.data_types_handled,
            "size_band": profile.estimated_size_band,
            "dpdp_applies": profile.dpdp_act_applies,
        }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def apply_static(coverage: dict[str, Any], scenario: dict[str, Any] | None) -> None:
    """Fill anything the model did not. Mutates in place."""
    coverage.setdefault("rationale", {})
    written = coverage["rationale"]
    default = fallback.coverage_rationale(
        driver=coverage["driver"],
        limit_label=coverage["recommended_limit_label"],
        band=coverage["breach_cost_band"],
        clause=coverage.get("source"),
    )
    for key, value in default.items():
        if not written.get(key):
            written[key] = value

    if scenario and not scenario.get("empty") and not scenario.get("narrative"):
        scenario["narrative"] = fallback.scenario_narrative(scenario["id"])


async def write(
    domain: str,
    coverage: dict[str, Any],
    scenario: dict[str, Any] | None = None,
    profile: CompanyProfile | None = None,
) -> str | None:
    """Attach prose to both blocks. Never raises. Returns the model used,
    or None when static copy was used.

    `coverage` and `scenario` are mutated in place: the caller keeps the
    same dicts with their numbers untouched and their text filled in.
    """
    generated_by: str | None = None
    client = client_for("guidance")

    if client is None:
        log.info("guidance using static copy for %s: no provider key set", domain)
    else:
        try:
            written, generated_by = await client.parse(
                system=SYSTEM,
                user=_prompt(domain, coverage, scenario, profile),
                schema=Guidance,
                max_tokens=AI_MAX_TOKENS,
            )
        except AllProvidersFailed as exc:
            log.warning("guidance failed for %s, using static copy: %s", domain, exc)
        else:
            coverage["rationale"] = {
                "headline": written.coverage.headline.strip(),
                "reasoning": written.coverage.reasoning.strip(),
                "downside": written.coverage.downside.strip(),
            }
            # A scenario the model wrote for a block we are not rendering
            # is dropped rather than shown. Same rule as an invented fix.
            if written.scenario is not None and scenario and not scenario.get("empty"):
                if written.scenario.title.strip():
                    scenario["title"] = written.scenario.title.strip()
                scenario["narrative"] = written.scenario.narrative.strip()
            elif written.scenario is not None:
                log.warning("guidance wrote a scenario for %s with none to render", domain)

    apply_static(coverage, scenario)
    return generated_by
