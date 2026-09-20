# Tier 0 — Cyber Risk Scorecard

**Status:** Spec, not built
**Scope:** One page. One input. No signup, no database account, no insurance licence required.
**Target build time:** 3 days

---

## 1. Purpose

Prove that an Indian SaaS founder will paste their domain, read the result, and ask us about coverage.

**The one metric:** percentage of completed scans that click the Tier 1 CTA.

Everything in this spec exists to move that number. Anything that does not is out of scope.

---

## 2. The promise

> Type your domain. In under 30 seconds, see how exposed you are, what it would cost to insure, and what to fix to pay less.

---

## 3. User flow

```
  [1] Landing            →  [2] Scanning (live)  →  [3] Result
      one input                 streamed feed          grade, premium,
      no signup                 ~30 seconds            interactive fixes
                                                             ↓
                                                    [4] Tier 1 CTA
                                                       3 questions
```

No login at any point in Tier 0. No email capture before the result is shown.

---

## 4. Screens

### 4.1 Landing

```
─────────────────────────────────────────────────────────────

                How exposed is your company?

         [  yourcompany.com                    ]  [ Check ]

              Takes 30 seconds · No signup

─────────────────────────────────────────────────────────────
```

**Requirements**

| Item | Spec |
|---|---|
| Input | Single text field. Accepts `example.com`, `www.example.com`, `https://example.com/path`. Normalise to registrable domain. |
| Validation | Public suffix check. Reject IPs, localhost, single-label names, and known free-mail domains (`gmail.com`, `outlook.com`) with a specific message. |
| Autofocus | Yes, on page load. |
| Submit | Enter key and button both submit. |
| Copy | Do not use fear language. No "are you at risk?", no red, no warning icons on the landing screen. |

**Rejection copy**

- Free-mail domain → "That's an email provider. Enter your company's own domain — the one on your website."
- Unresolvable → "We couldn't find that domain. Check the spelling?"

---

### 4.2 Scanning

Results **stream in as they complete**. The page must never show a bare spinner.

```
─────────────────────────────────────────────────────────────
   Checking yourcompany.com

   ✓  Email authentication (SPF)      configured
   ✓  Certificate                     valid, expires in 240 days
   ·  Checking DMARC policy…
   ·  Looking for leaked credentials…
   ·  Mapping public subdomains…

─────────────────────────────────────────────────────────────
```

**Requirements**

| Item | Spec |
|---|---|
| Transport | Server-Sent Events. One event per check completion. |
| Ordering | Render in fixed display order, not completion order. Checks resolve at very different speeds (DNS in milliseconds, subdomain probing in seconds); a stable list prevents visual thrash. |
| States per row | `pending` (·, muted) → `running` (animated ·) → `pass` (✓) / `fail` (✗) / `warn` (⚠) |
| Tone | Factual, past tense, no exclamation. "configured", "valid, expires in 240 days", "not found". |
| Minimum dwell | If the whole scan finishes in under 4 seconds, hold the transition to the result for 4 seconds. Instant results read as fake. |
| Hard timeout | 30 seconds total. Any check not finished is marked `inconclusive` and excluded from scoring (see [scoring-and-pricing.md](scoring-and-pricing.md#inconclusive-checks)). |
| Failure | If checks totalling **more than 25 points** are inconclusive, do not show a grade. Show a partial report and an explanation. The threshold is points, not check count — see [scoring-and-pricing.md §3](scoring-and-pricing.md#3-inconclusive-checks). |

---

### 4.3 Result

```
─────────────────────────────────────────────────────────────

                          C
                yourcompany.com · 20 Sep 2026

        Estimated cyber cover    ₹85,000 – 1,20,000 / yr
                                 for ₹5 Cr limit

─────────────────────────────────────────────────────────────
  WHAT'S HOLDING YOU BACK                 tick to simulate

  ☐  No DMARC policy                      2 hrs        B
     Anyone can send email that looks like it's from you.
     This is how most payment-fraud attacks start.

  ☐  14 leaked employee passwords         1 hr         C+
     Found in public breach data. Still valid until reset.

  ☐  3 forgotten subdomains              30 min        C+
     staging.yourco.com is publicly reachable.

  ─────────────────────────────────────────────────────
     Fix all three  →      A       ₹45,000 – 60,000 / yr
                                   you'd save ~₹1,02,500
─────────────────────────────────────────────────────────────

  ✓  What you're already doing right
     SPF configured · TLS valid · No exposed admin panels

─────────────────────────────────────────────────────────────
     Want the exact number instead of a range?
     Three questions, 20 seconds.        [ Narrow it down → ]
─────────────────────────────────────────────────────────────
```

---

### 4.4 Coverage guidance blocks

Two further blocks sit on the result page — the limit recommendation (under the
grade) and the claim scenario (after the fix list). Both are fully specified in
[coverage-guidance.md](coverage-guidance.md).

They are what separate this from a security scanner. Module A answers the
question the premium provokes; Module B names the sublimit and endorsement gap
that decide whether a claim actually pays.

## 5. Design decisions, and why

Each of these is a deliberate choice with a reason. Do not change them without a reason of equal weight.

### 5.1 Letter grade, not "42/100"

SecurityScorecard uses an **A–F scale** specifically so that non-security stakeholders can discuss the result. Bitsight uses a 300–820 range as a deliberate credit-score analogy.

"42/100" reads as a failed exam and makes founders defensive. "C" reads as something to improve. The numeric score exists internally and is shown on hover or in the PDF; the grade is what the page leads with.

### 5.2 The fix list is interactive, not static

This is the single most important interaction on the page.

UpGuard's remediation planner lets a user select fixes and see the **projected rating before doing the work**. Our version: ticking a checkbox re-renders the grade and the premium.

- Each row shows the grade that row alone would achieve.
- The summary row shows the combined result of everything ticked.
- Both the grade and the premium **animate** to their new values (250ms ease-out). The movement is the point.
- State is local. No server round-trip; all deltas are precomputed and sent with the result payload.

A static report gets read once. An interactive one gets played with, and played-with things get shared.

### 5.3 Calm, not alarming

No red. No sirens. No "YOUR COMPANY IS AT RISK". A founder who feels attacked closes the tab.

- Failures use a neutral dark tone with an `✗`, not red.
- Warnings use amber sparingly.
- The single largest element on the page is the grade, not a warning.
- Generous whitespace. One primary CTA.

### 5.4 Show what is already right

Every credible scorecard product does this. The "What you're already doing right" block is not decoration — it is what stops the page reading as an attack and keeps the user on it long enough to reach the CTA.

### 5.5 The CTA is not "Get a quote"

It is **"Narrow it down"** — a 20-second ask with an immediate, stated reward. The quote ask comes at Tier 7, after we have given value three times.

Every ask on every tier must state its reward **in the button or immediately above it**. "Continue" is forbidden.

### 5.6 Never ask for anything at Tier 0

Not even an email. The full result is shown before any ask. Email capture belongs to Tier 2, after the user has chosen to go further.

---

## 6. Copy rules

| Rule | Example |
|---|---|
| Business impact, never CVE language | "Anyone can send email that looks like it's from you" — not "SPF record missing `-all` qualifier" |
| Effort is always stated | "2 hrs", "1 hr", "30 min" |
| Second person, present tense | "Anyone can send email that looks like it's from you" |
| No hedging | Not "may potentially allow an attacker to possibly…" |
| No security jargon in the headline of a finding | Jargon is allowed in the expanded detail, never in the one-line title |
| Never claim certainty we don't have | Premiums are "estimated". Say so. |
| One idea per line | Two clauses joined by "and" is two lines |
| Plain words first, the term second | "Anyone can send email pretending to be you — that's what DMARC prevents" |
| Every number carries its unit and period | "₹70,000 per year", never "70K" |
| Never explain something they don't have | If their DMARC is fine, don't teach them DMARC |

**Full rationale and worked micro-copy: [education-layer.md §5](education-layer.md#5-how-to-write-it).**

Each finding is written as four lines — what, why, consequence, action:

```
✗  No DMARC record

   Anyone can send email that looks like it came from your domain.

   Attackers use this to invoice your customers as you, and to ask
   your finance team for transfers as your founder.

   Fix: publish one DNS record.        2 hours        −18 points
```

### 6.1 Glossary on demand

Insurance and security terms that survive into the copy carry a **dotted underline**. Tapping expands one sentence inline.

- **Tap, not hover.** There is no hover on mobile, and the term matters most to the reader least likely to be on a desktop.
- One sentence. Plain language. No second term inside the definition.
- Terms to cover at Tier 0: *DMARC, SPF, DKIM, HSTS, CSP, TLS*. At Stage 2 add: *limit, sublimit, endorsement, aggregate, funds transfer fraud, social engineering*.
- Expansions are instrumented — the most-expanded term tells you what the copy failed to explain.

---

## 7. API contract

### `GET /api/scan?domain={domain}`

`Content-Type: text/event-stream`

**Event: `check`** — emitted once per check as it completes.

```json
{
  "type": "check",
  "id": "dmarc",
  "label": "DMARC policy",
  "status": "fail",
  "detail": "No DMARC record found",
  "evidence": { "record": null, "lookup": "_dmarc.yourco.com" }
}
```

`status` ∈ `pass` | `warn` | `fail` | `inconclusive`

**Event: `profile`** — emitted after classification (AI call 1).

```json
{
  "type": "profile",
  "company_name": "Yourco",
  "what_they_do": "Sells a B2B analytics dashboard to mid-market retailers.",
  "business_model": "B2B_SaaS",
  "data_types_handled": ["PII"],
  "dpdp_act_applies": true,
  "estimated_size_band": "11-50"
}
```

**Event: `result`** — terminal event.

```json
{
  "type": "result",
  "scan_id": "scn_01J...",
  "domain": "yourco.com",
  "scanned_at": "2026-09-20T09:14:00Z",
  "score": 58,
  "grade": "C",
  "premium": { "low": 85000, "high": 120000, "currency": "INR", "limit": 50000000 },
  "fixes": [
    {
      "id": "dmarc",
      "title": "No DMARC policy",
      "why_it_matters": "Anyone can send email that looks like it's from you. This is how most payment-fraud attacks start.",
      "how_to_fix": "Publish a DMARC record at _dmarc.yourco.com with p=quarantine, then move to p=reject.",
      "effort": "2 hrs",
      "score_delta": 18,
      "grade_if_fixed": "B",
      "premium_if_fixed": { "low": 60000, "high": 80000 },
      "priority": 1
    }
  ],
  "combined_if_all_fixed": {
    "score": 88, "grade": "A",
    "premium": { "low": 45000, "high": 60000 },
    "annual_saving": 102500
  },
  "premium_table": {
    "revenue_band": "under_5cr",
    "limit": 50000000,
    "by_grade": {
      "A": { "low": 45000,  "high": 60000  },
      "B": { "low": 60000,  "high": 85000  },
      "C": { "low": 85000,  "high": 120000 },
      "D": { "low": 130000, "high": 180000 },
      "F": null
    }
  },
  "strengths": ["SPF configured", "TLS valid", "No exposed admin panels"]
}
```

**Event: `error`**

```json
{ "type": "error", "code": "domain_unresolvable", "message": "We couldn't find that domain." }
```

Error codes: `invalid_domain`, `domain_unresolvable`, `free_mail_domain`, `too_many_inconclusive`, `rate_limited`, `internal`.

### `GET /api/scan/{scan_id}`

Returns the stored `result` payload. Backs shareable result URLs.

---

## 8. Data model

**MongoDB.** One collection — `scans` — is enough for Tier 0. The full document shape, indexes, cache lookup, rate limiting and the day-one analytics queries are in **[database.md](database.md)**, which is authoritative.

```js
{ _id: "scn_...", domain, scanned_at,
  findings: [...],        // raw check output — the audit trail
  profile: {...},         // AI call 1, null if it failed
  score, grade, available_points,
  report: {...},          // AI call 2 merged with computed deltas
  premium: {...},
  rubric_version: "v1.0", // mandatory
  rate_version:   "v1.0", // mandatory
  duration_ms, cta_clicked }
```

`rubric_version` and `rate_version` are mandatory. A score is only defensible if we can reproduce which rules produced it. Documents are append-only: the only permitted updates are `cta_clicked` and, from Stage 2.5, attaching `refinement` once.

---

## 9. Rate limiting and abuse

| Control | Value |
|---|---|
| Per IP | 10 scans / hour |
| Per domain | 1 full scan / 6 hours; serve cached result inside that window |
| Concurrent scans per instance | 20 |
| Cache | Cached results are labelled with their scan date, never presented as live |

A cached result must display "Last checked 3 hours ago · [Re-check]".

---

## 10. Performance budget

| Stage | Target | Hard limit |
|---|---|---|
| First check rendered | < 800 ms | 2 s |
| All deterministic checks | < 8 s | 20 s |
| AI classification (call 1) | < 6 s | 15 s |
| AI report (call 2) | < 12 s | 25 s |
| Total to result | **< 30 s** | 30 s (then partial) |

Classification (call 1) runs in parallel with the slower network checks, not after them.

---

## 11. Out of scope for Tier 0

Explicitly not built, to protect the 3-day timeline:

- Accounts, login, sessions
- Any check beyond the five in [scan-checks.md](scan-checks.md)
- Contract upload (Tier 5)
- OAuth connectors (Tier 3)
- Real quotes or insurer integration (Tier 7)
- Dashboards, history, monitoring, alerts
- PDF export (moves to Tier 2)
- Mobile-specific layout beyond responsive reflow

---

## 12. Acceptance criteria

Tier 0 is done when all of the following hold:

1. Entering a valid domain produces a grade, a premium range, and at least one fix within 30 seconds.
2. Checks stream individually; no bare spinner is ever shown.
3. Ticking any combination of fixes updates the grade and premium instantly, with animation, and with no network call.
4. The same domain scanned twice within 6 hours returns the cached result, labelled with its age.
5. A domain with no findings produces grade A and a "nothing to fix" state that still renders correctly.
6. A domain where checks totalling more than 25 points are inconclusive shows a partial report and no grade.
7. Every finding's title is free of security jargon.
8. No signup, email field, or modal appears before the result.
9. Every score is reproducible from `findings` + `rubric_version` alone.
10. The result page is shareable via URL and renders for a logged-out visitor.

---

## 13. Instrumentation

Track only what informs the one metric:

| Event | Properties |
|---|---|
| `scan_started` | domain, referrer |
| `scan_completed` | scan_id, grade, duration_ms |
| `scan_failed` | error_code |
| `fix_toggled` | scan_id, fix_id, checked | ← engagement proxy; if this is near zero, the interaction failed
| `cta_clicked` | scan_id, grade |
| `result_shared` | scan_id |

**Primary metric:** `cta_clicked / scan_completed`.
**Secondary:** share of scans with at least one `fix_toggled`.
