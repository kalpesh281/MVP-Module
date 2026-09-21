# Scoring and Pricing

**Rubric version:** `v1.1`
**Rate card version:** `v1.0`

---

## Principle

> **AI explains. It never scores and never prices.**

The score and the premium are produced by the deterministic rules in this document. They must be reproducible from the raw findings plus a version string, with no model in the loop.

Three reasons this is non-negotiable:

1. **Defensibility.** An insurer will not grant delegated underwriting authority to a black box. Every number we show must be traceable to a rule.
2. **Disputes.** When a customer says "that finding is wrong," we must show the rule, the evidence, and the points.
3. **Consistency.** The same domain scanned twice must produce the same score. A language model does not guarantee that.

Claude receives the computed score and deltas **as input** and writes the explanation around them. It never generates a number that reaches the user.

---

## 1. Score

Start at **100**. Apply deductions. Floor at 0.

### Weight allocation

| Category | Max deduction |
|---|---|
| Email authentication | 30 |
| Breached credentials | 20 |
| TLS and certificate | 15 |
| Security headers | 12 |
| Attack surface | 23 |
| **Total** | **100** |

### 1.1 Email authentication — 30 points

**DMARC — 18**

| Condition | Rule ID | Deduction |
|---|---|---|
| `p=reject` with `rua` reporting | `dmarc.enforcing` | 0 |
| `p=reject`, no `rua` | `dmarc.reject_no_reporting` | 3 |
| `p=quarantine` | `dmarc.quarantine` | 8 |
| `p=none` | `dmarc.monitor_only` | 13 |
| No DMARC record | `dmarc.absent` | 18 |

**SPF — 7**

| Condition | Rule ID | Deduction |
|---|---|---|
| Valid, ends `-all` | `spf.strict` | 0 |
| Valid, ends `~all` | `spf.softfail` | 3 |
| Ends `?all` or `+all` | `spf.permissive` | 6 |
| No SPF record | `spf.absent` | 7 |
| More than 10 DNS lookups (invalid per RFC) | `spf.lookup_overflow` | 4 |

**DKIM — 5**

| Condition | Rule ID | Deduction |
|---|---|---|
| Record found at a probed selector | `dkim.present` | 0 |
| No record at any probed selector | `dkim.not_found` | 5 |

`dkim.not_found` is reported as a **warning**, never a failure — a custom selector may exist that we cannot enumerate.

### 1.2 Breach exposure — 20 points, in two halves

The useful data sits behind two different HIBP endpoints with different
access rules, so the category splits along that line.

**A. Breach history — 8 points.** Free, keyless, available for any domain.
Has this company itself had a disclosed breach? This is prior-incident
history, which is a question on every real proposal form.

| Condition | Rule ID | Deduction |
|---|---|---|
| No disclosed breach on record | `breach.none` | 0 |
| One breach, older than 3 years | `breach.historic` | 3 |
| One breach within 3 years | `breach.recent` | 8 |
| More than one disclosed breach | `breach.multiple` | 8 |

**B. Account exposure — 12 points.** Requires an HIBP key **and** proof of
domain ownership, which we do not have for a domain scanned cold. At Tier 0
this half is `inconclusive` and its 12 points leave the denominator. It
unlocks at Tier 2, once the user has verified their own domain by email.

| Accounts found | Rule ID | Deduction |
|---|---|---|
| 0 | `creds.clean` | 0 |
| 1–5 | `creds.low` | 4 |
| 6–20 | `creds.medium` | 6 |
| 21–100 | `creds.high` | 9 |
| 100+ | `creds.severe` | 12 |

> **Why this split rather than dropping the category.** The obvious
> alternative — no key, no check, 20 points out of the denominator — throws
> away a signal that is free and that underwriters genuinely ask about. A
> company with two disclosed breaches is a different risk from one with
> none, and we can establish that for nothing. Half a signal beats none.
>
> **Never display a count we cannot substantiate.** Without a key we say
> "no disclosed breach on record", never "no leaked credentials" — those
> are different claims and only the first one is true.

### 1.3 TLS and certificate — 15 points

Deductions accumulate, capped at 15.

| Condition | Rule ID | Deduction |
|---|---|---|
| Expired, invalid chain, or hostname mismatch | `tls.invalid` | 15 |
| Self-signed | `tls.self_signed` | 12 |
| TLS 1.0 or 1.1 accepted | `tls.legacy_protocol` | 8 |
| Certificate expires within 14 days | `tls.expiring_urgent` | 6 |
| Certificate expires within 30 days | `tls.expiring_soon` | 3 |
| No HTTPS redirect from HTTP | `tls.no_redirect` | 4 |

### 1.4 Security headers — 12 points

| Missing header | Rule ID | Deduction |
|---|---|---|
| `Strict-Transport-Security` | `hdr.no_hsts` | 5 |
| `Content-Security-Policy` | `hdr.no_csp` | 4 |
| `X-Frame-Options` or CSP `frame-ancestors` | `hdr.no_framing_protection` | 2 |
| `X-Content-Type-Options: nosniff` | `hdr.no_nosniff` | 1 |

### 1.5 Attack surface — 23 points

Deductions accumulate, capped at 23.

| Condition | Rule ID | Deduction |
|---|---|---|
| Live host matching a risk pattern (`staging`, `admin`, `jenkins`, …) reachable, per host | `surface.risk_host` | 6 |
| Directory listing enabled on any host | `surface.directory_listing` | 7 |
| Host serving HTTP only, no TLS | `surface.plaintext_host` | 4 |
| More than 50 live subdomains | `surface.sprawl` | 3 |

Full risk-pattern list: [scan-checks.md](scan-checks.md#5-attack-surface--subdomains).

---

## 2. Grade

| Grade | Score |
|---|---|
| **A** | 85 – 100 |
| **B** | 70 – 84 |
| **C** | 55 – 69 |
| **D** | 40 – 54 |
| **F** | 0 – 39 |

The **grade** is what the page leads with. The numeric score is internal — shown on hover and in exports only.

Rationale: SecurityScorecard uses an A–F scale specifically so non-security stakeholders can discuss a result. A bare "58/100" reads as a failed exam and makes founders defensive.

---

## 3. Inconclusive checks

A check that times out or errors is `inconclusive`. It is **excluded from both the numerator and the denominator** — its points are removed from the 100-point total and the score is rescaled.

```
score = 100 × (available_points − deductions) / available_points
```

**Never grade a company well because a check failed to run.**

If checks totalling **more than 25 points** are inconclusive **because they failed to run**, suppress the grade entirely and show a partial report explaining which checks could not complete.

### Which inconclusive points count — rubric v1.1

Two kinds of "inconclusive" look identical in the output and are not the same thing:

| | Example | Counts toward the 25? |
|---|---|---|
| **Structural** — cannot run at this tier, by design | `creds_accounts` needs the paid HIBP endpoint *and* domain verification. At Tier 0 we never have either. | **No** |
| **Unexpected** — was supposed to run and did not | the certificate transparency lookup timed out | **Yes** |

**Why this changed.** Under v1.0 both counted. The structural
`creds_accounts` gap is 12 points and is inconclusive on *every* Tier 0
scan, so it permanently spent 12 of the 25 and left 13 — less than the
subdomain check is worth on its own (23). Any certificate transparency
outage, on any domain, blanked the grade.

Seen live: a company passed six checks with nothing wrong, scored
**100/100**, and the page said *"No grade for this domain"* because a
third-party server had a bad second.

A gap that is missing on every single scan is not news, and it must not
eat the budget reserved for things going wrong. The budget now measures
what it was always trying to measure: **how much we failed to see today.**

**This is not a permanent exemption.** A check stops being structural the
moment any real result arrives for it — including an inconclusive one. The
day the HIBP key lands, a `creds_accounts` timeout is an outage like any
other and counts again.

**What did not change:** structural points still leave the denominator.
A Tier 0 scan is still scored over **88**, not 100.

---

## 4. Premium

### 4.1 Base table — PLACEHOLDER

Annual premium in INR, for a **₹5 Cr** limit. **These figures are not insurer-validated.** They must be calibrated with a partner insurer before being presented as anything other than an estimate. Every surface that displays them must use the word "estimated".

**Revenue under ₹5 Cr**

| Grade | Low | High |
|---|---|---|
| A | 45,000 | 60,000 |
| B | 60,000 | 85,000 |
| C | 85,000 | 1,20,000 |
| D | 1,30,000 | 1,80,000 |
| F | Refer — likely declined | |

**Revenue ₹5 – 25 Cr**

| Grade | Low | High |
|---|---|---|
| A | 70,000 | 95,000 |
| B | 95,000 | 1,30,000 |
| C | 1,40,000 | 1,90,000 |
| D | 2,00,000 | 2,80,000 |
| F | Refer | |

**Revenue ₹25 – 100 Cr**

| Grade | Low | High |
|---|---|---|
| A | 1,20,000 | 1,60,000 |
| B | 1,60,000 | 2,20,000 |
| C | 2,30,000 | 3,20,000 |
| D | 3,40,000 | 4,50,000 |
| F | Refer | |

### 4.2 Revenue band at Tier 0

Tier 0 does not know revenue. Use the size band inferred by AI call 1 as a proxy:

| Inferred headcount | Revenue band used |
|---|---|
| 1–10 | Under ₹5 Cr |
| 11–50 | Under ₹5 Cr |
| 51–200 | ₹5 – 25 Cr |
| 200+ | ₹25 – 100 Cr |

This is the primary source of Tier 0's ±60% imprecision, and it is exactly what the Tier 1 CTA resolves.

### 4.3 Limit multipliers

| Limit | Multiplier |
|---|---|
| ₹1 Cr | 0.45 |
| ₹2 Cr | 0.65 |
| **₹5 Cr** | **1.00** (Tier 0 default) |
| ₹10 Cr | 1.55 |
| ₹25 Cr | 2.60 |

### 4.4 Data-type multipliers — Tier 1+ only

Apply the **single highest** applicable multiplier. Do not compound.

| Data handled | Multiplier |
|---|---|
| Health data (PHI) | 1.40 |
| Payment card data | 1.30 |
| Consumer PII, > 100k records | 1.25 |
| B2B only, no sensitive data | 1.00 |

Not applied at Tier 0 — inferred data types are not reliable enough to price on.

---

## 5. Premium impact of a fix

**Computed, not generated.** Never ask the model for a percentage.

```
For each fix:
  hypothetical_score = current_score + fix.score_delta
  hypothetical_grade = grade_for(hypothetical_score)
  premium_if_fixed   = premium_for(hypothetical_grade, revenue_band, limit)

For the combined row:
  combined_score  = current_score + Σ(selected fixes' score_delta)
  combined_grade  = grade_for(combined_score)
  annual_saving   = midpoint(current_premium) − midpoint(combined_premium)
```

All deltas are precomputed server-side and returned in the `result` payload, so the interactive fix simulator needs **no network call**.

---

## 6. Worked example

`yourco.com`

| Finding | Rule | Deduction |
|---|---|---|
| No DMARC record | `dmarc.absent` | 18 |
| SPF ends `~all` | `spf.softfail` | 3 |
| DKIM found at selector `google` | `dkim.present` | 0 |
| Historic breach on record (2019) | `breach.historic` | 3 |
| Certificate valid, 240 days remaining | — | 0 |
| No HSTS | `hdr.no_hsts` | 5 |
| No CSP | `hdr.no_csp` | 4 |
| `staging.yourco.com` live, returns 200 | `surface.risk_host` | 6 |
| | **Total** | **39** |

Account exposure is inconclusive at Tier 0 — no key, no ownership proof —
so its 12 points leave the denominator:

```
available_points = 100 − 12   (account exposure inconclusive)   = 88
deductions                                                      = 39
score = 100 × (88 − 39) / 88 = 55.7 → 56 → grade C
```

**Score 56 → Grade C.**

> ⚠️ **This example changed when §1.2 was split.** It previously read
> 46 deductions → 54 → D. The change came from restructuring the category
> around what data is actually obtainable, **not** from wanting a friendlier
> letter. Do not tune the example to flatter the demo; tune the rubric only
> when the evidence changes, and then update this example to follow it.

Projected outcomes:

| Action | Deductions | Score | Grade | Estimated premium (₹5 Cr limit, revenue < ₹5 Cr) |
|---|---|---|---|---|
| Today | 39 | 56 | C | ₹85,000 – 1,20,000 |
| Fix DMARC (−18) | 21 | 76 | B | ₹60,000 – 85,000 |
| + security headers (−9) | 12 | 86 | A | ₹45,000 – 60,000 |
| + staging host (−6) | 6 | 93 | A | ₹45,000 – 60,000 |
| | | | | **saving ≈ ₹50,000** |

All scores rescaled over 88 available points. A historic breach cannot be
"fixed" — it stays on the record, which is itself worth saying out loud to
the user.

Note the shape this produces: a single fix — DMARC, two hours of work — moves the company a full grade and about ₹25,000 a year. That is the product's core message, and it falls out of the rubric rather than being staged.

> The mockup in [tier-0-scorecard-spec.md](tier-0-scorecard-spec.md#43-result) is illustrative. **This document is authoritative** for all numbers.

---

## 7. Versioning and calibration

- `rubric_version` and `rate_version` are stored on every scan row. Never mutate a rubric in place; publish `v1.1` and leave `v1.0` intact.
- A score must be reproducible from `findings` + `rubric_version` alone.
- Weights in §1 are **judgment-based priors**, not empirically derived. They encode the view that email-authentication failure and credential exposure are the highest-signal predictors of a claim. Recalibrate against real loss data once Phase 4 placements begin.
- Premium tables in §4 are placeholders and must be replaced with partner-insurer rates before any Tier 7 quote.
