# Scan Checks — Tier 0

Five checks. All **passive**. All free or near-free.

---

## Legal basis

**Tier 0 performs passive reconnaissance only.** Every check below either (a) queries public infrastructure records (DNS, certificate transparency), (b) makes an ordinary HTTPS request to a public web server, or (c) queries a third-party index the target does not control.

**Explicitly prohibited in Tier 0:**

- Port scanning (`nmap`, `masscan`) against a domain we do not own
- Vulnerability probing, fuzzing, or exploit attempts
- Credential testing of any kind
- Authenticated or rate-abusive crawling

Active scanning of infrastructure without written authorisation carries exposure under the Information Technology Act, 2000 (India) — notably §43 and §66 — and will get our source addresses blocked. Active checks become available only at Tier 3+, under an explicit authorisation the customer grants when connecting an account.

Every scan must send a truthful `User-Agent` identifying the service and a contact URL.

---

> **Weights here are a summary. [scoring-and-pricing.md](scoring-and-pricing.md) is authoritative.** If the two ever disagree, that document wins and this one is wrong. They must sum to 100.

## The five checks

> **Five families, seven scored categories, seven rows in the feed.** Email
> authentication is one check here but three in the rubric (SPF, DKIM,
> DMARC scored separately), and breach exposure is one here but two
> (`creds`, `creds_accounts`). `docs/defending-the-score.md` counts the
> scored categories; this page groups them by the network call that
> produces them. Both counts are correct about different things.


### 1. Email authentication — SPF, DKIM, DMARC

| | |
|---|---|
| **Weight** | 30 points (DMARC 18, SPF 7, DKIM 5) |
| **Method** | DNS TXT lookups |
| **Library** | `dnspython` only — `app/scanner/email_auth.py` |
| **Cost** | Free |
| **Latency** | < 200 ms |

**Lookups**

- SPF: `TXT` at apex, record starting `v=spf1`
- DMARC: `TXT` at `_dmarc.<domain>`, record starting `v=DMARC1`
- DKIM: `TXT` at `<selector>._domainkey.<domain>` — probe common selectors: `google`, `selector1`, `selector2`, `k1`, `s1`, `default`, `mail`, `dkim`, `zoho`, `mandrill`

**Why DMARC carries the highest weight:** absence of an enforcing DMARC policy means anyone can send email that appears to come from the domain. This is the entry point for business email compromise, which is among the most common and most expensive cyber insurance claim types. It is also the single most recognisable signal to an underwriter, and most Indian SaaS companies fail it. It is our highest-signal finding.

**Note on DKIM:** absence of a record at common selectors is not proof of absence — a custom selector may exist. Grade DKIM as `warn`, never `fail`, and weight it lightly.

---

### 2. Breach exposure

| | |
|---|---|
| **Weight** | 20 points — **8 free + 12 keyed** |
| **Method** | Have I Been Pwned API v3 |
| **Library** | `httpx` |
| **Cost** | **Free** for the 8-point half · ~₹350/mo for the rest |
| **Latency** | 1–2 s |

Two endpoints, two access levels. Full rule table in
[scoring-and-pricing.md §1.2](scoring-and-pricing.md#12-breach-exposure--20-points-in-two-halves).

**A. Breach history — free, keyless, works on any domain**

```
GET https://haveibeenpwned.com/api/v3/breaches?Domain=<domain>
```

Returns disclosed breaches of the company's **own** systems. No API key, no
ownership proof. Send a descriptive `User-Agent`; HIBP rate-limits anonymous
callers, so cache and space the requests.

This is prior-incident history — a question on every real proposal form —
and it costs nothing.

**B. Account exposure — needs a key AND proof of domain ownership**

```
GET https://haveibeenpwned.com/api/v3/breacheddomain/<domain>
    hibp-api-key: <key>
```

Counts staff addresses appearing in breach corpora. HIBP requires the caller
to have **verified they control the domain**, which by definition we have
not for a domain scanned cold. At Tier 0 this half is `inconclusive` and its
12 points leave the denominator. It unlocks at Tier 2, after the user
verifies their own domain by email.

> **Never display a count we cannot substantiate.** Without the keyed half we
> say *"no disclosed breach on record"* — never *"no leaked credentials"*.
> Those are different claims and only the first one is true.

---

### 3. TLS and certificate

| | |
|---|---|
| **Weight** | 15 points |
| **Method** | TLS handshake on port 443 |
| **Library** | stdlib `ssl` over asyncio — `app/scanner/tls.py` |
| **Cost** | Free |
| **Latency** | < 1 s |

**Collect:** issuer, subject, SAN list, `notBefore` / `notAfter`, negotiated protocol version, cipher suite, chain validity, hostname match.

**Findings:** expired or invalid, self-signed, hostname mismatch, expiring within 30 days, TLS 1.0 / 1.1 accepted.

The SAN list is also a free source of subdomains — feed it into check 5.

---

### 4. Security headers

| | |
|---|---|
| **Weight** | 12 points |
| **Method** | One `GET` to `https://<domain>/`, follow up to 3 redirects |
| **Cost** | Free |
| **Latency** | < 2 s |

**Headers inspected:** `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` (or CSP `frame-ancestors`), `Referrer-Policy`.

Also capture response headers and body for **tech fingerprinting** — server banner, framework hints, `X-Powered-By`, JS bundle names. This feeds AI call 1 (classification).

**Do not** report a missing `X-XSS-Protection` header. It is deprecated and reporting it signals an unserious tool.

---

### 5. Attack surface — subdomains

| | |
|---|---|
| **Weight** | 23 points |
| **Method** | Certificate Transparency logs via `crt.sh`, plus certificate SANs from check 3 |
| **Cost** | Free |
| **Latency** | 2–8 s (slowest check) |

**Process**

1. Query `https://crt.sh/?q=%25.<domain>&output=json`
2. Deduplicate, strip wildcards
3. Resolve each to check it is live
4. Issue one `HEAD` request to each live host
5. Flag hosts matching risk patterns whose name resolves **and** returns < 400

**Risk patterns:** `staging`, `stage`, `dev`, `test`, `uat`, `qa`, `demo`, `admin`, `internal`, `vpn`, `jenkins`, `grafana`, `kibana`, `phpmyadmin`, `jira`, `gitlab`, `backup`, `old`, `legacy`

**Also flag:** directory listing enabled (`Index of /` in body), default landing pages, HTTP-only hosts (no HTTPS redirect).

`crt.sh` is frequently slow or unavailable. Set a hard 8-second timeout, fall back to SANs from check 3, and mark the check `inconclusive` rather than `pass` if the fallback yields nothing. **Never grade a company well because a check failed to run.**

---

## Output shape

Each check returns:

```python
{
  "id": "dmarc",
  "label": "DMARC policy",
  "status": "pass" | "warn" | "fail" | "inconclusive",
  "detail": "No DMARC record found",
  "evidence": { ... },          # raw data, for audit and dispute
  "deductions": [               # consumed by the scoring engine
    {"rule": "dmarc.absent", "points": 18}
  ]
}
```

`evidence` is mandatory. If a customer or an underwriter disputes a finding, we must be able to show exactly what we observed.

---

## Execution

All five run **concurrently**, feeding an `asyncio.Queue` so results stream as they complete while the client renders them in a fixed order. **Do not use `asyncio.gather`** — it resolves all-at-once and defeats the streaming feed. The pattern is in [backend.md §4](backend.md#4-concurrency-pattern). A crash in one check must never fail the scan. Per-check timeouts:

| Check | Timeout |
|---|---|
| Email authentication | 3 s |
| TLS | 5 s |
| Headers | 6 s |
| Breached credentials | 8 s |
| Subdomains | 8 s |

Overall scan hard limit: 30 seconds.

---

## Later tiers (not Tier 0)

| Check | Tier | Source |
|---|---|---|
| Exposed services / open ports | 2 | Shodan API (~₹6,000/mo) — reads *their* index, still passive for us |
| Dark-web credential exposure | 2 | Commercial feed |
| EOL / vulnerable component versions | 2 | Fingerprint → CVE database |
| Verified MFA coverage | 3 | Google Workspace / M365 read-only OAuth |
| EDR deployment coverage | 3 | CrowdStrike / SentinelOne read-only API |
| Backup immutability and last restore test | 4 | AWS / GCP read-only role |
| Secret scanning, branch protection | 4 | GitHub read-only App |


---

## Libraries

| Check | Library | Version | Why this one |
|---|---|---|---|
| Email auth | **`dnspython`** | 2.7+ | Async TXT lookups for SPF, DMARC and DKIM selector probing. The SPF lookup counter that produces `spf.lookup_overflow` (the >10 limit in RFC 7208) is ours — `SPF_MAX_LOOKUPS` in `config.py`, counted in `email_auth.py`. |
| TLS | stdlib **`ssl`** over asyncio | — | An ordinary handshake on 443, non-blocking without a thread pool. It covers every rule the rubric scores: validity, expiry, hostname match, chain, negotiated version. |
| HTTP | **`httpx`** | 0.27+ | Async, HTTP/2, redirect control, per-request timeouts. One client, reused. Also the transport for the AI providers. |
| Cert transparency | **`httpx`** against Cert Spotter, then crt.sh | — | No library needed; both return JSON. Source policy in `subdomains.py`: Cert Spotter answers or we fall back and mark the result degraded. |

**Deliberately not used:**

| | Why not |
|---|---|
| `checkdmarc` | Declared in `requirements.txt` for the first weeks and imported in zero files — the SPF/DMARC parsing was written by hand against `dnspython` before it was ever wired in. Removed 2026-09-20. It is a good library; it was not the one running. |
| `sslyze` | Same history, same removal date. `app/scanner/tls.py` is stdlib `ssl` over asyncio. Revisit at Tier 2 if cipher-suite enumeration earns points in the rubric — today it does not, so the dependency bought nothing. |
| `publicsuffixlist` | Only ever arrived as a `checkdmarc` transitive dependency. The free-mail and suffix handling we need is in `app/domain.py`. |
| `anthropic` / `openai` SDKs | Also declared, also imported nowhere. Groq and OpenRouter are OpenAI-compatible over plain HTTP, so `app/ai/provider.py` uses `httpx` and the product stays vendor-neutral. Removed 2026-09-20. |
| `nmap` / `masscan` / `python-nmap` | Active scanning. Prohibited at Tier 0 — see the legal basis above. |
| `shodan` | Paid, and its data is a stale index rather than a live read. Revisit at Tier 3. |
| `theHarvester`, `amass`, `subfinder` | Built for offensive recon; many modes are active. CT logs plus certificate SANs give us what we need passively. |
| `requests` | Synchronous. Blocks the event loop and serialises five checks that must run concurrently. |

---

## Benchmarks the rubric is calibrated against

We did not invent the idea of grading a domain. Four published methodologies are the reference points, and each one anchors a different part of our rubric.

| Benchmark | Owner | What it grades | What we borrow |
|---|---|---|---|
| **SSL Labs Server Rating Guide** | Qualys | TLS configuration, 0–100 → A+ to F | The **grade-band idea and the zero-in-a-category rule**. Their bands: A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, E ≥ 20, F < 20. |
| **HTTP Observatory** | Mozilla | Security headers, baseline 100 with penalties → A+ to F | The **penalty-from-100 model** — start at 100, deduct. Our header deductions are calibrated against theirs. Open-source scoring doc. |
| **Internet.nl** | Dutch Internet Standards Platform | IPv6, DNSSEC, HTTPS, DMARC, SPF, DKIM, STARTTLS, DANE, RPKI → % | The **standards-compliance framing**, and their own caveat: a 100% score is not proof of security. Fully open source. |
| **SecurityScorecard / BitSight / UpGuard** | Commercial | Whole-company posture, A–F or 250–900 | The **A–F letter** as the consumer-facing unit. These are the scores underwriters already recognise. |

**Where we deliberately differ:**

1. **Mozilla and SSL Labs grade one surface each.** We grade five and weight them by *insurance* relevance, not by security-purist relevance. That is why DMARC carries 18 points and CSP carries 4 — business email compromise is a top cyber claim type; a missing CSP rarely is.
2. **Our bands are stricter at the top.** A = 85, not 80. A grade A should be rare enough to mean something to an underwriter.
3. **Nobody publishes an insurance-weighted rubric.** SecurityScorecard and BitSight are opaque by design. Ours is fully published, which is the point — see [scoring-and-pricing.md](scoring-and-pricing.md).
