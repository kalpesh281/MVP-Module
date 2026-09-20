# The Education Layer

> **Goal:** the first time someone lands here, they leave understanding something they did not understand before — about their own company. The quote is a by-product of that, not the purpose of the visit.

---

## 1. Why education *is* the product

An Indian SaaS founder with 40 people typically cannot answer:

- What cyber insurance actually covers
- How much cover they need, or why
- What a "sublimit" is, or why it just made their policy worthless
- Why their premium is what it is
- Whether their security posture affects the price at all

They are not stupid. **Nobody has ever told them.** The entire distribution chain — broker, MGA, insurer — is structurally incentivised to keep it opaque, because opacity is where the margin lives.

Three things follow:

1. **People do not buy what they do not understand.** Every competitor's conversion problem is actually a comprehension problem.
2. **Teaching is the cheapest trust you can buy.** A tool that explains something to you for free, before asking for anything, earns more credibility in 60 seconds than a sales call earns in a week.
3. **It is genuinely defensible.** Anyone can copy a scanner. Copying a body of clear, correct, India-specific insurance explanation requires actually understanding insurance — which is the part our competitors' engineering teams do not have.

> **BimaKavach sells breadth. Mitigata sells a SOC. Corgi sells a licence. We sell comprehension.**

---

## 2. The core rule

> ### Teach through their own data. Never in the abstract.

Nobody reads "What is cyber insurance?" Everybody reads **"Anyone can send email as you, and here's what that costs."**

| ❌ Generic | ✅ Anchored |
|---|---|
| "Cyber insurance covers business email compromise." | "You have no DMARC record. Anyone can send email that looks like it came from `you@acmesaas.in`." |
| "Policies often carry sublimits." | "Your ₹5 Cr policy would pay a maximum of ₹25 L for this. That's the sublimit." |
| "DMARC is an email authentication protocol." | "Two hours of work. ₹70,000 a year off your premium." |

Every lesson in the product is attached to a finding on **their** domain. That is what makes it land, and it is what makes it unique.

---

## 3. What they must learn, in order

The order matters. Each step only makes sense once the one before it has landed.

```
 1. "This is what you look like from the outside."
        ↓  they didn't know this was visible
 2. "This is what it would cost you."
        ↓  risk becomes a number
 3. "This is what insurance would and wouldn't pay."
        ↓  insurance becomes a specific thing
 4. "This is how much cover you need, and why."
        ↓  they can now make a decision
 5. "This is how to change any of it."
        ↓  they have agency
```

| # | Lesson | Where it's taught | Stage |
|---|---|---|---|
| 1 | Your security posture is publicly observable | Streaming check feed + grade | 1 |
| 2 | Bad posture has a rupee price, per year | Premium band + fix simulator | 1 |
| 3 | Insurance pays for specific things, and refuses others | Claim scenario block | 2 |
| 4 | Limits are chosen for reasons, not guessed | Coverage recommendation | 2 |
| 5 | You control all of it | Interactive fix list | 1 |

**Stage 1 teaches lessons 1, 2 and 5. Stage 2 teaches 3 and 4.** That is a second, independent reason the stage boundary sits where it does.

---

## 4. Where education appears on the page

| Surface | The lesson | Mechanism |
|---|---|---|
| **Streaming check feed** | "These things are checkable from outside" | Each check names itself in plain words as it runs — *"Checking whether anyone can send email as you"*, not *"SPF/DKIM/DMARC lookup"* |
| **Grade** | "This is a measurable thing" | A letter, not a 42/100. Letters are universally understood; a number invites argument about the scale |
| **Each finding** | What it is, why it matters, what happens if ignored | Three short lines. Never a jargon term without its meaning in the same sentence |
| **Fix simulator** | "Security and price are the same conversation" | The number moves as they tick. This is the single most educational interaction in the product |
| **Strengths block** | "You already got some things right" | Teaches what *good* looks like, and keeps the reader receptive |
| **Coverage block** | "Limits have reasons" | Names the driver: PII, DPDP, headcount, the clause |
| **Claim scenario** | "Covered ≠ paid in full" | Covered / sublimited / not covered, laid out as three distinct things |
| **Glossary-on-demand** | Vocabulary | Dotted underline on a term; tap for one sentence. **Never a hover tooltip** — no hover on mobile |

---

## 5. How to write it

Six rules. These are testable in review.

1. **One idea per line.** If a sentence has two clauses joined by "and", it's two lines.
2. **Plain words first, the term second.** *"Anyone can send email pretending to be you — that's what DMARC prevents."* Never the reverse.
3. **Second person, active voice.** "You have no DMARC record." Not "A DMARC record was not detected."
4. **Every number carries its unit and its period.** "₹70,000 per year", never "70K".
5. **No fear.** Calm, factual, specific. A frightened reader stops reading; a curious one keeps going. (`--fail` is a dark neutral, not red — see [frontend.md](frontend.md).)
6. **Never explain something they didn't ask about and don't have.** If their DMARC is fine, don't teach them DMARC. Education is triggered by findings, not by a curriculum.

### Worked micro-copy

```
✗  No DMARC record

   Anyone can send email that looks like it came from your domain.

   Attackers use this to invoice your customers as you, and to ask
   your finance team for transfers as your founder.

   Fix: publish one DNS record.        2 hours        −18 points
```

Four lines. What, why, consequence, action. No jargon that isn't defined in place. Nothing scary — just specific.

---

## 6. What NOT to do

| ❌ | Why |
|---|---|
| A "Learn" tab, a blog, a resources section | Nobody clicks it. Education must be in the path, not beside it |
| Tooltips as the primary mechanism | No hover on mobile, and it hides exactly what should be visible |
| Explaining everything at once | Lesson 3 is meaningless before lesson 1 has landed |
| Teaching insurance vocabulary for its own sake | They don't need to know what "aggregate" means. They need to know what gets paid |
| A gated PDF guide | That's the old model. Asking before giving is the thing we're replacing |
| Being clever | A pun costs you a reader who's already out of their depth |
| Padding a clean scan with generic lessons | If there's nothing to teach, say so honestly |

---

## 7. How this shows up in each stage

### Stage 1 — "I didn't know any of that was visible"

The first genuine surprise is the streaming feed: they watch a stranger's software read their infrastructure in 30 seconds. That surprise is what makes them read the rest.

The second is the fix simulator. **Ticking a box and watching ₹70,000 disappear teaches more about insurance pricing than any article ever written about it** — because they did it themselves.

### Stage 2 — "I didn't know a policy could say no"

The claim scenario block is the moment the product stops being a security tool.

> *"Covered under funds transfer fraud — but sublimited to ₹25 L. And the transferred money itself isn't covered at all without a social engineering endorsement, which most Indian policies don't carry."*

Most buyers learn this **after** the wire has left. Teaching it before they buy is the most valuable thing on the page, and it is the sentence that makes an insurance person take the product seriously.

### Stage 2.5 — "I didn't know that's why it was a range"

Answering three questions and watching ±60% become ±30% teaches what underwriting *is*: less uncertainty, better price. They learn the mechanic by operating it — and the range that *stays* is the lesson too, because knowing a company's size tells you nothing about whether its MFA is enforced.

---

## 8. Measuring it

The one metric is still CTA click-through. But education has its own signals:

| Signal | Reads as |
|---|---|
| Time on result page > 90 s | They're reading, not bouncing |
| Fix simulator interactions per session | The core lesson is landing |
| Glossary term expansions | Vocabulary gaps — tells you what to explain better |
| Scroll depth past the scenario block | Stage 2 is being read, not skipped |
| Return visits without a new scan | They came back to re-read. Strongest possible signal |
| Rescans of the same domain after 1–7 days | **They fixed something.** The product changed behaviour |

That last row is the one to care about. If a domain's grade improves between two scans, this stopped being a marketing page and became a security product that also sells insurance.

---

## 9. The line to use with the client

> *"Every competitor is trying to sell insurance faster. We're the only one that makes you understand what you're buying — and people buy from whoever explained it to them."*

The scan is the hook. The explanation is the product. The policy is the revenue.
