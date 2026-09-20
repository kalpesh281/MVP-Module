# Documentation Index

Product: **Cyber Risk Scorecard** — an AI-assisted cyber insurance platform for Indian SaaS/IT companies.

## Read in this order

| # | Doc | What it covers | For |
|---|---|---|---|
| 0 | [getting-started.md](getting-started.md) | What you need (keys, accounts, cost), the user flow, the technical flow, the build flow | **Start here** |
| 0a | [delivery-stages.md](delivery-stages.md) | **Stage 1 (Domain Scan) and Stage 2 (Coverage Guidance)** — scope, build order, acceptance, demo script for each | **Start here for the build** |
| 0c | [testing.md](testing.md) | **The test gates** — what must pass before each stage is signed off | **Start here before Stage 2** |
| 0d | [education-layer.md](education-layer.md) | **Why teaching is the product** — what they must learn, in what order, and how to write it | **Everyone** |
| 0e | [defending-the-score.md](defending-the-score.md) | **How to answer "how do you score this?"** — layered answers and the hard follow-ups | Client conversations |
| 0b | [vision.md](vision.md) | Where this goes: the six module ladders, adjacent revenue, defensibility, honest risks | Client conversations |
| 1 | [overview.md](overview.md) | What we're building and why, market context, competitors, tier ladder, roadmap | Everyone |
| 2 | [tier-0-scorecard-spec.md](tier-0-scorecard-spec.md) | The first shippable surface: screens, states, copy, interactions, API contract, acceptance criteria | Everyone building Tier 0 |
| 3 | [scoring-and-pricing.md](scoring-and-pricing.md) | The deterministic scoring rubric and premium tables — every rule ID and point value | Backend |
| 4 | [scan-checks.md](scan-checks.md) | Every external check: method, library, cost, latency, legal basis | Backend |
| 5 | [backend.md](backend.md) | FastAPI implementation guide: structure, concurrency, SSE, testing, day-by-day build order | Backend |
| 6 | [database.md](database.md) | MongoDB schema, indexes, cache, rate limiting, analytics queries | Backend |
| 7 | [ai-layer.md](ai-layer.md) | The four AI calls: schemas, prompts, cost, failure handling | Backend |
| 8 | [ai-framework.md](ai-framework.md) | LangChain vs LangGraph vs direct SDK — the decision, with working code for all three | Backend |
| 8b | [coverage-guidance.md](coverage-guidance.md) | Limit recommendation + claim scenario modules — the two blocks that make it read like a broker | Backend + Frontend |
| 8c | [demand-triggers.md](demand-triggers.md) | The nine reasons companies actually buy, and how the trigger enters the product | Product + Frontend |
| 9 | [frontend.md](frontend.md) | React implementation guide: components, design tokens, the fix simulator, accessibility | Frontend |

## Core principles

1. **AI explains. It never scores and never prices.** The score and premium come from a deterministic rubric that must be reproducible from raw findings plus a version string. See [scoring-and-pricing.md](scoring-and-pricing.md).
2. **Never ask before giving.** Every tier states its reward before its ask. Tier 0 asks for nothing — not even an email.
3. **Passive scanning only.** No port scanning or probing of infrastructure we don't own. See [scan-checks.md](scan-checks.md#legal-basis).
4. **The product works with AI offline.** Grade and premium have no model dependency.
5. **A stage is done when its gate is green, not when the code runs.** See [testing.md](testing.md).
6. **The demand trigger is captured, never assumed, and never reaches `scoring/`.** See [demand-triggers.md](demand-triggers.md).
7. **Teach through their own data, never in the abstract.** Every explanation is anchored to a finding on their domain. See [education-layer.md](education-layer.md).

## Conventions

- **Tier N** refers to the progressive-disclosure ladder in [overview.md](overview.md#the-tier-ladder). Tier 0 is the free, no-signup domain scan.
- All monetary figures are INR.
- **PLACEHOLDER** marks anything that must be calibrated with an insurer partner before being shown as more than an estimate.
- `scoring/` must never import from `ai/`. Enforce in review.

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic v2, asyncio |
| Database | MongoDB Atlas via `pymongo` 4.9+ `AsyncMongoClient` |
| Frontend | React 18, Vite, plain CSS with custom properties |
| AI | Claude Opus 5 or GPT-5 behind a thin adapter — **no LangChain for Tier 0** |
| Transport | Server-Sent Events |

## Status

| Component | Status |
|---|---|
| Documentation | ✅ Complete for Stages 1, 2, 2.5 |
| **Gate 1 (Stage 1)** | ❌ Not passed |
| **Gate 2 (Stage 2)** | ❌ Blocked on Gate 1 |
| Backend scaffold | Partial — `config.py`, `requirements.txt`, `.env.example` |
| Scanner | ❌ Not started |
| Scoring engine | ❌ Not started |
| AI layer | ❌ Not started |
| Frontend | ❌ Not started |

## Open items

- Premium tables in [scoring-and-pricing.md §4](scoring-and-pricing.md#4-premium) are **placeholders**, not insurer-validated.
- No IRDAI-licensed broker partner identified for Phase 4 placement.
- No insurer identified for eventual delegated authority.
- Data retention and deletion policy required **before Tier 3**, when OAuth connectors begin returning employee-level data.
