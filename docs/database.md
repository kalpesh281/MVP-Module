# Database — MongoDB

**Driver:** `pymongo` (async API) · **Deployment:** MongoDB Atlas

---

## 1. Driver choice

Use **`pymongo` 4.9+ with `AsyncMongoClient`**. It is the officially supported async API and replaces Motor, which is now in maintenance. Do not add `motor` to a new project.

```bash
pip install "pymongo>=4.9"
```

```python
# app/db.py
import os
from pymongo import AsyncMongoClient

_client: AsyncMongoClient | None = None

def client() -> AsyncMongoClient:
    global _client
    if _client is None:
        _client = AsyncMongoClient(
            os.environ["MONGODB_URI"],
            serverSelectionTimeoutMS=5000,
            tz_aware=True,
        )
    return _client

def db():
    return client()[os.getenv("MONGODB_DB", "scorecard")]
```

Create the client **once at process start**, never per request. `AsyncMongoClient` owns its own connection pool; constructing one per request exhausts Atlas connection limits fast.

Wire it into the FastAPI lifespan so the pool closes cleanly:

```python
# app/main.py
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_indexes()
    yield
    await client().close()

app = FastAPI(lifespan=lifespan)
```

---

## 2. Environment

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=scorecard
```

**The URI is a credential.** It goes in `.env`, `.env` goes in `.gitignore`, and it is never committed, logged, or included in an error response. Percent-encode any special characters in the password.

In Atlas: restrict network access to known IPs rather than `0.0.0.0/0`, and give the application user `readWrite` on the `scorecard` database only.

---

## 3. Collections

### `scans`

One document per completed scan. This is the only collection Tier 0 needs.

```js
{
  _id: "scn_01J8X...",            // app-generated, not ObjectId — it appears in shareable URLs
  domain: "yourco.com",
  scanned_at: ISODate("2026-09-20T09:14:00Z"),

  findings: [                      // raw check output — the audit trail
    {
      id: "dmarc",
      label: "DMARC policy",
      status: "fail",
      detail: "No DMARC record found",
      evidence: { lookup: "_dmarc.yourco.com", record: null },
      deductions: [ { rule: "dmarc.absent" } ]   // points come from the rubric, never the check
    }
  ],

  profile: {                       // AI call 1, null if it failed
    company_name: "Yourco",
    business_model: "B2B_SaaS",
    data_types_handled: ["PII"],
    dpdp_act_applies: true,
    estimated_size_band: "11-50"
  },

  score: 56,
  grade: "C",
  available_points: 88,            // < 100 when checks were inconclusive

  report: {                        // AI call 2 merged with computed deltas
    fixes: [ { id, title, why_it_matters, how_to_fix, effort,
               score_delta, grade_if_fixed, premium_if_fixed, priority } ],
    strengths: ["SPF configured", "TLS valid"],
    generated_by: "claude-opus-5"  // or "fallback" when AI was unavailable
  },

  premium: { low: 85000, high: 120000, currency: "INR", limit: 50000000 },

  rubric_version: "v1.0",          // mandatory
  rate_version: "v1.0",            // mandatory
  duration_ms: 18420,
  cta_clicked: false,

  # --- added at Tier 1 (Stage 2.5), absent until then ---
  refinement: {
    revenue_band:   "5_25cr",
    headcount_band: "11_50",
    data_types:     ["pii"],
    demand_trigger: "contract",   # nullable — "skipped" is expected and common
    refined_at:     ISODate(...)
  }
}
```

**`rubric_version` and `rate_version` are required on every document.** A score is only defensible if we can reproduce which rules produced it. Never mutate a rubric in place — publish `v1.1` and leave `v1.0` documents untouched.

Documents are **append-only**. The only permitted updates are setting `cta_clicked` and attaching `refinement` once. `findings`, `score` and `grade` are never rewritten — a refinement adds knowledge about the company, not about its posture.

`refinement.demand_trigger` is **analytics and routing only**. It must never be read by `scoring/` or `pricing/`. See [demand-triggers.md](demand-triggers.md). A re-scan creates a new document; it never overwrites the previous one. Scan history is the dataset we eventually take to an insurer.

### `events`

Analytics. Small, high-volume, disposable.

```js
{ _id: ObjectId, name: "fix_toggled", scan_id: "scn_...", ts: ISODate(),
  props: { fix_id: "dmarc", checked: true } }
```

### `rate_limits`

TTL-backed counters. Mongo expires them; no cleanup job needed.

```js
{ _id: "ip:203.0.113.4", count: 3, window_start: ISODate() }
```

---

## 4. Indexes

Create at startup, idempotently.

```python
async def ensure_indexes():
    d = db()
    await d.scans.create_index([("domain", 1), ("scanned_at", -1)])   # cache lookup
    await d.scans.create_index([("scanned_at", -1)])                  # recent scans
    await d.scans.create_index([("grade", 1), ("scanned_at", -1)])    # grade distribution

    await d.events.create_index([("name", 1), ("ts", -1)])
    await d.events.create_index([("scan_id", 1)])
    await d.events.create_index([("ts", 1)], expireAfterSeconds=90*24*3600)

    await d.rate_limits.create_index([("window_start", 1)], expireAfterSeconds=3600)
```

The compound `(domain, scanned_at desc)` index is the one that matters — every scan request hits it first for the cache check.

---

## 5. Cache lookup

```python
from datetime import datetime, timedelta, timezone

async def get_cached(domain: str, hours: int = 6) -> dict | None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    return await db().scans.find_one(
        {"domain": domain, "scanned_at": {"$gte": cutoff}},
        sort=[("scanned_at", -1)],
    )
```

A cached result **must** be returned with its age so the UI renders "Last checked 3 hours ago · Re-check". Never present a cached result as live.

---

## 6. Rate limiting

One atomic upsert, no read-then-write race:

```python
async def check_rate_limit(key: str, limit: int, window_s: int) -> bool:
    now = datetime.now(timezone.utc)
    doc = await db().rate_limits.find_one_and_update(
        {"_id": key},
        {"$inc": {"count": 1}, "$setOnInsert": {"window_start": now}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    if (now - doc["window_start"]).total_seconds() > window_s:
        await db().rate_limits.replace_one(
            {"_id": key}, {"_id": key, "count": 1, "window_start": now})
        return True
    return doc["count"] <= limit
```

Limits are in [tier-0-scorecard-spec.md §9](tier-0-scorecard-spec.md#9-rate-limiting-and-abuse): 10 scans/hour per IP, 1 full scan per domain per 6 hours.

---

## 7. Writing a scan

```python
async def save_scan(doc: dict) -> str:
    doc["_id"] = doc.get("_id") or f"scn_{uuid4().hex[:20]}"
    doc["rubric_version"] = RUBRIC_VERSION
    doc["rate_version"]   = RATE_VERSION
    await db().scans.insert_one(doc)
    return doc["_id"]
```

Write **after** the `result` event has been streamed, not before. A slow database write must never delay the user's result. If the insert fails, log it and still serve the result — losing an analytics row is preferable to losing the user.

---

## 8. Queries worth having on day one

```python
# Grade distribution — is the rubric too harsh?
await db().scans.aggregate([
    {"$group": {"_id": "$grade", "n": {"$sum": 1}}},
    {"$sort": {"_id": 1}},
]).to_list(None)

# The one metric: CTA conversion
await db().scans.aggregate([
    {"$group": {"_id": None, "scans": {"$sum": 1},
                "converted": {"$sum": {"$cond": ["$cta_clicked", 1, 0]}}}},
]).to_list(None)

# Most common failing rule — what the market is actually bad at
await db().scans.aggregate([
    {"$unwind": "$findings"}, {"$unwind": "$findings.deductions"},
    {"$group": {"_id": "$findings.deductions.rule", "n": {"$sum": 1}}},
    {"$sort": {"n": -1}}, {"$limit": 10},
]).to_list(None)
```

**Run the grade-distribution query after the first 50 scans.** The worked example in [scoring-and-pricing.md §6](scoring-and-pricing.md#6-worked-example) lands on grade C, and the rubric weights DMARC heavily. If most Indian SaaS companies come out D or F, that is a deliberate product decision to confirm — not a bug, but not necessarily the message we want on first contact either.

---

## 9. What we deliberately do not store at Tier 0

- No user accounts, emails, or sessions — nothing is asked of the user before the result.
- No IP addresses beyond the ephemeral rate-limit key, which expires in an hour.
- No uploaded documents. Contract PDFs arrive at Tier 5 and need their own retention and deletion policy before that ships.

Scanning a domain collects publicly available information about a company, not personal data about an individual. That changes at Tier 3, when OAuth connectors begin returning employee-level data. **Write a data-retention and deletion policy before Tier 3, not after.** DPDP Act obligations attach at that point.
