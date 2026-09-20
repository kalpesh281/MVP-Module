# Defending the Score

> *"How do you score this?"*

The question that decides whether the client trusts the product. Answer it in layers — 20 seconds, then 2 minutes, then the hard follow-ups.

**The governing rule: never oversell the rubric.** Its credibility comes from being published and reproducible, not from pretending it is actuarial. A claim you cannot defend costs more than the one you didn't make.

---

## Layer 1 — the 20-second answer

> "Five checks, run from outside your domain. Each one has a fixed point value. You start at 100 and lose points for what we find. The letter is just a band on that number.
>
> No AI touches it. Same findings, same score, every time — you can recompute it by hand from the report."

Stop there. If they're satisfied, don't keep talking.

---

## Layer 2 — the 2-minute answer

Walk the five steps on their own result page.

**1. Start at 100, deduct.** Absence of a problem is the normal state, so we penalise rather than reward. Same model Mozilla's HTTP Observatory uses.

**2. Five categories, weighted by insurance relevance.**

| Category | Points |
|---|---|
| Email auth (SPF / DKIM / DMARC) | 30 |
| Attack surface | 23 |
| Breached credentials | 20 |
| TLS | 15 |
| Security headers | 12 |

> "DMARC is 18 points on its own. A missing CSP header is 4. That's not a security-purist ranking — a security tool would weight them closer. **We weight by what shows up in a claim file.** Business email compromise is one of the most frequent and expensive cyber claims. A missing CSP header rarely is."

**3. Every rule has a fixed value.** Point at a finding: *"No DMARC record, minus 18. That number is in the published rubric. It isn't calculated per company and it isn't negotiable."*

**4. What we can't check doesn't count against you.** If a data source is down, that check is marked inconclusive and its points come out of the denominator — we don't score you zero for our outage. If more than 25 points are unavailable, **we don't show a grade at all.**

**5. The letter is a band.** A 85–100, B 70–84, C 55–69, D 40–54, F 0–39.

Then close with the part that matters:

> "The reason it's built this way is that an insurer will eventually have to accept this number. **No insurer grants delegated underwriting authority to a black box.** If we can't show our working, we can never become more than a lead generator."

---

## Layer 3 — the hard questions

### "Where did the weights come from? Did you make them up?"

**Answer honestly. This is the question where bluffing gets caught.**

> "They're expert judgment, calibrated against four published methodologies — SSL Labs, Mozilla's HTTP Observatory, Internet.nl and the A–F convention that SecurityScorecard and BitSight trained the market on. They are **not** derived from Indian claims data, because that data isn't publicly available to anyone.
>
> Mozilla says the same thing about their own scoring — the ranges are 'essentially arbitrary... based on feedback from industry professionals.' That's the honest state of the art in this whole category. The commercial scores are the same thing with the working hidden.
>
> What makes ours defensible isn't that the weights are provably right. It's that they're **published, versioned, and recalibratable.** When we have an insurer partner and real loss data, we bump `rubric_version` to v1.1 and every historical scan can be rescored. Nobody else can do that, because nobody else wrote the numbers down."

**Do not say:** "it's based on industry data", "it's actuarially derived", "it's proprietary". The first two are false. The third throws away the only real advantage.

### "So the score is made up?"

> "The **weights** are judgment. The **findings** are facts — either you have a DMARC record or you don't, and you can verify every one of them yourself in about five minutes. That's the important half. We can argue about whether DMARC is worth 18 points or 15. We can't argue about whether it's there."

### "Can the AI change the score?"

> "No. It's architecturally prevented — the scoring module isn't allowed to import the AI module, and that's enforced in code review. The AI writes the explanations. It never produces a number that appears on this page."

### "What if the score is wrong?"

> "Two protections. The rubric is versioned, so we know exactly which rules produced any score we've ever shown. And the findings are listed individually — if you think a finding is wrong, you can check it against your own DNS in a minute. We'd rather be corrected than be opaque."

### "Is this a real insurance quote?"

> "No, and we say so on the page. It's an indicative range. **The premium tables aren't insurer-validated yet** — they're directional estimates from public claim-cost patterns. Every rupee figure on screen says 'estimated'. A real quote needs an underwriter, and that's Stage 4."

Say this before they ask. Volunteering it reads as careful; being caught on it reads as overselling.

### "Couldn't a competitor copy this?"

> "They could copy the rubric in a day — it's published. What they can't copy is the scan history. Every scan is a time-stamped record of a real company's posture, and after a year that's a dataset an insurer will pay for. **The rubric is the thing we give away. The evidence is the product.**"

### "Does the score guarantee we're secure?"

> "No. It measures what's observable from outside your domain. You could score an A and still have an AWS key in a public repo. Internet.nl and Mozilla both carry the same caveat. **Closing that gap is exactly what the connector layer does** — and that's the roadmap conversation."

---

## The three sentences to have ready

1. **"AI explains. It never scores and never prices."**
2. **"The weights are judgment, published and versioned. The findings are facts you can verify yourself."**
3. **"No insurer grants delegated authority to a black box — so we built it so it can never be one."**

---

## What not to do in the room

| ❌ | Why |
|---|---|
| Claim the rubric is actuarial | It isn't. One informed question and your credibility is gone |
| Call it proprietary | Opacity is the competitors' position. Publishing is ours |
| Tune the rubric so the demo looks better | The worked-example test exists to stop exactly this. If it goes red, someone did it |
| Over-explain when they're already satisfied | Layer 1 is often the whole answer |
| Hide the placeholder premiums | Say it first. It costs nothing when volunteered and everything when discovered |
