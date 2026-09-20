# Policy Wording Evidence

**Checked 2026-09-20.** This page is the audit trail behind every coverage
statement the product puts on screen. It exists so that "your policy
covers this" can be traced to a filed wording rather than to our memory of
one.

The rule it serves is in `app/scoring/scenarios.py`:

> Cost lines, covered, not-covered and the sublimit warning are rendered
> byte-identical from a catalog. A model that invents a coverage statement
> is the single mistake this product cannot make.

A catalog is only worth that rule if somebody checks it against a real
document. Until this date, nobody had.

---

## 1. The source document

| | |
|---|---|
| **Policy** | Bajaj Cyber Protect Premium — Digital Business and Data Protection Insurance |
| **Insurer** | Bajaj General Insurance Limited (formerly Bajaj Allianz General Insurance) |
| **UIN** | `IRDAN113CP0002V02201516` |
| **Type** | Commercial. Claims-made. India. |
| **Source** | [bajajgeneralinsurance.com — Cyber-Protect.pdf](https://www.bajajgeneralinsurance.com/download-documents/commercial-insurance/bajaj-allianz-cyber-protect-digital-business-data-protection-insurance/Cyber-Protect.pdf) — public download, 28 pages |

**Why this one.** It is a *commercial* wording, filed with IRDAI, publicly
downloadable, and aimed at exactly our market — digital businesses holding
customer data. ICICI Lombard's equivalents are published but their CDN
refuses automated download; the IRDAI repository copy we retrieved
(`IRDAN132RP0002V01202021`, Future Generali) turned out to be a **personal**
cyber policy and is not a valid comparator for a SaaS company.

**One wording is not the market.** This is a single insurer's filed
product. It is enough to prove a statement is defensible and more than
enough to prove one is wrong; it is not enough to say "all Indian
policies". Where our text now generalises, it says "a standard Indian
cyber wording", and that claim is still owed a second source.

---

## 2. Clause map — the cover this policy actually grants

| Clause | Cover | Sublimited? |
|---|---|---|
| 1.1 | Privacy Breach & Data Breach — Damages, Defence Costs, Response Costs | No |
| 1.2 | Network Security Claims | No |
| 1.3 | Media Liability Claims | No |
| 1.4 | Regulatory Costs and Fines | **Yes** — Item 6.a |
| 1.5 | E-Payment / Contractual Penalties (PCI-DSS only) | **Yes** — Item 6.b |
| 1.6 | Business Interruption Loss and Restoration Costs | **Yes** — Item 6.c |
| 1.7 | Hacker Theft Cover (IT-Theft) | **Yes** — Item 6.c |
| 1.8 | Cyber Extortion | **Yes** — Item 6.d |
| 1.9 | Crisis Communication (PR expenses) | **Yes** — Item 6.e |
| 1.10 | Consultant Services | **Yes** — Item 6.f |
| 2.2 | Emergency Costs | **Yes** — Item 6.g |

**Seven of eleven clauses carry their own sublimit.** This is the single
strongest validation of Module B's existence. A founder reading "₹5 Cr
cover" is reading Item 5; the number that decides their claim is in Item 6.

Definitions that matter more than they look:

- **3.59 Waiting Period** — "the period of hours as specified in Item 15 of
  the Schedule". The wording fixes no number.
- **3.34 Indemnity Period** — ends when the interruption ends "or after
  **180 days**, whichever is the lesser".
- **3.27 Fines and Penalties** — "all monetary fines and penalties **that
  are insurable by the law applicable** to this Policy".
- **3.36 IT-Theft** — "any Third Party's **targeted intrusion** into the
  Company's Computer System which results in fraudulent and unauthorised
  **deletion or alteration of Data**".
- **3.5 Business Interruption Event** — every limb is about "**the
  Company's** Computer System".

---

## 3. Line-by-line audit of our catalog

### ✅ Confirmed

| Our line | Clause | Wording |
|---|---|---|
| Ransomware — betterment excluded | 3.19(f) | "the costs to design, upgrade, maintain, or improve a Computer System or Computer Programme, including correcting any deficiencies or problems" |
| Account takeover — customer contractual penalties excluded | 4.3, 3.19(g) | "any liability under any contract … assumed or accepted by an Insured except to the extent that such liability would have attached … in the absence of such contract" |
| Account takeover — regulatory fines sublimited | 1.4 | "Coverage for Fines and Penalties is subject to a sublimit as specified in Item 6.a" |
| Email spoof — the money is not paid without an endorsement | — | "social engineering", "funds transfer" and "phishing" appear **zero times** in 28 pages |

### ❌ Corrected — we were wrong

**1. We named a cover that does not exist.**

> *Was:* "Reputational loss beyond the policy's **defined reputational harm
> cover**."

The word "reputation" does not appear in the wording. There is no
reputational harm cover. Clause 1.9 pays public relations *expenses*,
sublimited, and nothing else. We were pointing at a cover that isn't
there — the precise mistake the module was built to prevent, made by the
module.

> *Now:* "Lost customers and reputational damage. Public relations costs
> are covered and sublimited; the revenue that walks away afterwards is not."

**2. We warned about a sublimit on a cover that is absent entirely.**

> *Was:* "Social engineering is commonly capped well below the policy limit
> — often ₹50–80 L on a ₹5 Cr policy."

There is no social engineering cover to cap. And clause 3.36 shows *why*
the gap bites: IT-Theft requires a "targeted intrusion" producing
"deletion or alteration of Data". An employee tricked into wiring money
fails that test, because nobody broke in.

> *Now:* "A standard Indian cyber wording does not cover this at all. The
> theft cover it does carry requires an attacker to have broken in and
> altered your data — being tricked into paying does not meet that test."

**3. We contradicted ourselves on screen.**

`email_spoof` listed **"Funds transfer fraud"** under *Covered* while its
own exclusion line said the money is not paid without a funds transfer
fraud endorsement. Both rendered, centimetres apart. Now
`["Breach response costs", "Privacy liability", "Crisis communication"]`,
and `test_nothing_is_listed_as_covered_and_excluded_at_once` makes the
contradiction a test failure.

**4. We asserted a number the wording does not state.**

> *Was:* "a waiting period, typically 8–12 hours"

8–12 hours is US market commentary. Clause 3.59 defers to the schedule;
Indian market sources put the common figure at **24 hours**. We now say
where the number lives and add the 180-day cap, which is the wording's own
and is the limit founders never expect.

**5. We were too soft about dependent business interruption.**

> *Was:* "Dependent business interruption **may exclude** vendors the policy
> does not name."

Clause 3.5 confines every trigger to the Company's own system. A vendor
outage is not an omission from the schedule — it is outside the trigger.

---

## 4. Regulatory fines and the DPDP Act

Clause 1.4 covers fines; clause 3.27 limits that to fines "insurable by
the law applicable". Whether a DPDP Act penalty is insurable in India is
**unsettled**. Marsh India and Khaitan & Co conclude there is "a
reasonable degree of support" but no certainty: Indian courts treat public
policy as a high bar requiring "clear and uncontestable harm to the
public", and section 23 of the Indian Contract Act 1872 voids an agreement
whose object is contrary to public policy. Maximum DPDP penalty: **₹250
crore**, and penalties can be composite across violations.

Our text says "has not been settled". That is the honest position and it
is the one to give the client. Do not say covered; do not say excluded.

Note: this wording's definition of Data Protection Legislation (3.22)
names the **Information Technology Act, 2000** — it predates the DPDP Act.
Any wording a customer shows us needs checking for the same gap.

---

## 5. The rupee figures — still directional

The cost lines and `BREACH_COST` bands are **not** derived from Indian
claims data, and this research did not change them. What it did was
establish they are the right order of magnitude:

| Source | Figure | Applies to |
|---|---|---|
| NetDiligence Cyber Claims Study 2025 | small business average claim **$79,000** (≈ ₹66 L); SME average **$205,000** (≈ ₹1.7 Cr) | SME — our segment |
| CERT-In / Indian market reporting | ransomware demands against Indian SMEs **₹15 L – ₹80 L**, average downtime **16 days** | Indian SME |
| IBM Cost of a Data Breach 2025 (India) | **₹22 crore** average, rising to ₹25.5 crore in 2026 | **Large organisations. Not segmented by size.** |

Our bands — `1-10: ₹40 L – ₹1.2 Cr`, `11-50: ₹1 – 3 Cr` — sit inside the
NetDiligence SME range and above the Indian ransomware demand range, which
is right, because a demand is not the total cost of an incident.

**Do not raise the bands to meet IBM's India figure.** It is the headline
number every article quotes and it is the wrong tool here: it surveys
large organisations and publishes no size breakdown, so applying it to a
twenty-person SaaS would over-recommend cover by an order of magnitude on
a citation that looks authoritative. This is written down because the
mistake is tempting.

---

## 6. What is still owed

| | |
|---|---|
| A second commercial wording | One insurer is not "a standard Indian wording". ICICI Lombard's `IRDAN115RP0002V01202021` and the I-Elite group wording are published; their CDN blocks automated fetch, so this needs a manual download. |
| A **specimen schedule** | Every sublimit that matters is an Item number, not a figure. Without one filled-in schedule we know which clauses are capped but not at what. |
| Indian SME claims data | Nothing public segments Indian breach cost by company size. Until it exists, the rupee figures stay labelled "typically" and "estimated" on every surface. |
| A broker's read | This audit was done from the document. It has not been checked by anyone who places these policies. |
