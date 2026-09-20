# Getting Started — What You Need and How It Flows

---

## 1. Accounts and keys

### Required before the first line of code

| # | What | Where | Cost | Notes |
|---|---|---|---|---|
| 1 | **MongoDB Atlas cluster** | cloud.mongodb.com | **Free** (M0 tier) | Create cluster → database user with `readWrite` on `scorecard` → network access allowlist → copy the connection string |
| 2 | **One AI provider key** | console.groq.com | **Free** tier, ₹0/scan | `GROQ_API_KEY`. Groq has served 100% of real scans. OpenRouter (`OPENROUTER_API_KEY`) is the configured fallback and is optional. **Neither is a hard requirement** — with no key set, every scan still produces a score, a grade, a premium, a cover recommendation and a scenario; only the prose falls back to static copy. `test_scan_without_any_provider` proves it. |
| 3 | **Python 3.11+** | local | Free | `python3 --version` |
| 4 | **Node 20+** | local | Free | `node --version` |

That is the entire hard requirement list. Four items, none of which costs money — the AI key is a free tier and is optional on top of that.

### Needed before launch, not before coding

| # | What | Where | Cost | Blocks |
|---|---|---|---|---|
| 5 | **Cert Spotter API key** | sslmate.com/certspotter | **Free** — 100 requests/hour | `CERTSPOTTER_TOKEN`. The primary certificate-transparency source for the subdomain check. Without it we fall back to crt.sh, which answered roughly **1 time in 6** in testing and takes 3.8–8.5 s against Cert Spotter's 1.2–2.6 s. A CT outage blanks the grade entirely (subdomains 23 + creds_accounts 12 = 35, over the 25-point suppression threshold), so in practice this key is close to required. |
| 6 | **HIBP API key** | haveibeenpwned.com/API/Key | ≈ ₹350/month | Without it the breached-credentials check returns `inconclusive` and its 20 points (`creds` 8 + `creds_accounts` 12) are excluded, so a live scan is scored out of **88**, not 100. Everything else works. Note the wording rule: without the keyed half we say "no disclosed breach on record", never "no leaked credentials". |
| 7 | **Domain + hosting** | Vercel (frontend) + Railway/Render (backend) | Free tier → ≈ ₹500/month | Only needed to ship publicly. Also the point at which `USER_AGENT` should stop pointing at a GitHub profile and start pointing at a company page. |

### Needed later, not now

| # | What | Needed for |
|---|---|---|
| 8 | Shodan API key (≈ ₹6,000/mo) | Tier 2 — exposed services check |
| 9 | Google Cloud / Microsoft app registration | Tier 3 — OAuth connectors |
| 9 | **IRDAI-licensed broker partner** | Phase 4 — actually placing policies |
| 10 | **Insurer partner** | Validating the premium tables, which are currently placeholders |

Items 9 and 10 are business development, not engineering. Start those conversations in parallel with the build — they take months, not days.

---

## 2. Running total to get Tier 0 live

| Item | Monthly |
|---|---|
| MongoDB Atlas M0 | ₹0 |
| HIBP | ₹350 |
| Hosting (free tiers) | ₹0 |
| AI, at 1,000 scans | ₹13,000 |
| **Total** | **≈ ₹13,350/month at 1,000 scans** |

At 100 scans/month it is under ₹2,000. The cost scales with usage, and usage means traction.

---

## 3. Local setup

```bash
# Backend
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in MONGODB_URI + one AI key
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
npm create vite@latest frontend -- --template react
cd frontend && npm install && npm run dev
```

Verify the backend streams before building anything on top of it:

```bash
curl -N "http://localhost:8000/api/scan?domain=example.com"
```

You should see `data: {...}` lines arriving one at a time, not all at once.

---

## 4. The user flow

What a founder actually experiences.

```
 1. Lands on the page
    ── one input, "Takes 30 seconds · No signup"

 2. Types their domain, hits Check

 3. Watches checks resolve live  (~30 seconds)
    ✓ Email authentication (SPF)   configured
    ✓ Certificate                  valid, expires in 240 days
    ✗ DMARC policy                 not found
    ⚠ Breach history               1 historic breach
    ⚠ Public subdomains            3 reachable

 4. Sees the result
    ── a letter grade, large
    ── an estimated annual premium range
    ── what they're already doing right

 5. Plays with the fix simulator          ← the moment that matters
    ── ticks "No DMARC policy"
    ── grade animates C → B
    ── premium animates ₹85,000 → ₹60,000
    ── "you'd save ~₹25,000"

 6. Clicks "Narrow it down"               ← the one metric
    ── three questions, 20 seconds  (Tier 1)
```

Nothing is asked of the user until step 6. No email, no signup, no modal.

---

## 5. The technical flow

```
Browser                    FastAPI                      External
   │                          │                             │
   ├─ GET /api/scan?domain= ─▶│                             │
   │                          ├─ normalise + validate       │
   │                          ├─ Mongo: cached < 6h? ───────┤ (if yes, replay + age)
   │                          │                             │
   │                          ├─ launch 5 checks concurrently
   │                          │    ├─ email_auth ──────────▶│ DNS TXT
   │◀── event: check ─────────┤    ├─ tls ─────────────────▶│ TLS handshake
   │◀── event: check ─────────┤    ├─ headers ─────────────▶│ HTTPS GET
   │◀── event: check ─────────┤    ├─ creds ───────────────▶│ HIBP API
   │◀── event: check ─────────┤    └─ subdomains ──────────▶│ crt.sh
   │                          │
   │                          ├─ on headers done ──────────▶│ AI call 1: classify
   │◀── event: profile ───────┤                             │  (overlaps slow checks)
   │                          │
   │                          ├─ rubric.score()      ← deterministic, no AI
   │                          ├─ grades.grade_for()  ← deterministic
   │                          ├─ pricing.premium_for() ← deterministic
   │                          ├─ fixes.build()       ← precompute every delta
   │                          │
   │                          ├─────────────────────────────▶│ AI call 2: report copy
   │                          │                              │  (fails → static template)
   │                          ├─ Mongo: insert scan
   │◀── event: result ────────┤
   │                          │
   ├─ user ticks fixes        │
   │  (pure local maths,      │   ← no network call; every delta
   │   no request)            │      already shipped in `result`
```

### Three rules this flow encodes

1. **AI never touches the score or the premium.** Those three `deterministic` lines run with no model involved. If every AI key were unset, the scan still produces a valid grade and price.
2. **Classification overlaps the slow checks.** Subdomain enumeration takes up to 8 seconds; AI call 1 runs during it, not after.
3. **Every fix delta is precomputed server-side.** The simulator is pure local arithmetic — ticking a box never hits the network.

---

## 6. The build flow

Build the deterministic path completely before adding AI. Build the frontend against a mock so it never waits on the backend.

```
        BACKEND                              FRONTEND
        ───────                              ────────
Day 1   domain.py, base.py                   Vite scaffold
        email_auth.py, tls.py                tokens.css
        headers.py, subdomains.py            DomainInput
        creds.py, runner.py                  useScan  ← against a MOCKED SSE file
        ↓ CLI prints all 5 checks            ↓ renders a fake scan end to end

Day 2   rubric.py, grades.py                 CheckFeed + CheckRow
        pricing.py, fixes.py                 GradeBadge, PremiumBand
        ↓ worked example reproduces          Strengths
        provider.py, classify.py             ↓ static result renders
        report.py, fallback.py

Day 3   main.py SSE                          FixList + simulate.js
        db.py, store.py                      CombinedRow  ← the simulator
        rate limiting                        TierOneCta, error states
        ↓ curl -N streams end to end         responsive + a11y pass
                            ╲                ╱
                             ╲──── join ────╱
                              real scan renders live
```

---

## 7. Definition of done

Tier 0 ships when all of these are true:

1. A valid domain produces a grade, a premium range, and at least one fix in under 30 seconds.
2. Checks stream individually — a bare spinner is never shown.
3. Ticking any combination of fixes updates grade and premium instantly, with animation, with no network call.
4. The same domain scanned twice within 6 hours returns the cached result, labelled with its age.
5. **A scan with every AI provider key unset still produces a valid grade and premium.**
6. **The worked example in [scoring-and-pricing.md §6](scoring-and-pricing.md#6-worked-example) reproduces exactly** — score 56, grade C.
7. Nothing is asked of the user before the result is shown.
8. No horizontal scroll at 320 px.
9. Every score is reproducible from `findings` + `rubric_version` alone.

Numbers 5 and 6 are the two that people skip and regret.

---

## 8. What you don't need

Explicitly not required for Tier 0, to protect the timeline:

- ❌ LangChain or LangGraph — see [ai-framework.md](ai-framework.md)
- ❌ A vector database — there is nothing to retrieve
- ❌ An OCR pipeline — Claude reads PDFs natively, and PDFs aren't in Tier 0 anyway
- ❌ Authentication, accounts, sessions
- ❌ An insurance licence
- ❌ Docker, Kubernetes, CI/CD
- ❌ A UI component library
- ❌ Redis — MongoDB TTL indexes handle rate limiting

---

## 9. Your first three commands tomorrow

```bash
cd /Users/macbook/Desktop/R\&D/backend
source .venv/bin/activate && pip install -r requirements.txt
# then write app/domain.py and app/scanner/email_auth.py
```

Start with `email_auth.py`. It is pure DNS lookups, it returns in under 200 ms, it carries 30 of the 100 points, and the DMARC finding is the one that makes the demo land.
