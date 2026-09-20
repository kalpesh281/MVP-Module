# How a Scan Works

One domain, one request, thirty seconds. This is the whole path from a
keystroke to a report, in order, with the timings and the failure paths.

Companion to [defending-the-score.md](defending-the-score.md) and
[defending-the-premium.md](defending-the-premium.md) — those answer *why the
numbers are what they are*, this answers *what actually happens*.

---

## The flow

```
  ┌─────────┐
  │  USER   │  types "https://Zerodha.com/pricing"
  └────┬────┘
       │
       ▼
╔══════════════════════════════════════════════════════════════════════╗
║ BROWSER                                                              ║
║                                                                      ║
║  normalise ──► zerodha.com          DomainInput / utils/format.js    ║
║  route     ──► /scan/zerodha.com                                     ║
║  fetch + ReadableStream (not EventSource)        hooks/useScanStream ║
║      └─ ref guard: StrictMode mounts twice, one scan must survive    ║
╚══════════════════════════════════════════╤═══════════════════════════╝
                                           │  GET /api/scan?domain=…
                                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║ API                                                  app/main.py:100 ║
║                                                                      ║
║   1. normalise()  ──✗──► 400  free-mail domain, malformed input      ║
║   2. rate limit   ──✗──► 429  10 scans / IP / hour                   ║
║   3. open SSE stream, X-Accel-Buffering: no                          ║
╚══════════════════════════════════════════╤═══════════════════════════╝
                                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║ ORCHESTRATOR                                    app/orchestrator.py  ║
║                                                                      ║
║  ┌────────────────────────────────────────────────────────────────┐  ║
║  │ CACHE?  a scan of this domain under 6 hours old                │  ║
║  │   hit ──► replay stored findings as events, then the result    │  ║
║  │           with cached:true + cache_age_seconds ──► DONE        │  ║
║  │           (the UI is REQUIRED to render "Last checked …")      │  ║
║  └────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════╤═══════════════════════════╝
                                           │ miss
                                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║ SCANNER — five workers concurrently          app/scanner/runner.py   ║
║                                                                      ║
║   email_auth  5s   DNS TXT ──► SPF · DKIM · DMARC        (3 rows)    ║
║   tls        10s   certificate from a normal handshake               ║
║   headers     8s   response headers from ONE GET  ───────┐           ║
║   creds      10s   public breach databases               │           ║
║   subdomains 15s   Cert Spotter ∥ crt.sh, then a sweep   │           ║
║                                                          │           ║
║   each result is yielded THE MOMENT IT LANDS ────────────┼──► SSE    ║
║   (not asyncio.gather: that resolves all-at-once and     │    check  ║
║    the feed would sit dead, then fill instantly)         │    events ║
╚══════════════════════════════════════════════════════════╪═══════════╝
                                                           │
                          headers carries the homepage HTML │
                                                           ▼
                                        ╔══════════════════════════════╗
                                        ║ AI CALL 1 — classify         ║
                                        ║  starts NOW, in background,  ║
                                        ║  does not wait for crt.sh    ║
                                        ║  ──► industry, size band,    ║
                                        ║      data types, DPDP        ║
                                        ║  schema has NO numeric field ║
                                        ╚══════════════╤═══════════════╝
                                                       │
       all checks in ──────────────────────────────────┤
                                                       ▼
╔══════════════════════════════════════════════════════════════════════╗
║ DETERMINISTIC HALF — no model has been consulted about any number    ║
║                                                                      ║
║   findings ──► score()          rubric.py    100 minus deductions    ║
║               grade_for()       grades.py    A–F band                ║
║               band_for_headcount()           ← profile's ONLY role   ║
║               limit_for_band()               cover follows the band  ║
║               premium_for()     pricing.py   a TABLE LOOKUP          ║
║               build_fixes()     fixes.py     deltas by RE-SCORING    ║
║                                                                      ║
║   scoring/ may not import ai/ — enforced by a test                   ║
╚══════════════════════════════════════════╤═══════════════════════════╝
                                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║ AI CALL 2 — prose only, on a leash                                   ║
║                                                                      ║
║   budget = 30s − elapsed                                             ║
║     < 4s left  ──────────────► static copy, model never called       ║
║     times out  ──────────────► static copy                           ║
║     invents a fix id ────────► that fix is DROPPED + logged          ║
║                                                                      ║
║   It writes the words around numbers that already exist.             ║
╚══════════════════════════════════════════╤═══════════════════════════╝
                                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║ RESULT                                                               ║
║                                                                      ║
║   payload: score · grade · premium · premium_table (EVERY grade)     ║
║            fixes · strengths · rubric_version · rate_version         ║
║                                                                      ║
║   ──► MongoDB, append-only, both versions stamped                    ║
║   ──► if elapsed < 4s: WAIT. Instant results read as fake.           ║
╚══════════════════════════════════════════╤═══════════════════════════╝
                                           ▼
╔══════════════════════════════════════════════════════════════════════╗
║ BROWSER — the report, three steps                                    ║
║                                                                      ║
║   The checks  ──►  Your result  ──►  What to do                      ║
║                    (grade + premium)   (fix simulator)               ║
║                                                                      ║
║   Ticking a fix sends NOTHING. premium_table shipped every grade's   ║
║   price, so the browser repriced without a request.    Gate 1 §1.5   ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## The two halves

The single most important line in the diagram is the one between them.

| | Deterministic half | Explanatory half |
|---|---|---|
| Produces | score, grade, premium, fix deltas | headline, fix descriptions, strengths |
| Source | published tables | a language model |
| Reproducible | yes, from `findings` + versions | no, and it does not need to be |
| If it fails | the scan fails | static copy ships, page still complete |

**AI explains. It never scores and never prices.** The product works fully with
the AI layer switched off — it just reads more plainly.

---

## What actually leaves the building

Per scan, measured:

```
  6 × GET    DNS-over-HTTPS, homepage, breach DB, 2 CT logs
  2 × HEAD   liveness of discovered hosts
  1 × TLS    ordinary handshake, certificate read
```

No port scan. No fuzzing. No authentication attempt. Nothing written anywhere
we do not own. Every request carries a truthful User-Agent with a contact URL.
Active checks require written authorisation and are Tier 3+ only —
see [scan-checks.md](scan-checks.md).

---

## Timings

| Budget | Value | Why |
|---|---|---|
| Per-check | 5–15s | Must exceed the sum of the check's own internal timeouts, or the runner kills work that already succeeded |
| Whole scan | 30s | `SCAN_HARD_LIMIT` |
| Minimum dwell | 4s | A result in 300ms reads as a lookup, not an inspection |
| AI call 2 | whatever's left | Never allowed to extend the scan |
| Cache | 6 hours | Re-check is always offered |
| Rate limit | 10 / IP / hour | |

---

## Failure paths, and what the user sees

| What fails | What happens |
|---|---|
| One check times out | That row reads **inconclusive**; its points leave the denominator. We never score a company well because our own scanner failed |
| More than 25 points inconclusive | **No grade shown at all**, and the premium is *referred* |
| Every AI provider down | Static headline and fix copy. No visible failure |
| MongoDB down | The scan completes and renders; it just isn't stored |
| Model invents a finding | Dropped before render, warning logged |
| Grade F | Premium is `referred: true`, never a number |
| User closes the tab | `CancelledError` → workers cancelled, nothing orphaned |
