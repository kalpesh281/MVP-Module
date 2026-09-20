# Backend Implementation Guide

**Stack:** Python 3.11+ · FastAPI · Pydantic v2 · asyncio · MongoDB (`pymongo` async)
**Scope:** Tier 0 only — see [tier-0-scorecard-spec.md](tier-0-scorecard-spec.md)

---

## 1. Setup

```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add at least one AI provider key
uvicorn app.main:app --reload --port 8000
```

Verify: `curl -N "http://localhost:8000/api/scan?domain=example.com"` should stream SSE events.

---

## 2. Folder structure

```
backend/
├── requirements.txt
├── .env.example
└── app/
    ├── config.py            # env, timeouts, versions, constants      [done]
    ├── main.py              # FastAPI app, SSE endpoint, CORS
    ├── models.py            # all Pydantic schemas (API + internal)
    ├── store.py             # scan persistence + cache lookup
    ├── domain.py            # domain normalisation and validation
    │
    ├── scanner/
    │   ├── base.py          # CheckResult dataclass, Deduction, helpers
    │   ├── email_auth.py    # SPF + DKIM + DMARC        (30 pts)
    │   ├── creds.py         # breached credentials      (20 pts)
    │   ├── tls.py           # certificate + protocol    (15 pts)
    │   ├── headers.py       # security headers + HTML   (12 pts)
    │   ├── subdomains.py    # crt.sh attack surface     (23 pts)
    │   └── runner.py        # concurrent orchestration, yields as they finish
    │
    ├── scoring/
    │   ├── rubric.py        # rule IDs → points, score computation
    │   ├── grades.py        # score → grade bands
    │   ├── pricing.py       # premium lookup tables
    │   └── fixes.py         # deduction groups → fix objects with deltas
    │
    └── ai/
        ├── provider.py      # LLM protocol + registry + auto-detect
        ├── claude.py        # Anthropic implementation
        ├── openai_compat.py # OpenAI / Groq / OpenRouter (same class)
        ├── classify.py      # call 1
        ├── report.py        # call 2
        └── fallback.py      # static template when AI is unavailable
```

**Rule:** `scoring/` must never import from `ai/`. The score and premium are computed with no model in the loop. Enforce it in review.

---

## 3. Request flow

```
GET /api/scan?domain=yourco.com
        │
        ├─ domain.normalise()  → reject invalid / free-mail
        ├─ store.get_cached()  → if < 6h old, replay stored result, mark age
        │
        └─ runner.run(domain)  ─── asyncio, 5 checks concurrently
                │
                ├─ yield  event: check   (×5, as each completes)
                │         └─ on `headers` completing, fire AI call 1 as a task
                │
                ├─ rubric.score(deductions)        → score, available_points
                ├─ grades.grade_for(score)         → "C"
                ├─ await classify_task             → CompanyProfile
                ├─ yield  event: profile
                ├─ pricing.premium_for(...)        → {low, high}
                ├─ fixes.build(deductions, score)  → per-fix deltas, grades, premiums
                ├─ await report(...)               → titles, copy, strengths
                │         └─ on failure: fallback.static_report()
                ├─ store.save()
                └─ yield  event: result
```

**Important:** AI call 1 starts the moment the `headers` check returns HTML — not after all checks finish. Subdomain enumeration takes up to 8 s; classification should overlap it, not follow it.

---

## 4. Concurrency pattern

Checks must stream as they complete, but render in a fixed order on the client. Use a queue, not `gather`:

```python
# app/scanner/runner.py
import asyncio
from .base import CheckResult

CHECKS = [
    ("email_auth", email_auth.run, 3.0),
    ("tls",        tls.run,        5.0),
    ("headers",    headers.run,    6.0),
    ("creds",      creds.run,      8.0),
    ("subdomains", subdomains.run, 8.0),
]

async def run(domain: str):
    queue: asyncio.Queue[CheckResult] = asyncio.Queue()

    async def worker(name, fn, timeout):
        try:
            result = await asyncio.wait_for(fn(domain), timeout)
        except asyncio.TimeoutError:
            result = CheckResult.inconclusive(name, "timed out")
        except Exception as exc:                      # never fail the scan
            logger.exception("check %s crashed", name)
            result = CheckResult.inconclusive(name, str(exc))
        await queue.put(result)

    tasks = [asyncio.create_task(worker(*c)) for c in CHECKS]
    for _ in CHECKS:
        yield await queue.get()
    await asyncio.gather(*tasks, return_exceptions=True)
```

A crash in one check must never fail the scan. Inconclusive checks have their points removed from the denominator — see [scoring-and-pricing.md §3](scoring-and-pricing.md#3-inconclusive-checks).

---

## 5. Check contract

Every check returns the same shape.

```python
# app/scanner/base.py
from dataclasses import dataclass, field
from typing import Any, Literal

Status = Literal["pass", "warn", "fail", "inconclusive"]

@dataclass
class Deduction:
    rule: str          # "dmarc.absent"
    points: int

@dataclass
class CheckResult:
    id: str                              # "dmarc"
    label: str                           # "DMARC policy"
    status: Status
    detail: str                          # "No DMARC record found"
    evidence: dict[str, Any] = field(default_factory=dict)
    deductions: list[Deduction] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)   # e.g. html for classify

    @classmethod
    def inconclusive(cls, id: str, why: str) -> "CheckResult":
        return cls(id=id, label=id, status="inconclusive", detail=why)
```

`evidence` is **mandatory** on every non-inconclusive result. If a customer or underwriter disputes a finding we must show exactly what we observed.

A single module may emit **several** `CheckResult`s — `email_auth.py` emits three (`spf`, `dkim`, `dmarc`). Have it return a list and let the runner fan them into the queue.

---

## 6. Implementing each check

Point values, rule IDs, and thresholds are in [scoring-and-pricing.md §1](scoring-and-pricing.md#1-score). Methods and legal constraints are in [scan-checks.md](scan-checks.md). Do not invent values — read those docs.

### email_auth.py

```python
import dns.asyncresolver

async def _txt(name: str) -> list[str]:
    try:
        answers = await dns.asyncresolver.resolve(name, "TXT")
        return ["".join(s.decode() for s in r.strings) for r in answers]
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return []
```

- **SPF:** apex TXT starting `v=spf1`. Read the trailing qualifier (`-all` / `~all` / `?all` / `+all`). Count DNS-querying mechanisms (`include`, `a`, `mx`, `ptr`, `exists`, `redirect`) — more than 10 is invalid per RFC 7208.
- **DMARC:** TXT at `_dmarc.<domain>` starting `v=DMARC1`. Parse `p=` and presence of `rua=`.
- **DKIM:** probe selectors `google, selector1, selector2, k1, s1, default, mail, dkim, zoho, mandrill` at `<sel>._domainkey.<domain>`. **Absence is `warn`, never `fail`** — a custom selector may exist that we cannot enumerate.

### tls.py

```python
import ssl, asyncio

ctx = ssl.create_default_context()
reader, writer = await asyncio.open_connection(domain, 443, ssl=ctx, server_hostname=domain)
sslobj = writer.get_extra_info("ssl_object")
cert    = sslobj.getpeercert()
version = sslobj.version()
writer.close(); await writer.wait_closed()
```

Collect issuer, subject, SAN list, `notBefore` / `notAfter`, negotiated version, cipher, chain validity, hostname match.

**Feed the SAN list into `subdomains.py`** — it is a free source of hostnames and the fallback when crt.sh is down.

Legacy-protocol detection needs a second handshake with `ctx.maximum_version = ssl.TLSVersion.TLSv1_1`. Run it only if the first handshake succeeded, and give it its own 2 s budget.

### headers.py

```python
async with httpx.AsyncClient(follow_redirects=True, max_redirects=3,
                             timeout=6.0, headers={"User-Agent": USER_AGENT}) as c:
    r = await c.get(f"https://{domain}/")
```

Inspect `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options` (or CSP `frame-ancestors`), `X-Content-Type-Options`.

**Do not report missing `X-XSS-Protection`.** It is deprecated and reporting it signals an unserious tool.

Return the response body and server headers in `extra` — this is the input to AI call 1.

### creds.py

Requires `HIBP_API_KEY`. Without it, return `inconclusive` — **never return `pass`**. A company must never be graded well because a check could not run.

The HIBP domain-search endpoint requires proven domain ownership, which Tier 0 does not have. Implement against the unverified breach-metadata endpoints, document precisely what they can and cannot see, and never display a count we cannot substantiate.

### subdomains.py

1. `GET https://crt.sh/?q=%25.<domain>&output=json` — 8 s hard timeout
2. Deduplicate, strip wildcards, merge with SANs from `tls.py`
3. Resolve each; for live hosts, one `HEAD` request
4. Flag hosts matching the risk patterns in [scan-checks.md](scan-checks.md#5-attack-surface--subdomains) that resolve **and** return < 400

crt.sh is frequently slow or down. On failure, fall back to TLS SANs; if that yields nothing, mark `inconclusive`.

---

## 7. Scoring engine

```python
# app/scoring/rubric.py
WEIGHTS = {"dmarc": 18, "spf": 7, "dkim": 5, "creds": 20,
           "tls": 15, "headers": 12, "surface": 23}   # = 100

def score(results: list[CheckResult]) -> tuple[int, int]:
    """Returns (score, available_points)."""
    available = sum(
        WEIGHTS[r.id] for r in results if r.status != "inconclusive"
    )
    if available == 0:
        raise TooManyInconclusive
    deducted = sum(d.points for r in results for d in r.deductions)
    raw = max(0, available - deducted)
    return round(100 * raw / available), available
```

If inconclusive checks total **more than 25 points**, raise and let `main.py` emit a partial report with no grade.

```python
# app/scoring/grades.py
BANDS = [(85, "A"), (70, "B"), (55, "C"), (40, "D"), (0, "F")]

def grade_for(score: int) -> str:
    return next(g for threshold, g in BANDS if score >= threshold)
```

```python
# app/scoring/fixes.py
def build(results, score, revenue_band, limit):
    """Group deductions into user-facing fixes and precompute every delta."""
    for fix in grouped:
        fix.score_delta      = sum(d.points for d in fix.deductions)
        fix.grade_if_fixed   = grade_for(score + fix.score_delta)
        fix.premium_if_fixed = premium_for(fix.grade_if_fixed, revenue_band, limit)
```

**Every delta is precomputed server-side** and shipped in the `result` payload, so the frontend's fix simulator needs no network call.

Grouping: all `dmarc.*` → one fix; all `hdr.*` → one "security headers" fix; all `surface.*` → one "attack surface" fix. Per-rule fixes would produce an unreadable list.

---

## 8. SSE endpoint

```python
# app/main.py
@app.get("/api/scan")
async def scan(domain: str):
    try:
        domain = normalise(domain)
    except InvalidDomain as e:
        return JSONResponse({"type": "error", "code": e.code, "message": e.message}, 400)

    async def events():
        started = time.monotonic()
        async for payload in orchestrate(domain):
            yield f"data: {json.dumps(payload)}\n\n"
            if payload["type"] == "result":
                # instant results read as fake
                remaining = MIN_SCAN_DWELL - (time.monotonic() - started)
                if remaining > 0:
                    await asyncio.sleep(remaining)

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",     # stops nginx buffering the stream
    })
```

`X-Accel-Buffering: no` is easy to forget and produces a stream that works locally and buffers in production.

Event payload shapes are specified in [tier-0-scorecard-spec.md §7](tier-0-scorecard-spec.md#7-api-contract). Match them exactly — the frontend is written against them.

---

## 8b. Refine endpoint — Stage 2.5

Not built in Stage 1. Specified here so the Stage 1 payload is shaped to accept it.

```python
class RefineRequest(BaseModel):
    revenue_band: Literal["under_5cr", "5_25cr", "25_100cr", "over_100cr"]
    headcount_band: Literal["1_10", "11_50", "51_200", "200_plus"]
    data_types: list[Literal["pii", "card", "health", "financial", "none"]]
    demand_trigger: DemandTrigger | None = None     # optional, never required

@app.post("/api/scan/{scan_id}/refine")
async def refine(scan_id: str, body: RefineRequest):
    scan = await store.get(scan_id)
    if scan is None:
        return JSONResponse({"type": "error", "code": "not_found"}, 404)

    # NO re-scan. Findings are unchanged, so the grade is unchanged.
    priced   = pricing.quote(scan["grade"], body.revenue_band, body.data_types)
    coverage = coverage_mod.recommend(body.data_types, body.headcount_band)
    scenario = scenarios.pick(scan["findings"], coverage)

    await store.add_refinement(scan_id, body, priced, coverage, scenario)
    return {"grade": scan["grade"], "premium": priced,
            "coverage": coverage, "scenario": scenario}
```

Three hard rules:

1. **`scan["grade"]` is returned untouched.** The posture did not change; only what we know about the company did. A grade that moves when a user answers a question destroys trust in the grade.
2. **No outbound network calls.** No DNS, no HTTP, no HIBP. Assert it in a test.
3. **`demand_trigger` never reaches `scoring/` or `pricing/`.** It is a presentation and routing field only — see [demand-triggers.md §4](demand-triggers.md#4-how-this-enters-the-product).

Returns in under 3 seconds; no streaming needed.

---

## 9. Storage

**MongoDB via `pymongo` 4.9+ `AsyncMongoClient`.** Full schema, indexes, cache lookup,
rate-limit implementation, and the day-one analytics queries are in
[database.md](database.md).

The three things to get right:

- One client per process, created in the FastAPI lifespan — never per request.
- `rubric_version` and `rate_version` on every scan document, always.
- Scan documents are append-only. The only permitted updates are setting `cta_clicked` and attaching `refinement` once (Stage 2.5). `findings`, `score` and `grade` are never rewritten.

## 10. Rate limiting

| Control | Value |
|---|---|
| Per IP | 10 scans / hour |
| Per domain | 1 full scan / 6 hours, then serve cache |
| Concurrent scans per instance | 20 |

Implemented as an atomic `find_one_and_update` against the TTL-indexed `rate_limits` collection — see [database.md §6](database.md#6-rate-limiting). **Not in-memory counters**, which do not survive a restart and break across multiple workers. No Redis is needed; MongoDB TTL indexes handle expiry. A cached result must carry its age so the UI can render "Last checked 3 hours ago · Re-check" — never present a cached result as live.

---

## 11. Error handling

| Situation | Behaviour |
|---|---|
| Invalid / unresolvable domain | 400 with a specific `code`; do not start the scan |
| Free-mail domain | 400, `free_mail_domain` |
| One check crashes | Mark inconclusive, continue, log with traceback |
| > 25 points inconclusive | Partial report, no grade |
| AI call 1 fails | Proceed with no profile; default to the smallest revenue band |
| AI call 2 fails | `fallback.static_report()` — the scan still yields grade and premium |
| AI returns a fix whose `id` is not in the actual deductions | Drop it, log it |

**Design consequence, stated deliberately:** with the entire AI layer offline, the product still returns a working scorecard. Test this by unsetting every provider key and running a scan. It must pass.

---

## 12. Testing

```
tests/
├── fixtures/          # recorded DNS, TLS, HTTP, crt.sh responses
├── test_rubric.py     # every rule ID → expected points
├── test_rescale.py    # inconclusive handling, >25-point grade suppression
├── test_grades.py     # band boundaries: 84/85, 69/70, 54/55, 39/40
├── test_pricing.py    # every grade × revenue band × limit
├── test_fixes.py      # grouping, deltas, combined score
├── test_scanner.py    # each check against fixtures, plus timeout and crash paths
└── test_flow.py       # full SSE flow with AI mocked out
```

Two tests that matter more than the rest:

1. **The worked example in [scoring-and-pricing.md §6](scoring-and-pricing.md#6-worked-example) must reproduce exactly** — score 54, grade D, and the four projected outcomes. If the rubric changes, that doc changes with it.
2. **Full scan with no provider keys set** must produce a valid grade and premium.

---

## 13. Build order

| Day | Deliverable | Verified by |
|---|---|---|
| **1 AM** | `domain.py`, `base.py`, `email_auth.py`, `tls.py` | `pytest tests/test_scanner.py` |
| **1 PM** | `headers.py`, `subdomains.py`, `creds.py`, `runner.py` | CLI script prints all 5 results for a real domain |
| **2 AM** | `rubric.py`, `grades.py`, `pricing.py`, `fixes.py` | Worked example reproduces exactly |
| **2 PM** | `provider.py`, `classify.py`, `report.py`, `fallback.py` | Report generates; also works with keys unset |
| **3 AM** | `main.py` SSE, `db.py`, `store.py`, rate limiting | `curl -N` streams events end to end |
| **3 PM** | Hand off to frontend | Frontend renders a live scan |

Build the deterministic path first and completely. The AI layer goes on top of something that already works.
