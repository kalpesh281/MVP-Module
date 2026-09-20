# Delivery Stages

Development is staged. Each stage is independently demoable, independently signable-off, and builds on the one before it.

| Stage | Name | Build | Demo moment |
|---|---|---|---|
| **1** | **Domain Scan** | 3 days | "Paste your domain → grade, premium, tick fixes, watch the price drop" |
| **2** | **Coverage Guidance** | 1.5 days | "How much cover do you need, why, and what a claim actually costs you" |
| **2.5** | **Tier 1 refinement** | 0.5 day | "Answer three questions, watch the range tighten from ±60% to ±30%" |
| 3+ | Contract parser, connectors, placement | later | see [vision.md](vision.md) |

**Stage 1 must be fully done, tested and accepted before Stage 2 starts.** Stage 2 reads data that Stage 1 produces; building them together means debugging both at once.

```
Stage 1 build  →  GATE 1  →  Stage 2 build  →  GATE 2  →  Stage 2.5  →  GATE 2.5
   3 days        test &        1.5 days          test &       0.5 day       test &
                 sign off                        sign off                   sign off
```

Every gate is defined in [testing.md](testing.md). **A red gate is never carried into the next stage.**

---

# Stage 1 — Domain Scan

> **Goal:** prove a founder will paste their domain, read the result, and ask about coverage.

## Scope

**In**

| Component | Detail |
|---|---|
| 5 passive checks | Email auth (SPF/DKIM/DMARC), breached credentials, TLS, security headers, subdomains — [scan-checks.md](scan-checks.md) |
| Deterministic scoring | 100-point rubric, A–F grade — [scoring-and-pricing.md](scoring-and-pricing.md) |
| Premium range | Grade × revenue band lookup, ₹5 Cr default limit |
| AI call 1 — classify | Homepage → company profile |
| AI call 2 — report | Findings → plain-English fixes with effort |
| Interactive fix simulator | Tick fixes → grade and premium animate, no network call |
| Strengths block | What they already do right |
| Tier 1 CTA | "Narrow it down →" |
| SSE streaming | Checks render as they complete |
| MongoDB persistence | Scans stored, 6-hour cache |
| Rate limiting | 10/hr per IP, 1 per domain per 6 hrs |

**Out** — deliberately, to protect the timeline

- Coverage recommendation and claim scenario → **Stage 2**
- Contract upload → Stage 3
- OAuth connectors, real quotes, accounts, dashboards, PDF export

## Build order

| Day | Backend | Frontend |
|---|---|---|
| **1** | `domain.py`, `base.py`, `email_auth.py`, `tls.py`, `headers.py`, `subdomains.py`, `creds.py`, `runner.py` | Vite scaffold, `tokens.css`, `DomainInput`, `useScan` **against a mocked SSE file** |
| **2** | `rubric.py`, `grades.py`, `pricing.py`, `fixes.py`, then `provider.py`, `classify.py`, `report.py`, `fallback.py` | `CheckFeed`, `CheckRow`, `GradeBadge`, `PremiumBand`, `Strengths` |
| **3** | `main.py` SSE, `db.py`, `store.py`, rate limiting | `FixList`, `simulate.js`, `CombinedRow`, `TierOneCta`, error states, responsive, a11y |

Build the deterministic path completely before adding AI. Build the frontend against a mock so it is never blocked on the backend.

## Dependencies

| Need | Blocking? |
|---|---|
| MongoDB Atlas URI | **Yes** |
| One AI provider key | **Yes** |
| HIBP API key | No — without it the credentials check returns `inconclusive` and its 20 points drop out of scoring |

## Acceptance — Stage 1 is done when

1. A valid domain produces a grade, a premium range, and at least one fix in under 30 seconds.
2. Checks stream individually — no bare spinner is ever shown.
3. Ticking any combination of fixes updates grade and premium instantly, with animation, **with no network call**.
4. The same domain scanned twice within 6 hours returns the cached result, labelled with its age.
5. **A scan with every AI provider key unset still produces a valid grade and premium.**
6. **The worked example in [scoring-and-pricing.md §6](scoring-and-pricing.md#6-worked-example) reproduces exactly** — score 54, grade D.
7. Nothing is asked of the user before the result is shown — no email, no modal.
8. No horizontal scroll at 320 px.
9. Every score is reproducible from `findings` + `rubric_version` alone.
10. A grade-A domain with zero fixes renders a valid "nothing to fix" state.

Items 5 and 6 are the ones people skip. Do not sign off without them.

## Demo script

```
0:00  Type their domain live
0:30  Checks stream in — say nothing, let them read
1:00  Grade and premium appear
1:15  Tick DMARC. Grade D → B. Premium ₹1,30,000 → ₹60,000.
      "Two hours of work. Seventy thousand rupees a year."
2:00  Questions
```

## What Stage 1 does **not** answer

Deliberately left open, because Stage 2 answers them:

- *"Why ₹5 Cr? Why not ₹1 Cr?"*
- *"What does this actually cost me if it happens?"*
- *"Would insurance even pay out?"*

If the client asks these in the Stage 1 demo, that is the signal that Stage 2 is the right next build. Say so.

---

# Stage 2 — Coverage Guidance

> **Goal:** turn a security scanner into a broker. Answer the questions Stage 1 provokes.

Full specification: [coverage-guidance.md](coverage-guidance.md).

## Scope

**In**

| Component | Detail |
|---|---|
| **Module A — limit recommendation** | Deterministic driver hierarchy selects a limit; AI writes the justification |
| Limit selector | ₹1 Cr / ₹5 Cr / ₹10 Cr — all three premiums shipped in the payload, switching is instant |
| Breach cost bands | Size × data type → cost range, used only to justify the recommendation |
| **Module B — claim scenario** | Four scenarios keyed to rule IDs, picked by highest deduction |
| Cost lines | Rendered verbatim from the catalog |
| Covered / not covered | Rendered verbatim from the catalog — **never AI-generated** |
| Sublimit warning | The line that makes an insurance person nod |
| Honest empty state | When nothing scores above 8 points, say so and set up the Tier 3 ask |

**Out**

- Contract-driven limits (the `contract` driver exists in the code but only fires once the contract parser ships in Stage 3)
- Data-type premium multipliers — inferred data types are not reliable enough to price on at Tier 0

## Build order

| Half-day | Work |
|---|---|
| **1** | `app/scoring/coverage.py` — driver hierarchy, breach cost bands, limit options with premiums |
| **2** | `app/scoring/scenarios.py` — catalog, trigger mapping, empty state |
| **3** | AI rationale + narrative calls, static fallbacks for both |
| **4** | Frontend: `CoverageBlock` with limit selector, `ScenarioBlock`, placement and responsive pass |

## Dependencies on Stage 1

| Needs from Stage 1 | Used for |
|---|---|
| `profile.data_types_handled` | Module A driver selection |
| `profile.estimated_size_band` | Module A driver + breach cost band |
| `findings[].deductions[].rule` | Module B trigger mapping |
| Premium lookup table | Limit options |

**Module B degrades gracefully if AI call 1 failed** — it keys off rule IDs, not the profile. Module A falls back to the `headcount` or `baseline` driver.

## Page placement

```
  Grade
  Coverage recommendation + limit selector     ← Module A  (new)
  What's holding you back (fix simulator)
  If someone spoofs your email tomorrow         ← Module B  (new)
  What you're already doing right
  Narrow it down →
```

Module A sits under the grade because "how much do I need" is the question the premium immediately provokes. Module B sits after the fix list so the reader knows what DMARC is before being told what it costs.

## Acceptance — Stage 2 is done when

1. A limit is recommended with a stated driver, and the reasoning names the specific reason (data type, headcount, or clause).
2. Switching between ₹1 Cr / ₹5 Cr / ₹10 Cr re-prices **instantly, with no network call**.
3. The recommendation is never higher than the breach cost band justifies — if the numbers don't support it, the lower limit is recommended.
4. A claim scenario renders, keyed to the highest-deduction finding, and links back to the corresponding fix.
5. Cost lines, covered, not-covered and sublimit text are **byte-identical to the catalog** — verify the AI has not altered them.
6. A clean domain (nothing above 8 points) renders the honest empty state, not a manufactured threat.
7. **Both modules render usefully with every AI key unset.**
8. Every rupee figure on screen carries "typically" or "estimated", and a disclaimer states these are pending insurer validation.

Item 5 is the one that matters most. In insurance, a model inventing a coverage claim is the one mistake you genuinely cannot make. Add a test that asserts the rendered strings equal the catalog strings.

## Demo script

Runs straight on from Stage 1:

```
2:00  "So it says ₹5 Cr. Why?"
2:15  Coverage block: "You hold customer PII, DPDP applies, a breach at your
      size typically runs ₹2–4 Cr. ₹1 Cr leaves you exposed."
      Switch to ₹1 Cr — premium drops, recommendation flags the gap.
3:00  Scroll to the scenario block.
      "If someone spoofs your email tomorrow — ₹26 L to ₹65 L.
       Covered under funds transfer fraud, but usually sublimited.
       And the transferred money itself isn't covered at all without a
       social engineering endorsement — which most policies don't have."
4:00  "That's the difference between a security scanner and a broker."
```

## Pre-demo checklist

- [ ] Every rupee figure carries "typically" or "estimated"
- [ ] A disclaimer states these are estimates pending insurer validation
- [ ] Sublimit and endorsement language checked against at least one **real Indian cyber policy wording** — ask any broker for a specimen
- [ ] Tested on a clean domain so the empty state has been seen at least once

---

# Stage 2.5 — Tier 1 refinement (0.5 day)

> **Goal:** make the "Narrow it down" CTA lead somewhere. Turn inferred facts into stated facts.

Tier 0 *infers* revenue, headcount and data types from the website. Tier 1 makes them **facts**, and the premium range tightens from ±60% to ±30%.

**It does not go tighter than that.** Knowing the company's size does not tell you whether MFA is enforced. ±15% needs verified controls, which is Tier 3. See the ladder in [overview.md](overview.md#the-tier-ladder).

## Scope

| Component | Detail |
|---|---|
| Three-step form | Revenue band → headcount → data types. One screen, step counter, no signup. **The promise stays "three questions"** — the fourth is optional and skippable, so the CTA copy remains true. |
| **Optional fourth question** | *"What brought you here today?"* — ten options, skippable. See [demand-triggers.md](demand-triggers.md). |
| `POST /api/scan/{id}/refine` | Loads the stored scan, re-runs the deterministic functions with real inputs |
| Data-type premium multipliers | Unlocked here, because the data types are now stated rather than inferred |
| Re-rendered result | Tighter premium, firmer limit, possibly a different claim scenario |

**Out** — no re-scan. The security posture did not change.

## The rule that protects trust

> **The grade must not move.** Only premium precision, recommended limit, and scenario selection may change.

A grade that shifts when a user answers a question destroys confidence in the grade. Assert it in a test.

## Build order

| Half-day | Work |
|---|---|
| **1** | `refine.py` endpoint, `DemandTrigger` enum, storage; frontend four-step form and re-render |

Acceptance: [testing.md — GATE 2.5](testing.md#gate-25--tier-1-refinement).

---

# After Stage 2.5

| Stage | Scope | Why it comes next |
|---|---|---|
| **3** | **Contract parser** | Activates the `contract` driver in Module A — the strongest version of the recommendation, grounded in fact rather than inference. One day, and nobody in India does it. |
| **4** | Copy-paste fixes, peer benchmark, shareable grade card | Cheap, high impact on conversion |
| **5** | OAuth connectors (Tier 3) | The evidence layer — the actual moat |
| **6** | Broker partnership, placement | Not engineering. Start the conversation now; it takes months. |

Full roadmap: [vision.md](vision.md).

---

# Standing rules across all stages

1. **AI explains. It never scores and never prices.** Every stage must work with the AI layer entirely offline.
2. **`scoring/` never imports from `ai/`.** Enforce in review.
3. **Never ask before giving.** Nothing is requested from the user before the result is shown.
4. **Passive scanning only.** No probing infrastructure we don't own.
5. **Every number is versioned.** `rubric_version` and `rate_version` on every stored scan.
6. **A stage is done when its gate is green.** Not when it runs. See [testing.md](testing.md).
7. **The demand trigger is presentation and routing only.** It must never reach `scoring/`, and answering it is never required.
8. **Every stage teaches something.** If a screen adds a number without explaining it, it isn't finished. See [education-layer.md](education-layer.md).
