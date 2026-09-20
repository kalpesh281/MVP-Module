# Vision — From Scorecard to Risk Operating System

---

## The arc in one line

> **Today:** a domain gives you a grade.
> **Tomorrow:** a company's live security posture, its contracts, and its policies sit in one place — and insurance becomes something that happens *around* the business instead of something it has to go and buy.

The scorecard is not the product. It is the wedge that earns the right to hold a company's risk data, and holding that data is the product.

---

## Why this ends up bigger than insurance

Every Indian SaaS company answers the same three questions over and over, to different people, from scratch each time:

1. *"Are you secure?"* — asked by every enterprise customer, in a security questionnaire
2. *"Are you insured?"* — asked by every customer, investor, and landlord, as a COI request
3. *"Are you compliant?"* — asked by DPDP, SOC 2, ISO 27001, and every procurement team

These are the same underlying facts, re-gathered manually every single time. **The company that holds those facts continuously, and can prove them, answers all three automatically.**

Insurance is the best entry point because it is the only one where someone *pays you* to hold the data.

---

## The six ladders

Each ladder is a module set. They compound — later ladders are only possible because earlier ones ran.

### Ladder 1 — Know them (the evidence layer)

| Module | What it does | Unlocks |
|---|---|---|
| External scan | Domain → grade | Tier 0, shipping |
| **Connector evidence** | Read-only OAuth into Workspace, Okta, EDR, AWS, GitHub | Verified controls instead of attestations |
| **Reconciliation** | Cross-check claimed vs observed | "You said MFA is on; 4 admin accounts are exempt" |
| **Continuous posture** | Re-scan on a cadence, track drift | Change alerts, renewal intelligence |

This is the moat. Everything downstream depends on it.

### Ladder 2 — Own the paperwork

| Module | What it does | Why it matters |
|---|---|---|
| **Contract parser** | MSA PDF → required lines, limits, endorsements, with the clause quoted | Nobody in India does this |
| **COI vault** | Every certificate issued, to whom, expiring when | Replaces a spreadsheet every company maintains badly |
| **Requirement tracker** | Each customer contract's insurance clause, monitored | Alerts before a breach of contract, not after |
| **Reverse clause generator** | Generate the insurance clause *they* should put in *their* vendor contracts | Flips them from buyer to enforcer — a second reason to log in |
| **Policy gap analysis** | Their existing policy vs what their contracts require | The highest-conversion moment in the whole funnel |

This ladder turns a once-a-year transaction into a system of record.

### Ladder 3 — Stay with them

| Module | What it does |
|---|---|
| **Renewal autopilot** | 90 days before expiry: auto re-scan, auto re-market, present options side by side |
| **Premium optimiser** | "Fix these two things before renewal and save ₹60,000" — with a deadline |
| **Change alerts** | Posture degrades → they hear it from you before an attacker finds it |
| **Board report** | One page on cyber posture for the board pack — ties directly into the D&O conversation |

Insurance renews. Whoever owns the 90-days-before moment owns the account.

### Ladder 4 — Claims, the moment of truth

| Module | What it does |
|---|---|
| **Pre-loaded IR plan** | Panel counsel, forensics firm, 24/7 hotline — filled in at binding, not at 2am |
| **One-button first notice of loss** | Breach → notify carrier, engage panel counsel, start the clock |
| **Claims tracking** | Where it is, what's needed, what's paid |

Coalition's real differentiator is not the scan — it's that a policyholder in trouble knows exactly who to call. **This is where a customer decides whether to renew, and it's where most brokers disappear.**

### Ladder 5 — More buyers, same engine

| Module | New buyer | Why it works |
|---|---|---|
| **Vendor risk monitoring** | The same company, watching its suppliers | Same engine, recurring SaaS revenue, no insurance licence needed |
| **VC portfolio dashboard** | A fund scanning its whole portfolio | ⭐ One conversation → hundreds of companies. The strongest distribution unlock available. |
| **Accelerator / incubator programme** | Cohort-wide scanning | Same shape, earlier stage |
| **Embeddable scan (API/widget)** | SaaS platforms, marketplaces, banks | Your scan inside someone else's onboarding |

**The VC portfolio play deserves special attention.** Indian funds have 50–300 portfolio companies, all of which need cyber and D&O, all of which the fund wants de-risked. One partner meeting replaces a hundred founder meetings — and the fund *wants* to make the introduction.

### Ladder 6 — Become the pen

| Stage | What changes |
|---|---|
| Broker partner | Place on someone's licence, learn the market |
| Own broker licence | Own brand, own economics |
| **MGA / delegated authority** | Quote and bind instantly within a defined box |
| Risk-sharing | Commission *plus* a share of underwriting profit |

This is only reachable with loss data from the ladders above. It is the end of the road, not the start — and it is where the economics change by an order of magnitude.

---

## The adjacent revenue nobody expects

| Module | Model | Note |
|---|---|---|
| **Fix-it marketplace** | Referral fee | "We'll connect you to someone who'll fix DMARC for ₹8,000." Genuinely helps, and the re-scan proves it worked. |
| **Security questionnaire autofill** | SaaS | Answer an enterprise customer's 200-question security review from the evidence you already hold |
| **DPDP readiness** | SaaS | India-specific, regulator-driven, uses the same evidence graph |
| **Benchmark data** | Data product | "Indian SaaS Cyber Posture Report" — annual, free, generates press and inbound every year |

The benchmark report is worth building the moment you cross ~500 scans. It costs a day, it is publishable, and it makes you the source people quote.

---

## What makes this defensible

Corgi raised $268M and became a carrier. BimaKavach went wide across 25 lines. Mitigata bolted on a SOC. None of those are copyable positions for a new entrant, and none of them need to be.

**The defensible position here is different:** after a year of operation you hold a continuously verified, time-stamped record of security posture across hundreds of Indian SaaS companies, tied to the contracts they've signed and the policies they hold.

That asset does four things nothing else can:

1. **Prices risk** better than any questionnaire, so you win on loss ratio
2. **Benchmarks the market**, so your report is the one people cite
3. **Buys delegated authority**, because an insurer grants the pen to whoever can prove the risk
4. **Answers the security questionnaire, the COI request, and the compliance audit** from the same store

Features get copied in a year. A continuously updated evidence graph does not.

---

## The honest risks

A vision document that only lists upside is a sales deck. These are the real constraints:

| Risk | Reality | Mitigation |
|---|---|---|
| **No insurance licence** | Cannot place or bind anything | Partner with an IRDAI-licensed broker in Phase 4. Start that conversation now — it takes months. |
| **Premium tables are invented** | Every number shown is a placeholder | Must be calibrated with an insurer before any real quote. Label everything "estimated" until then. |
| **Connector adoption is unproven** | Founders may not grant OAuth to a startup | Tier 3 is a hypothesis, not a certainty. Test it with 10 design partners before building the full connector suite. |
| **Insurers move slowly** | Delegated authority is a 2–3 year path, not a 6-month one | Vendor monitoring SaaS is revenue that does not depend on any insurer saying yes |
| **The scan finds little for mature companies** | A well-run company scores A and sees no reason to engage | Lead with the contract parser for that segment, not the scan |

**The single most valuable de-risking action is not engineering.** It is signing a broker partner and one insurer relationship. Do that in parallel with the build, starting this week.

---

## Sequenced

| Horizon | Focus | Proof point |
|---|---|---|
| **0–3 months** | Tier 0 + contract parser | Founders scan and ask about coverage |
| **3–6 months** | Evidence connectors, broker partnership | Cover placed in under 48 hours |
| **6–12 months** | COI vault, renewals, vendor monitoring | Recurring revenue independent of insurance |
| **12–24 months** | VC portfolio distribution, own licence | Hundreds of companies, one relationship at a time |
| **24 months +** | Delegated authority | Instant bind, underwriting profit share |

---

## The sentence to end the client meeting on

> *"We're not building a faster way to buy insurance. We're building the place where a company's risk actually lives — what they run, what they've promised their customers, and what they're covered for. Insurance is the first thing we sell off that, because it's the only one where someone pays us to keep it accurate."*
