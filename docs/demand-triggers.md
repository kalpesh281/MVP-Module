# Demand Triggers — Why Companies Actually Buy

> The three triggers used in earlier drafts (investor, customer, employees) were **illustrative examples, not the model.** This document is the general model. Nothing in the product should hardcode three.

---

## 1. The principle

Commercial insurance is almost never bought because someone woke up wanting it. It is bought because **an external event attaches a deadline to it.**

```
EVENT  →  someone demands proof of cover  →  a date  →  a purchase
```

That means the useful question is never *"do you want cyber insurance?"* It is:

> **"What happened that made you look this up today?"**

Everything downstream — urgency, limit, which document they actually need, how much they'll tolerate a two-week process — falls out of the answer.

---

## 2. The general taxonomy

Nine families. Most real buyers sit in one or two at once.

| # | Family | The event | Who demands it | What they actually need | Urgency |
|---|---|---|---|---|---|
| 1 | **Contractual** | An MSA, SOW, or vendor agreement carries an insurance clause | Enterprise procurement / legal | A **COI** before a signature date | 🔴 Highest |
| 2 | **Investor / governance** | Term sheet, shareholders' agreement, board resolution | VC, PE, lead investor, the board | Cover in place before closing | 🔴 High |
| 3 | **Regulatory / statutory** | DPDP Act, RBI / SEBI / IRDAI directives, sectoral licence conditions | The regulator | Documented cover + controls | 🟠 Fixed calendar |
| 4 | **Customer security review** | A vendor questionnaire, security assessment, or annual vendor re-certification | Customer's InfoSec team | Evidence of controls **and** cover | 🟠 Medium-high |
| 5 | **Certification** | ISO 27001, SOC 2, PCI-DSS audit | Auditor | Risk transfer as a documented control | 🟠 Scheduled |
| 6 | **Tender / RFP / empanelment** | Bid documents specify minimum cover | Government body, large buyer | COI attached to the bid | 🔴 Hard deadline |
| 7 | **Incident or near-miss** | A phishing loss, a ransomware scare, a breach at a peer or competitor | Nobody — it's internal fear | Cover, fast, and reassurance | 🔴 Spike, then decays |
| 8 | **Lender / financial covenant** | Debt facility, venture debt, banking covenant | Lender | Cover as a condition of drawdown | 🟠 Fixed |
| 9 | **Lifecycle / renewal** | Policy expiring, headcount jump, new geography, new product line, M&A diligence | Themselves, or an acquirer | A better deal, or expanded cover | 🟢 Lower, predictable |

**Plus the non-triggers, which still generate traffic:**

- **Curiosity** — someone shared the link. No purchase intent, but they might forward it.
- **Competitive** — checking a competitor, a vendor, or an acquisition target's domain. Not a buyer today; a *different* product tomorrow (see vendor risk monitoring in [vision.md](vision.md)).

---

## 3. What actually differs between them

The scan is identical for everyone. **The grade and the premium never change based on why they came.** What changes is emphasis:

| Family | Lead with | The CTA should say |
|---|---|---|
| Contractual | "Does your cover meet clause 14.2?" | *Upload the contract →* |
| Investor | Before/after posture, board-ready summary | *Get the one-page summary →* |
| Regulatory | DPDP exposure, notification obligations | *Check your DPDP position →* |
| Security review | Evidence of controls, not just a grade | *Generate the evidence pack →* |
| Certification | Which controls map to which clause | *Map to ISO 27001 →* |
| Tender | The COI and the exact limits demanded | *Get a quote →* |
| Incident | Speed, and the claim scenario | *Get covered now →* |
| Lender | Limits and endorsements the covenant names | *Get a quote →* |
| Renewal | Benchmark against last year's premium | *Compare to your current policy →* |

This is **copy and ordering**, not maths. It costs almost nothing to build and changes conversion materially.

---

## 4. How this enters the product

### Tier 0 — no trigger is asked

Nothing is asked before the result. That rule does not bend for this.

The result page shows the same grade, premium, fix list, coverage recommendation, and claim scenario to everyone.

### Tier 1 — one optional question, asked last

Added as a **fourth, optional, skippable** question after revenue / headcount / data types:

```
  Step 4 of 4 · optional

  What brought you here today?

    ○  A customer contract requires it
    ○  An investor or our board asked
    ○  A regulator or compliance requirement
    ○  A customer security review or questionnaire
    ○  A certification audit (ISO 27001 / SOC 2)
    ○  A tender or RFP
    ○  Something happened — an incident or a close call
    ○  A lender or financing condition
    ○  Our policy is coming up for renewal
    ○  Just looking

                              [ Skip ]   [ Done → ]
```

Ten options, not three. Skippable. Never blocks the result.

### What it may and may not do

| May | May not |
|---|---|
| Reorder blocks on the result page | Change the score |
| Change the CTA label and destination | Change the premium |
| Change which claim scenario is emphasised | Change the recommended limit |
| Change follow-up email content | Gate any content behind answering |
| Route the lead internally | Be required |

> **`demand_trigger` is a presentation and routing field. It must never reach `scoring/`.** Same rule as the AI layer: `scoring/` stays pure.

### Data model

```python
class DemandTrigger(str, Enum):
    CONTRACT      = "contract"
    INVESTOR      = "investor"
    REGULATORY    = "regulatory"
    SECURITY_REVIEW = "security_review"
    CERTIFICATION = "certification"
    TENDER        = "tender"
    INCIDENT      = "incident"
    LENDER        = "lender"
    RENEWAL       = "renewal"
    BROWSING      = "browsing"
```

Stored on the scan document as `demand_trigger: str | None`. Null is a valid, common, expected value.

---

## 5. Why this is worth building

**It is the single most valuable field you will ever collect,** and it costs one optional radio group.

- **It ranks the pipeline.** A `tender` with a bid date outranks a `browsing` by an order of magnitude. Without it you treat every lead the same.
- **It tells you which product to build next.** If 40% answer `contract`, the contract parser (Stage 3) is obviously the right next build — and you'll know that from data instead of instinct.
- **It is the honest version of lead scoring.** You asked them directly instead of inferring it.
- **It writes your marketing.** The most-selected trigger is the headline on the landing page.

**And it corrects a real design risk:** building the whole funnel around three assumed triggers would have quietly excluded regulatory, certification, tender, incident, lender and renewal buyers — which together are likely the majority.

---

## 6. Beyond cyber

Cyber is the entry line because it is the one whose risk is **externally observable from a domain name**. But the trigger model is line-agnostic, and most triggers demand more than one line:

| Trigger | Lines commonly demanded |
|---|---|
| Contractual | Cyber, E&O / Professional Indemnity, CGL, Umbrella, Workmen's Comp |
| Investor | D&O, Key Person, E&O, Cyber |
| Regulatory | Cyber, Professional Indemnity, statutory covers |
| Tender | CGL, Workmen's Comp, Professional Indemnity, Performance-linked |
| Lender | Property, Business Interruption, Key Person |
| Employees / statutory | Workmen's Comp, Group Health, Group Personal Accident |

The captured trigger tells you **which line to expand into first**, from evidence rather than a guess. That is the Stage 4+ conversation, and it is why this field is worth collecting from day one.
