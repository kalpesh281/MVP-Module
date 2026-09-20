# Product Overview

## One sentence

An AI-assisted cyber insurance broker for Indian SaaS/IT companies that reads a company's live security posture from the outside, prices it, and places cover in days instead of weeks.

## The problem

Commercial insurance in India moves through a chain of intermediaries, each adding delay:

```
Customer → Retail Broker → MGA / Insurer
```

Every hop re-keys the same data from PDFs and email. Industry benchmarks:

- Submission → quote averages **~8 days**; quote → bind a further **~12 days**.
- Incomplete submissions run **2–4 weeks or longer** because of back-and-forth for missing information.
- **40–60%** of underwriter time goes to administrative work — re-keying, chasing documents — rather than risk assessment.
- Only **10–25%** of submissions ever become bound policies, so underwriting queues are long and clean submissions get worked first.

For cyber specifically, the best-equipped Indian player (Mitigata — a broker running its own 24/7 SOC) still quotes in **6 business days**. That delay is not their software. It is that the risk data reaching the underwriter is self-reported and unverifiable.

## The shift we are building into

The cyber market moved from **questionnaire-based** to **evidence-based** underwriting. In 2024 an applicant could tick a box saying "we have MFA." In 2026 the underwriter wants proof, and carriers deny claims under a "failure to maintain stated security controls" exclusion when the attestation turns out to be false.

**No broker in India supplies that proof.** That gap is the business.

Market conditions are favourable: cyber rates have fallen four consecutive years (≈ −13% in 2025, ≈ −5% in 2026), capacity exceeds demand, and buyers have leverage on terms. India's DPDP Act is simultaneously forcing the purchase.

## What we build

Three capabilities, in this order:

1. **Scan** — read a company's security posture externally (email authentication, breached credentials, TLS, attack surface) and convert it into a grade. No forms.
2. **Price** — map that grade to an indicative premium, and show what fixing each gap does to the number.
3. **Place** — take the verified posture to insurers and return a bound policy in 48 hours instead of 6 weeks.

## Who it is for

**Primary:** Indian SaaS / IT services companies, 10–200 employees, venture-backed or bootstrapped with enterprise customers.

**Why this segment:**

- Their risk is **externally observable** from a domain name. A manufacturer's D&O risk is not.
- Their stack is **API-connected** (Google Workspace, Okta, AWS, GitHub), which makes the evidence layer possible.
- They buy cyber because a customer contract or the DPDP Act forces them to — a deadline-driven purchase, not a discretionary one.

## Why companies buy — demand triggers

Commercial insurance is almost never a discretionary purchase. It is bought because **an external event attaches a deadline to it**:

```
EVENT  →  someone demands proof of cover  →  a date  →  a purchase
```

There are **nine trigger families**, not three. The full taxonomy, what each one needs, and how it enters the product is in [demand-triggers.md](demand-triggers.md).

| Family | The event | Deliverable they need | Urgency |
|---|---|---|---|
| **Contractual** | MSA / SOW insurance clause | COI before signature | 🔴 Highest |
| **Investor / governance** | Term sheet, SHA, board resolution | Cover before closing | 🔴 High |
| **Regulatory / statutory** | DPDP, RBI / SEBI, licence conditions | Documented cover + controls | 🟠 Fixed |
| **Customer security review** | Vendor questionnaire or assessment | Evidence of controls **and** cover | 🟠 Med-high |
| **Certification** | ISO 27001, SOC 2, PCI-DSS audit | Risk transfer as a control | 🟠 Scheduled |
| **Tender / RFP** | Bid specifies minimum cover | COI attached to the bid | 🔴 Hard date |
| **Incident / near-miss** | Phishing loss, ransomware scare, peer breach | Cover, fast | 🔴 Spike |
| **Lender / covenant** | Debt facility, venture debt | Cover as a drawdown condition | 🟠 Fixed |
| **Lifecycle / renewal** | Expiry, headcount jump, new geography, M&A | Better deal or expanded cover | 🟢 Predictable |

Three things follow from this:

1. **The deliverable is usually a certificate of insurance, not the policy** — and it is needed before a specific date.
2. **The trigger is captured, never assumed.** It is an optional question at Tier 1, and null is an expected answer. See [demand-triggers.md §4](demand-triggers.md#4-how-this-enters-the-product).
3. **The trigger changes presentation only.** It must never reach `scoring/`. Same rule as the AI layer.

Cyber is our entry line because its risk is **externally observable from a domain name** — not because it belongs to one particular trigger. Most triggers demand several lines at once.

## Competitive position

| Player | Layer | Lines | Wedge | Speed |
|---|---|---|---|---|
| **Corgi** (US) | Licensed carrier | 8 instant lines | Owns the full stack; removed broker and MGA layers | Quote in minutes, bind same day |
| **BimaKavach** (IN) | IRDAI broker | 25+ commercial | Breadth; "Bima Netra" instant cyber risk report | "Minutes" for rate-card lines |
| **Mitigata** (IN) | IRDAI broker | Cyber-led | Broker + managed SOC in one | 6 business days to quote |
| **Plum** (IN) | IRDAI broker | Group health first | Distribution via HR, cross-sell commercial | — |

Corgi went *down* the stack to become the carrier. Plum went *sideways* into HR to own distribution. Mitigata went *out* into security services. BimaKavach went *wide* across lines.

**We go deep on evidence.** Our differentiation is not breadth, not a SOC, and not a licence. It is continuously verified, time-stamped proof of a customer's security controls — the exact artifact underwriters now demand and cannot get.

### Why speed claims differ

A broker **cannot** issue a bindable instant quote. That requires delegated underwriting authority (an MGA binder agreement) or a carrier licence. Corgi spent a year obtaining a carrier licence precisely for this reason.

Therefore:

- **Not our Phase 1 target:** instant bindable cyber quote. That is a licensing problem, not a software problem.
- **Our Phase 1 target:** instant *indicative* price and risk report in under 60 seconds; bindable quote in 24–48 hours instead of 6 days.

## The tier ladder

Progressive disclosure. **Rule: never ask for anything before giving something. Every tier states its reward before its ask.**

| Tier | User gives | Time | User gets | Premium precision |
|---|---|---|---|---|
| **0** | Domain only | 0 sec | Grade, top fixes, premium **range** | ±60% |
| **1** | 3 questions (revenue band, headcount, data types) | 20 sec | Narrowed premium, limit recommendation | ±30% |
| **2** | Work email (verified) | 30 sec | Full report, PDF export, monthly re-scan | ±30% |
| **3** | Google Workspace / M365 read-only OAuth | 1 click | **Verified** MFA coverage, admin exposure, real user count | ±15% |
| **4** | GitHub / AWS read-only OAuth | 1 click | Secret scanning, backup and encryption evidence | ±10% |
| **5** | Upload customer MSA | 10 sec | Exactly what the contract requires them to buy | — |
| **6** | Upload prior policy | 10 sec | Gap analysis: paying for vs. missing | — |
| **7** | Loss history + full proposal form | 10 min | **Real, bindable quote** | actual |

Tier 3 is the moat. Tier 5 is the differentiator nobody else offers.

## Roadmap

| Phase | Scope | Regulatory requirement |
|---|---|---|
| **1. Scorecard** (3 days) | Tier 0. Domain in → grade, fixes, premium range out. | None |
| **2. Profile** (1 week) | Tiers 1–2, plus Tier 5 contract parsing | None |
| **3. Evidence layer** (1–2 months) | Tiers 3–4. OAuth connectors. | None |
| **4. Placement** (3–6 months) | Tier 7. Place on a partner broker's licence; beat 6 days. | Partner with an IRDAI-licensed broker |
| **5. Own licence** | Direct placement, own brand | IRDAI broker licence |
| **6. Delegated authority** | True instant bind within a defined appetite box | MGA binding authority from an insurer |

Phase 6 is only reachable with loss data accumulated in Phases 4–5. It cannot be a first step.

## Non-goals

- Becoming a security company. We are not selling a SOC, EDR, or pentesting. Mitigata occupies that position.
- Breadth across 25 lines before cyber works. BimaKavach occupies that position.
- Competing in the US against Corgi, Coalition, At-Bay, and Vouch as a first market.
- Active vulnerability scanning or intrusive probing. See [scan-checks.md](scan-checks.md#legal-basis).

## Open questions

- Which IRDAI-licensed broker do we partner with for Phase 4?
- Which insurer is the first realistic target for delegated authority, and what appetite box would they accept?
- Current IRDAI capital and licensing requirements for a direct broker licence — **to be verified**, do not rely on figures quoted informally.
