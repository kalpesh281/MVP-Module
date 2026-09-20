# Defending the Premium

> *"Where does that number come from?"*

The companion to [defending-the-score.md](defending-the-score.md). The score is
the thing we are proud of; **the premium is the thing that gets questioned**,
because it is the only figure on the page in rupees.

**The governing rule: volunteer the weakness before it is found.** These rates
are not insurer-validated and saying so first costs nothing. Being caught on it
costs the meeting.

---

## Layer 1 — the 20-second answer

> "Two inputs. Your grade, and a revenue band we estimate from public signals.
> Those two pick a row out of a published rate card, and the cover amount
> follows the band. No AI touches it — it's a table lookup, and the same two
> inputs give the same number every time."

Stop there.

---

## Layer 2 — the 2-minute answer

Walk it on their own page. The tooltip on the premium card shows the entire
derivation, which is the point — there is nothing behind it they cannot see.

```
Grade A · ₹25–100 Cr revenue · ₹5 Cr of cover · rate card v1.1
```

**1. Grade comes from the rubric.** Already defended, already reproducible.

**2. Revenue band comes from the size estimate** in the company profile, mapped
through a four-row table: under ₹5 Cr, ₹5–25 Cr, ₹25–100 Cr, over ₹100 Cr.

**3. Cover follows the band.** ₹1 Cr for the smallest, ₹25 Cr for the largest.
A starting point a broker would recognise, not a needs analysis — that needs
their contract liability caps, which is a Tier 1 question.

**4. The rate card is a published table**, 4 bands × 5 grades, versioned as
`rate_version`. Every scan we have ever shown records which version priced it.

**5. Grade F is not priced.** It returns *referred*, not a number. Showing a
premium for a company most insurers would decline would be the one outright
dishonest thing in the product.

---

## Layer 3 — the hard questions

### "Are these real rates?"

**Say this before they ask.**

> "No. They're directional estimates of the Indian cyber market, sanity-checked
> against published broker ranges — not an insurer's rate card. Nobody publishes
> those; rates *are* the competitive position. Every rupee figure on screen says
> estimated, and the page says 'not a quote.'
>
> What we've built is the structure. The day we have a partner insurer, we drop
> their rates in, bump `rate_version`, and every historical scan reprices. The
> table is the placeholder. The machinery around it isn't."

### "Every company is different. How can two inputs be enough?"

> "They're not enough for a quote, and we don't claim one. This is a market
> range — the shape of what cover costs for a company in your band at your
> posture.
>
> Narrowing it means asking you five questions: actual revenue, the cover you
> want, your data types, your claims history. That's the next step, and we ask
> it *after* you already have the report. The free number is deliberately
> coarse and honest rather than precise and invented."

### "You know our industry and our data types. Why don't you use them?"

The strongest answer in this document. **Do not treat it as a gap.**

> "We hold them and deliberately don't price on them. Both are inferred by a
> model reading your website. The moment we load your premium because our AI
> decided you're fintech, you'd be entitled to ask how it decided, and I'd have
> no good answer — and neither would an underwriter.
>
> A coarse number with a derivation you can check beats a precise one you have
> to take on faith. Those factors come in at Tier 1, when you've told us rather
> than when we've guessed."

### "Why is the premium for a big company so much higher?"

> "Two reasons compounding: a higher revenue band, and a larger cover amount.
> A ₹25 Cr policy is not five times a ₹5 Cr policy — the multipliers are in the
> published table, and they're sub-linear, which is how cover actually prices."

### "Can we show this to our broker?"

> "Yes, and we'd like you to. If their rates say we're wrong, that's the most
> useful thing that could happen to this table — and it's a version bump, not a
> rewrite."

---

## The three sentences to have ready

1. **"Two inputs, a published table, and the derivation is on the page."**
2. **"Directional estimates, not insurer-validated — and the page says so."**
3. **"We hold more data than we price on, on purpose."**

---

## What not to do in the room

| ❌ | Why |
|---|---|
| Call it a quote, or let "estimate" go unsaid | The one claim with regulatory exposure |
| Say the rates are market data | They're judgment against published ranges. Say that |
| Add factors to make it look sophisticated | Each one is a question you cannot answer |
| Demo a domain without checking the band | A household name landing in a small band undoes the whole meeting |

---

## Known limitations, written down

| Limitation | Resolved by |
|---|---|
| Rates are not insurer-validated | An insurer partnership. The blocker on Stage 4 |
| Revenue band inferred from a headcount guess | Tier 1 questions |
| Cover amount is a band default, not a needs analysis | Tier 1 questions |
| No claims-history or third-party-concentration factor | Tier 1 / proposal form |
| Indian cyber loss data is not public to anyone | Our own scan history, over time |
