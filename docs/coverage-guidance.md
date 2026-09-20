# Coverage Guidance Modules

Two blocks on the Tier 0 result page that turn a security scanner into a broker.

| Module | Answers | Effort |
|---|---|---|
| **A. Limit recommendation** | "How much cover do I actually need, and why?" | ~0.5 day |
| **B. Claim scenario** | "What does this finding cost me if it happens?" | ~1 day |

Both follow the project's core rule: **the numbers are deterministic, the prose is AI.** See [ai-layer.md §1](ai-layer.md#1-boundaries--what-ai-may-and-may-not-do).

> ⚠️ **Every rupee figure in this document is a PLACEHOLDER.** They are directional estimates built from public claim-cost patterns, not Indian loss data. They must be validated with an insurer partner before being presented as anything but an estimate. Every surface that renders them must carry the word "typically" or "estimated".

---

# Module A — Limit recommendation

## What it renders

```
─────────────────────────────────────────────────────────────
  RECOMMENDED COVER

        ₹5 Cr          estimated premium ₹85,000 – 1,20,000 / yr

  You hold customer personal data and the DPDP Act applies to you.
  For a company your size, a breach typically costs ₹2–4 Cr once
  notification, forensics, legal and regulatory response are counted.
  ₹1 Cr would leave you exposed.

  ○ ₹2 Cr    ● ₹5 Cr    ○ ₹10 Cr        ← switching re-prices instantly
─────────────────────────────────────────────────────────────
```

Making the limit selectable matters. It shows the premium is a function of a decision they control, not a quoted price they must accept.

**The three options are chosen dynamically**, never hardcoded. Take the limit ladder from [scoring-and-pricing.md §4.3](scoring-and-pricing.md#43-limit-multipliers) — ₹1 Cr · ₹2 Cr · ₹5 Cr · ₹10 Cr · ₹25 Cr — and show the recommended rung plus the one below and the one above. At the ends of the ladder, shift the window inward so three options always render.

```python
LADDER = [10_000_000, 20_000_000, 50_000_000, 100_000_000, 250_000_000]

def options_for(recommended: int) -> list[int]:
    i = LADDER.index(recommended)
    i = max(1, min(i, len(LADDER) - 2))     # keep a full window at the ends
    return LADDER[i - 1 : i + 2]
```

This matters because the `baseline` driver recommends **₹2 Cr**. A fixed ₹1/₹5/₹10 selector would not contain that company's own recommendation.

## Selection logic — deterministic

`app/scoring/coverage.py`

```python
def recommend_limit(profile: CompanyProfile, contract_req: dict | None = None) -> Recommendation:
    # 1. A contract requirement always wins.
    if contract_req and contract_req.get("cyber_limit"):
        return Recommendation(limit=contract_req["cyber_limit"],
                              driver="contract", source=contract_req["clause_reference"])

    # 2. Otherwise, the worst applicable data driver sets the floor.
    data = set(profile.data_types_handled)
    size = profile.estimated_size_band

    if data & {"PHI", "payment_card"}:            return _rec(100_000_000, "sensitive_data")
    if "financial" in data:                       return _rec(100_000_000, "financial_data")
    if "PII" in data and size in {"51-200","200+"}: return _rec(100_000_000, "pii_at_scale")
    if "PII" in data:                             return _rec(50_000_000,  "pii")
    if size in {"51-200","200+"}:                 return _rec(50_000_000,  "headcount")
    return _rec(20_000_000, "baseline")
```

| Driver | Condition | Recommended limit |
|---|---|---|
| `contract` | A customer MSA specifies a limit (Tier 5) | Whatever the clause says — **always overrides** |
| `sensitive_data` | Health data or payment card data | ₹10 Cr |
| `financial_data` | Financial/transactional data | ₹10 Cr |
| `pii_at_scale` | Personal data + 51 or more staff | ₹10 Cr |
| `pii` | Personal data, smaller company | ₹5 Cr |
| `headcount` | No sensitive data, 51 or more staff | ₹5 Cr |
| `baseline` | B2B only, small, no sensitive data | ₹2 Cr |

**The contract driver is the most important row.** It is the only one grounded in fact rather than inference, and it is the bridge to the contract parser at Tier 5. When it fires, the copy changes to quote the clause:

> *"Your MSA with Acme Retail, Clause 14.2, requires ₹5 Cr cyber liability with additional insured status. That's not our recommendation — it's your contractual obligation."*

That sentence is worth more than the entire scan.

## Breach cost bands — PLACEHOLDER

Used only to justify the recommendation in prose.

| Company size | Typical total breach cost |
|---|---|
| 1–10 | ₹40 L – 1.2 Cr |
| 11–50 | ₹1 – 3 Cr |
| 51–200 | ₹2 – 6 Cr |
| 200+ | ₹5 – 15 Cr |

Multipliers: health data ×2.0 · payment card ×1.6 · consumer PII over 100k records ×1.5.

**Show the recommendation only when the cost band exceeds the next limit down.** If the numbers don't justify the recommendation, recommend the lower limit. A recommendation that doesn't follow from its own stated reasoning is worse than no recommendation.

## Copy — AI writes, never computes

```python
class CoverageRationale(BaseModel):
    headline: str       # "Recommended: ₹5 Cr"
    reasoning: str      # 2–3 sentences, plain English
    downside: str       # what the next limit down leaves exposed
```

System prompt additions:

```
You justify a cyber insurance limit that has already been chosen by a rules
engine. You are given: the recommended limit, the driver that selected it, the
company profile, and the breach cost band.

- Never recommend a different limit than the one given.
- Never state a cost figure other than the band provided.
- Always name the specific reason (data type, headcount, or contract clause).
- When the driver is `contract`, quote the clause reference and say plainly that
  this is an obligation, not advice.
- Two to three sentences. No hedging.
```

---

# Module B — Claim scenario

## What it renders

Tied to the single highest-deduction finding.

```
─────────────────────────────────────────────────────────────
  IF SOMEONE SPOOFS YOUR EMAIL TOMORROW

  Typical fraudulent transfer          ₹15 – 40 L
  Forensics and legal                  ₹8 – 15 L
  Customer notification (DPDP)         ₹3 – 10 L
                                       ─────────────
  Typical total                        ₹26 L – 65 L

  ✓ Covered   Cyber extortion · funds transfer fraud
              ⚠ usually sublimited — commonly ₹50–80 L on a ₹5 Cr policy

  ✗ Not covered  The transferred money itself, unless your policy carries a
                 social engineering endorsement. Most standard policies don't.

  ─────────────────────────────────────────────────
  This is why you have no DMARC policy on the fix list above.
─────────────────────────────────────────────────────────────
```

The **"Not covered"** line is the point of the whole module. Anyone who has read a cyber policy will recognise it immediately, and it is the clearest possible signal that this was built by someone who understands insurance rather than only security.

## Scenario catalog — deterministic

`app/scoring/scenarios.py`. Keyed to rule IDs. Pick the scenario whose trigger rule has the highest deduction.

### `email_spoof` — triggered by `dmarc.absent`, `dmarc.monitor_only`, `spf.permissive`

| | |
|---|---|
| **Title** | If someone spoofs your email tomorrow |
| **Cost lines** | Fraudulent transfer ₹15–40 L · Forensics and legal ₹8–15 L · Notification ₹3–10 L |
| **Covered** | Funds transfer fraud, cyber extortion |
| **Sublimit warning** | Social engineering is commonly capped at ₹50–80 L on a ₹5 Cr policy |
| **Not covered** | The transferred money, without a social engineering endorsement |

### `account_takeover` — triggered by `creds.medium`, `creds.high`, `creds.severe`

| | |
|---|---|
| **Title** | If one of those leaked passwords still works |
| **Cost lines** | Incident response ₹10–25 L · Regulatory response ₹5–20 L · Customer notification ₹3–15 L |
| **Covered** | Network security liability, privacy liability, regulatory defence |
| **Sublimit warning** | Regulatory fines are frequently sublimited and are uninsurable in some jurisdictions |
| **Not covered** | Contractual penalties your customers impose under their MSA |

### `ransomware` — triggered by `surface.risk_host`, `surface.directory_listing`

| | |
|---|---|
| **Title** | If that staging server is your way in |
| **Cost lines** | Ransom (if paid) ₹20–80 L · Recovery and forensics ₹15–40 L · Business interruption ₹10–50 L |
| **Covered** | Cyber extortion, digital asset restoration, business interruption |
| **Sublimit warning** | BI has a waiting period, typically 8–12 hours — a shorter outage pays nothing |
| **Not covered** | Betterment — they restore what you had, not an upgrade |

### `web_compromise` — triggered by `hdr.no_csp`, `tls.invalid`

| | |
|---|---|
| **Title** | If your site is used to attack your customers |
| **Cost lines** | Forensics ₹8–20 L · Notification ₹3–12 L · Third-party claims ₹10–50 L |
| **Covered** | Network security liability, media liability |
| **Sublimit warning** | Dependent business interruption may exclude unnamed vendors |
| **Not covered** | Reputational loss beyond the policy's defined reputational harm cover |

### Fallback — no finding above 8 points

Do **not** invent a scenario. Render instead:

> **Your exposure is mostly in what we can't see from outside.**
> External posture looks reasonable. The remaining risk sits in access control, backups and endpoint coverage — things that need a connected account to verify. That's what Tier 3 does.

An honest empty state is a stronger signal than a manufactured threat, and it sets up the Tier 3 ask.

## Copy — AI writes, never computes

```python
class ClaimScenario(BaseModel):
    title: str
    narrative: str          # 2 sentences: how it happens to THIS company
    link_to_fix: str        # ties back to the fix list
```

Cost lines, covered/not-covered, and sublimit warnings are rendered **verbatim from the catalog**. The model writes only the title and the two-sentence narrative.

```
Rules:
- Use only the cost figures given. Never invent or adjust one.
- Never state that something is covered or not covered. That comes from the catalog.
- The narrative describes how this specific company gets hit, using its own
  business model from the profile. Two sentences.
- No fear language, no exclamation marks, no "you could lose everything".
  Factual and calm.
```

---

# Implementation notes

## Where these live

```
app/scoring/
├── coverage.py     # Module A: limit selection + breach cost bands
└── scenarios.py    # Module B: scenario catalog, trigger mapping
```

Both under `scoring/`, not `ai/` — they are rules, not generation. The existing rule stands: **`scoring/` must never import from `ai/`.**

## Result payload additions

```json
"coverage": {
  "recommended_limit": 50000000,
  "driver": "pii",
  "source": null,
  "options": [
    {"limit": 20000000,  "premium": {"low": 55250,  "high": 78000}},
    {"limit": 50000000,  "premium": {"low": 85000,  "high": 120000}, "recommended": true},
    {"limit": 100000000, "premium": {"low": 131750, "high": 186000}}
  ],
  "breach_cost_band": {"low": 10000000, "high": 30000000},
  "rationale": { "headline": "...", "reasoning": "...", "downside": "..." }
},
"scenario": {
  "id": "email_spoof",
  "trigger_rule": "dmarc.absent",
  "title": "If someone spoofs your email tomorrow",
  "narrative": "...",
  "cost_lines": [ {"label": "Typical fraudulent transfer", "low": 1500000, "high": 4000000} ],
  "covered": ["Funds transfer fraud", "Cyber extortion"],
  "sublimit_warning": "Social engineering is commonly capped at ₹50–80 L on a ₹5 Cr policy",
  "not_covered": "The transferred money, without a social engineering endorsement",
  "link_to_fix": "dmarc"
}
```

**All three limit options and their premiums ship in the payload**, so switching limits is instant and needs no network call — same pattern as the fix simulator.

Check the arithmetic against the multipliers: grade C, revenue under ₹5 Cr, ₹5 Cr base ₹85,000–1,20,000. ₹2 Cr = ×0.65 → 55,250–78,000. ₹10 Cr = ×1.55 → 1,31,750–1,86,000. **Every option in the payload must reproduce from the base table × the multiplier.** Add a test.

## Placement on the page

```
  Grade
  Coverage recommendation + limit selector      ← Module A
  What's holding you back (fix simulator)
  If someone spoofs your email tomorrow          ← Module B
  What you're already doing right
  Narrow it down →
```

Module B sits **after** the fix list so the reader already knows what DMARC is before being told what it costs. Module A sits directly under the grade because "how much do I need" is the question the premium immediately provokes.

## Failure handling

| Failure | Behaviour |
|---|---|
| AI rationale fails | Render the limit and a static template sentence per driver. The recommendation still appears. |
| AI narrative fails | Render the catalog title and cost lines with no narrative. The block still appears. |
| No profile (AI call 1 failed) | Module A falls back to the `headcount` or `baseline` driver. Module B still works — it keys off rule IDs, not the profile. |

Both modules degrade to something useful with the AI layer entirely offline. That is the standing requirement.

---

# Why these two are worth the day and a half

Everything else on the page is a security tool. These two blocks are insurance.

- Module A answers the question the premium creates and doesn't answer.
- Module B names a sublimit and an endorsement gap — **the specific things that decide whether a cyber claim actually pays.** Anyone in the insurance industry who sees that line knows immediately that this was not built by a security vendor.

## Before showing a client

- [ ] Every rupee figure carries "typically" or "estimated"
- [ ] A disclaimer states these are estimates pending insurer validation
- [ ] The sublimit and endorsement language has been checked against at least one real Indian cyber policy wording
- [ ] The contract driver is demoed at least once — it is the strongest version of Module A
