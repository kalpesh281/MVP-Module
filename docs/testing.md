# Test Plan — by Stage

Testing is a **gate**, not an afterthought. A stage is not "done" when the code runs; it is done when its gate passes.

```
Stage 1 build  →  GATE 1  →  Stage 2 build  →  GATE 2  →  Stage 2.5 build  →  GATE 2.5
                 (test +                      (test +                        (test +
                  sign-off)                    sign-off)                      sign-off)
```

**Do not start the next stage while the previous gate is red.** Stage 2 reads data Stage 1 produces. If Stage 1 is wrong, every Stage 2 bug looks like a Stage 2 bug and isn't.

---

## How to run

```bash
cd backend && source .venv/bin/activate
pip install pytest pytest-asyncio respx
pytest -q                      # all automated tests
pytest -q tests/test_rubric.py # one file
```

Frontend has no test runner at this size. Its checks are the manual list in each gate.

---

# GATE 1 — Domain Scan

Everything in [delivery-stages.md § Stage 1](delivery-stages.md#stage-1--domain-scan) must hold.

## 1.1 Automated — deterministic core

These have no network and no model. They must be green before anything else is trusted.

| File | Asserts | Must include |
|---|---|---|
| `test_rubric.py` | Every rule ID maps to its exact point value | All 8 check categories; weights sum to 100 |
| `test_grades.py` | Band boundaries | **84→B, 85→A, 69→C, 70→B, 54→D, 55→C, 39→F, 40→D** |
| `test_rescale.py` | Inconclusive handling | One check inconclusive → rescale formula; >25 points inconclusive → grade suppressed |
| `test_pricing.py` | Premium lookup | Every grade × revenue band × limit multiplier |
| `test_fixes.py` | Fix deltas | Single fix delta, combined deltas, no double-counting |

**The one test that cannot be skipped:**

```python
def test_worked_example_reproduces():
    """scoring-and-pricing.md §6 — if this changes, that doc changes with it."""
    findings = [
        d("dmarc.absent"), d("spf.softfail"), d("breach.historic"),
        d("hdr.no_hsts"), d("hdr.no_csp"),
        d("surface.risk_host", host="staging.example.com"),
    ]
    # account exposure is inconclusive at Tier 0 — 12 points leave the denominator
    result = score(findings, rubric_version="v1.0", inconclusive={"creds.account_exposure"})
    assert result.deductions == 39
    assert result.available_points == 88
    assert result.score == 56
    assert result.grade == "C"
```

If someone "fixes" the rubric to make a demo look better, this test goes red. That is the point.

## 1.2 Automated — scanner

Each check runs against **recorded fixtures**, never live DNS or live HTTP.

| Check | Fixture cases to record |
|---|---|
| `email_auth` | DMARC absent / monitor / quarantine / reject-no-rua / enforcing; SPF strict / softfail / permissive / absent / >10 lookups; DKIM found / not found |
| `tls` | valid, expiring in 5 days, expiring in 25 days, expired, self-signed, TLS 1.0 only, no HTTP→HTTPS redirect |
| `headers` | all present, none present, partial |
| `creds` | clean, 14 breached, 300 breached, **HIBP key unset**, HIBP 429 |
| `subdomains` | no risky hosts, `staging.` present, directory listing, plaintext host, 200+ subdomains (sprawl) |

Plus, for **every** check:

- **timeout** → returns `inconclusive`, never raises
- **exception** → returns `inconclusive`, never raises
- an inconclusive check **removes its points from the denominator**, it does not score zero

## 1.3 Automated — flow

`test_flow.py`, with AI mocked out entirely:

1. Full SSE scan emits one event per check, then a final result event.
2. Events arrive **in fixed render order** regardless of completion order.
3. Hard limit (30 s) fires → partial result returned, not a 500.
4. Same domain twice inside 6 hours → second call returns cached, `cached: true`, with age.
5. Rate limit: 11th scan from one IP inside an hour → 429 with a readable message.
6. Free-mail domain (`gmail.com`) → rejected with a helpful message, not scanned.
7. Malformed input (`not a domain`, `http://`, empty, 300 chars) → 400, no crash.

## 1.4 The AI-offline test

```bash
env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u GROQ_API_KEY -u OPENROUTER_API_KEY \
    pytest -q tests/test_flow.py::test_scan_without_any_provider
```

**A full scan with every provider key unset must still return a valid grade, premium, and fix list.** Static fallback copy renders in place of AI prose. This is the test people skip, and it is the one that protects the demo.

## 1.5 Manual — frontend

Run on a real domain, then on `example.com`, then on a domain you know is clean.

- [ ] Checks appear one at a time — a bare spinner is **never** on screen
- [ ] Grade and premium animate in after the last check
- [ ] Ticking fixes updates grade + premium **instantly**, and the Network tab shows **zero requests**
- [ ] Unticking reverses it exactly — tick all, untick all, back to the original number
- [ ] Ticking every fix never produces a score above 100 or a grade better than A
- [ ] A clean domain renders a real "nothing to fix" state, not an empty box
- [ ] Error state: kill the backend mid-scan → readable message, retry works
- [ ] 320 px wide — no horizontal scroll, on every screen
- [ ] `prefers-reduced-motion: reduce` → no animation, values jump
- [ ] Tab through the whole page — focus visible everywhere, fix checkboxes operable by keyboard
- [x] ~~Dark mode renders~~ — **N/A.** One theme, deliberately: a light/dark pair means two sets of contrast decisions and this product has one. See the note at the top of `frontend/src/index.css`.
- [ ] Nothing is asked of the user before the result — no email, no modal, no signup

## 1.6 Manual — data and safety

- [ ] `git grep -iE "mongodb\+srv://[^<]"` returns **nothing** — the only
      matches anywhere are `<user>:<password>` templates in `.env.example`
      and `docs/database.md`. Matching the bare scheme flags those templates
      and this checklist line itself, which reads as a leak and is not one.
- [ ] Trigger a DB error deliberately → the connection string does **not** appear in the response or the logs
- [ ] A stored scan document contains `rubric_version` and `rate_version`
- [ ] Re-running `score()` on a stored document's `findings` reproduces its stored grade
- [ ] The outbound User-Agent is truthful and carries a contact URL
- [ ] No check performs a port scan, a probe, a fuzz, or a credential test

## GATE 1 sign-off

Stage 1 is accepted when **1.1–1.6 are all green** and the client has seen the demo script run end to end, live, on a domain they chose.

Write the date and the commit SHA here when it passes:

```
Gate 1 passed:  ____________   commit ____________
```

---

# GATE 2 — Coverage Guidance

Everything in [delivery-stages.md § Stage 2](delivery-stages.md#stage-2--coverage-guidance) must hold.

## 2.1 Automated — Module A, limit recommendation

| Test | Asserts |
|---|---|
| Driver hierarchy | Each driver fires in priority order: `contract` > `sensitive_data` > `financial_data` > `pii_at_scale` > `pii` > `headcount` > `baseline` |
| Override | When a contract requirement exists it **always wins**, even against a higher inferred limit |
| Breach bands | Size band × data-type multiplier → expected cost range (health ×2.0, card ×1.6, consumer PII >100k ×1.5) |
| Never over-recommend | Recommendation is never above what the breach cost band justifies |
| All limits priced | Payload ships premiums for all three offered rungs in a single response, plus `by_grade` for each, so the limit selector and the fix simulator can never show two different prices |
| No AI dependency | Module A output is identical with the AI layer mocked to raise |

## 2.2 Automated — Module B, claim scenario

| Test | Asserts |
|---|---|
| Trigger mapping | `dmarc.absent` → `email_spoof`; `creds.*` → `account_takeover`; `surface.risk_host` → `ransomware`; `hdr.no_csp` / `tls.invalid` → `web_compromise` |
| Selection | The scenario chosen is the one with the **highest deduction**; ties broken deterministically |
| Empty state | Nothing above 8 points → honest empty state, **not** a manufactured threat |
| Degradation | Works with `profile` absent entirely (AI call 1 failed) — it keys off rule IDs |

## 2.3 The verbatim test — the one that matters most

```python
def test_catalog_strings_render_byte_identical():
    payload = build_scenario_block(findings)
    catalog = SCENARIOS["email_spoof"]
    assert payload["cost_lines"] == catalog["cost_lines"]
    assert payload["covered"] == catalog["covered"]
    assert payload["not_covered"] == catalog["not_covered"]
    assert payload["sublimit_warning"] == catalog["sublimit_warning"]
```

Cost lines, covered, not-covered and sublimit text are **byte-identical to the catalog**. The AI writes only `title` and a two-sentence `narrative`, and those two fields are the only ones it may touch.

In insurance, a model inventing a coverage statement is the single mistake you genuinely cannot make. Assert it, don't trust it.

## 2.4 Manual — frontend

- [ ] Switching between the three offered rungs re-prices **instantly**, Network tab shows zero requests. (The rungs are not fixed — they are the recommended limit plus one step down and one step up, so they move with the company.)
- [ ] Dropping to a limit below the recommendation surfaces a visible gap warning
- [ ] The scenario block links back to the matching fix in the fix list
- [ ] Every rupee figure on screen carries "typically" or "estimated"
- [ ] A disclaimer states these are estimates pending insurer validation
- [ ] Run a clean domain — the empty state has been seen with your own eyes at least once
- [ ] Both modules render usefully with **every AI key unset**

## 2.5 Manual — domain accuracy

Full audit trail: **[policy-wording-evidence.md](policy-wording-evidence.md)**.

- [x] Sublimit and endorsement language checked against **at least one real Indian cyber policy wording** — 2026-09-20, against Bajaj Cyber Protect Premium, UIN `IRDAN113CP0002V02201516`, a filed commercial wording. Seven of its eleven insuring clauses carry their own sublimit, which is the premise of Module B.
- [x] Social engineering / funds transfer fraud distinction is stated correctly — **it was not.** The wording contains no social engineering cover at all ("social engineering", "funds transfer" and "phishing" appear zero times in 28 pages), and its IT-Theft definition requires a "targeted intrusion … deletion or alteration of Data", which a tricked employee does not satisfy. Our text warned about a *sublimit* on a cover that is absent. Corrected.
- [x] No sentence claims something is covered without the qualifier the wording actually uses — **one did.** We referred to "the policy's defined reputational harm cover"; no such cover exists, and the word "reputation" does not appear in the wording. Corrected, and `test_nothing_is_listed_as_covered_and_excluded_at_once` now fails the build if a scenario lists an item as covered and excluded at once.
- [ ] **A second commercial wording.** One insurer is not "a standard Indian wording". Our text generalises and that claim is still owed a second source.
- [ ] **A filled-in specimen schedule.** Every sublimit that matters is an Item number, not a figure. We know which clauses are capped; we do not know at what.
- [ ] **A broker has read this.** The audit was done from the document, not by anyone who places these policies.

> Gate 2 stays **red** until the three unticked boxes above are closed. The
> corrections are real progress and the catalog is defensible where it was
> previously unverified — but "checked against one wording, by us" is not
> the same claim as "correct for the Indian market", and the client demo
> must not blur them.

## GATE 2 sign-off

```
Gate 2 passed:  ____________   commit ____________
```

---

# GATE 2.5 — Tier 1 refinement

- [ ] Three questions, one screen, step counter, no signup
- [ ] `POST /api/scan/{id}/refine` returns in under 3 seconds
- [ ] **The grade does not change** — only premium precision, limit, and scenario may change
- [ ] Premium range narrows from ±60% to ±30% (**not** ±15% — that needs Tier 3 verified controls)
- [ ] No re-scan is triggered — assert zero outbound network calls to DNS/HTTP/HIBP
- [ ] Refining twice with the same answers is idempotent
- [ ] Refusing to answer (back button, close) leaves the Tier 0 result intact

```
Gate 2.5 passed:  ____________   commit ____________
```

---

# Standing test rules

1. **No live network in tests.** Every external call is a recorded fixture. A test suite that needs the internet is a test suite that fails before a demo.
2. **Every stage must pass with all AI keys unset.** Add it to CI as a separate job.
3. **Never tune the rubric to make a demo look better.** The worked-example test exists to catch exactly that.
4. **Fix the gate before starting the next stage.** A red gate carried forward doubles the debugging surface.
