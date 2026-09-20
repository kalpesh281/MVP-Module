# Frontend Implementation Guide

**Stack:** React 18 · Vite · plain CSS with custom properties · no UI framework
**Scope:** Tier 0 — the three screens in [tier-0-scorecard-spec.md §4](tier-0-scorecard-spec.md#4-screens)

No component library. The whole surface is one input, one streaming list, one grade, and a checklist. A design system would cost more than it saves and would fight the calm aesthetic the spec requires.

---

## 1. Setup

```bash
npm create vite@latest frontend -- --template react
cd frontend && npm install
npm run dev          # http://localhost:5173
```

`vite.config.js` — proxy the API so SSE works without CORS in development:

```js
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } } },
});
```

---

## 2. Folder structure

```
frontend/src/
├── main.jsx
├── App.jsx                 # state machine: idle → scanning → result | error
├── styles/
│   ├── tokens.css          # colours, type scale, spacing — the whole design system
│   └── global.css
├── hooks/
│   └── useScan.js          # EventSource lifecycle, event reducer
├── components/
│   ├── DomainInput.jsx     # landing
│   ├── CheckFeed.jsx       # streaming check list
│   ├── CheckRow.jsx
│   ├── GradeBadge.jsx      # the big letter
│   ├── PremiumBand.jsx     # animated number
│   ├── FixList.jsx         # ← the interactive simulator
│   ├── FixRow.jsx
│   ├── CombinedRow.jsx     # "fix all three →"
│   ├── Strengths.jsx
│   └── TierOneCta.jsx
└── lib/
    ├── format.js           # INR formatting, date formatting
    └── simulate.js         # pure fix-selection maths — unit tested, no React
```

---

## 3. State machine

```
idle ──submit──▶ scanning ──result──▶ result
  ▲                  │                   │
  └──────error───────┴───────────────────┘
```

Four states only: `idle`, `scanning`, `result`, `error`. No loading booleans scattered through components.

```jsx
// App.jsx
const [phase, setPhase] = useState("idle");
const { checks, profile, result, error, start } = useScan();
```

---

## 4. Consuming the stream

```js
// hooks/useScan.js
export function useScan() {
  const [checks, setChecks]   = useState(INITIAL_CHECKS);  // fixed display order
  const [profile, setProfile] = useState(null);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const sourceRef = useRef(null);

  const start = useCallback((domain) => {
    setChecks(INITIAL_CHECKS); setResult(null); setError(null);
    const es = new EventSource(`/api/scan?domain=${encodeURIComponent(domain)}`);
    sourceRef.current = es;

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "check")   setChecks((c) => c.map((x) => x.id === msg.id ? { ...x, ...msg } : x));
      if (msg.type === "profile") setProfile(msg);
      if (msg.type === "result")  { setResult(msg); es.close(); }
      if (msg.type === "error")   { setError(msg); es.close(); }
    };
    es.onerror = () => { setError({ code: "connection_lost" }); es.close(); };
  }, []);

  useEffect(() => () => sourceRef.current?.close(), []);   // close on unmount
  return { checks, profile, result, error, start };
}
```

Three things that are easy to get wrong:

1. **`INITIAL_CHECKS` fixes the display order.** Checks complete at wildly different speeds — DNS in milliseconds, subdomains in seconds. Rendering in completion order makes the list jump. Seed all five rows as `pending` and fill them in place.
2. **Always close the `EventSource`.** On result, on error, and on unmount. A leaked connection keeps the server worker alive.
3. **`EventSource` cannot send headers.** If auth is ever needed, use a query-string token or switch to `fetch` + `ReadableStream`.

---

## 5. Design tokens

The entire visual system. Nothing outside this file defines a colour or a size.

```css
/* styles/tokens.css */
:root {
  /* Calm, near-monochrome. No red anywhere. */
  --bg:          #FAFAF8;
  --surface:     #FFFFFF;
  --ink:         #1A1A18;
  --ink-muted:   #6B6B66;
  --ink-faint:   #A3A39D;
  --line:        #E8E8E3;

  --pass:        #2F7A4F;   /* muted green  */
  --warn:        #B5842B;   /* muted amber  */
  --fail:        #4A4A46;   /* dark neutral — NOT red */
  --accent:      #1A4D8F;   /* single accent, CTA only */

  --grade-a:     #2F7A4F;
  --grade-b:     #4E8A5C;
  --grade-c:     #B5842B;
  --grade-d:     #A6672B;
  --grade-f:     #8C3A2E;

  --font:        ui-sans-serif, -apple-system, "Inter", system-ui, sans-serif;
  --mono:        ui-monospace, "SF Mono", Menlo, monospace;

  --t-grade:     clamp(5rem, 14vw, 8.5rem);
  --t-xl:        1.75rem;
  --t-lg:        1.125rem;
  --t-base:      1rem;
  --t-sm:        0.875rem;
  --t-xs:        0.8125rem;

  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px;
  --s-6: 24px; --s-8: 32px; --s-12: 48px; --s-16: 64px; --s-24: 96px;

  --measure:     640px;     /* max content width */
  --radius:      10px;
  --ease:        cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #14140F; --surface: #1C1C18; --ink: #F0F0EA;
    --ink-muted: #9C9C94; --ink-faint: #6B6B63; --line: #2C2C26;
  }
}
```

**`--fail` is deliberately a dark neutral, not red.** See [tier-0-scorecard-spec.md §5.3](tier-0-scorecard-spec.md#53-calm-not-alarming). A founder who feels attacked closes the tab.

---

## 6. Components

### DomainInput

Single field, autofocused, submits on Enter or button. Strip protocol and path client-side before sending; the server normalises authoritatively.

Subtext: `Takes 30 seconds · No signup` — set in muted ink at `--t-sm`.

Error copy is specific, never generic:

| Code | Message |
|---|---|
| `free_mail_domain` | "That's an email provider. Enter your company's own domain — the one on your website." |
| `domain_unresolvable` | "We couldn't find that domain. Check the spelling?" |
| `rate_limited` | "You've run a few scans already. Try again in an hour." |

### CheckFeed / CheckRow

```
   ✓  Email authentication (SPF)      configured
   ✓  Certificate                     valid, expires in 240 days
   ·  Checking DMARC policy…
```

| Status | Glyph | Colour |
|---|---|---|
| `pending` | `·` | `--ink-faint` |
| `running` | `·` pulsing, 1.2s | `--ink-muted` |
| `pass` | `✓` | `--pass` |
| `warn` | `⚠` | `--warn` |
| `fail` | `✗` | `--fail` |
| `inconclusive` | `–` | `--ink-faint` |

Left column fixed width so glyphs align. Label and detail on one line at ≥ 600px, stacked below.

### GradeBadge

The largest element on the page — `--t-grade`, coloured by `--grade-*`. Numeric score in a `title` attribute only; the grade is what the page leads with.

### PremiumBand

```
        Estimated cyber cover    ₹85,000 – 1,20,000 / yr
                                 for ₹5 Cr limit
```

The word **"Estimated"** is required and must never be removed. Premium tables are not insurer-validated — see [scoring-and-pricing.md §4.1](scoring-and-pricing.md#41-base-table--placeholder).

Format in Indian digit grouping: `₹1,20,000`, not `₹120,000`.

```js
new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR",
                                 maximumFractionDigits: 0 }).format(120000);
```

### FixList — the most important component

This is the interaction the whole page exists for.

```
  WHAT'S HOLDING YOU BACK                 tick to simulate

  ☐  No DMARC policy                      2 hrs        B
     Anyone can send email that looks like it's from you.
     This is how most payment-fraud attacks start.
```

Requirements:

- Each row shows the grade **that row alone** would achieve (`grade_if_fixed`).
- Ticking recomputes the combined row instantly. **No network call** — every delta arrives in the `result` payload.
- Grade and premium **animate** to their new values. The movement is the point; a static number change reads as a page reload.
- `tick to simulate` in `--ink-faint` at `--t-xs`, right-aligned in the section header.
- Rows are ordered by `priority` from the server (`score_delta / effort`, highest first).

```js
// lib/simulate.js — pure, no React, unit tested
export function simulate(result, selectedIds) {
  const selected = result.fixes.filter((f) => selectedIds.has(f.id));
  const delta    = selected.reduce((sum, f) => sum + f.score_delta, 0);
  const score    = Math.min(100, result.score + delta);
  return {
    score,
    grade:   gradeFor(score),
    premium: premiumFor(score),     // from result.premium_table, shipped by the server
    saving:  midpoint(result.premium) - midpoint(premiumFor(score)),
  };
}
```

Keep this pure and outside React so it can be unit tested against the worked example in [scoring-and-pricing.md §6](scoring-and-pricing.md#6-worked-example).

### CombinedRow

```
     Fix all three  →      A       ₹45,000 – 60,000 / yr
                                   you'd save ~₹1,02,500
```

Label reflects the count actually selected: "Fix this one", "Fix these two", "Fix all three". When nothing is selected, show the row greyed with the current values — do not hide it, or the first tick has no visible before-state.

### Strengths

```
  ✓  What you're already doing right
     SPF configured · TLS valid · No exposed admin panels
```

Not decoration. This block is what stops the page reading as an attack and keeps the user on it long enough to reach the CTA. Never render the section empty — if the server returns no strengths, omit the whole block.

### GlossaryTerm

```jsx
<GlossaryTerm term="sublimit">sublimit</GlossaryTerm>
```

Wraps a word in a `<button>` with a dotted underline. **Tap toggles an inline one-sentence definition below the paragraph — never a hover tooltip, never a floating popover.** No hover on mobile, and a popover hides exactly what should stay visible while reading.

- Definitions live in `src/data/glossary.js` — plain strings, no JSX, no nesting
- `aria-expanded`, `aria-controls`, Escape collapses
- Fires `glossary_expand` with the term (see §10)

### TierOneCta

```
     Want the exact number instead of a range?
     Three questions, 20 seconds.        [ Narrow it down → ]
```

The button says **"Narrow it down"**, not "Continue" and not "Get a quote". Every ask must state its reward in or immediately above the button. Fire `cta_clicked` with `scan_id` and `grade`.

---

## 7. Animation

| Element | Spec |
|---|---|
| Grade change | 250 ms, `--ease`, scale `1 → 1.04 → 1` |
| Premium numbers | 400 ms count-up/down, `requestAnimationFrame` |
| Check row resolving | 150 ms fade, glyph crossfade |
| Landing → scanning | 200 ms crossfade |
| Scanning → result | 300 ms, checks slide up and collapse into the strengths block |

Wrap everything in:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

Numbers must still land on the correct final value with motion disabled.

---

## 8. Responsive

Mobile-first. One column always; nothing needs a multi-column layout.

| Breakpoint | Change |
|---|---|
| < 600 px | 16 px side gutters. Check label and detail stack. Fix effort and grade move under the title. Grade at the lower end of `clamp()`. |
| ≥ 600 px | Check label and detail on one line. Fix metadata right-aligned. |
| ≥ 900 px | Content capped at `--measure` (640 px) and centred. No wider layout — reading line length matters more than filling the viewport. |

No horizontal scroll at 320 px. Test it.

---

## 9. Accessibility

- The check feed is an `aria-live="polite"` region so screen readers announce results as they arrive.
- Fix rows are real `<input type="checkbox">` with `<label>`, not styled divs. Keyboard and screen reader support comes free.
- The grade must not be conveyed by colour alone — the letter itself carries the meaning, which is one more reason the spec uses A–F rather than a coloured number.
- Visible focus rings. Do not remove outlines.
- Contrast: verify every token pair against WCAG AA in both colour schemes.

---

## 10. Instrumentation

Fire these from the components, not the hook:

| Event | Where | Properties |
|---|---|---|
| `scan_started` | DomainInput submit | domain, referrer |
| `scan_completed` | on `result` | scan_id, grade, duration_ms |
| `scan_failed` | on `error` | error_code |
| `fix_toggled` | FixRow change | scan_id, fix_id, checked |
| `cta_clicked` | TierOneCta | scan_id, grade |
| `result_shared` | share button | scan_id |

**`fix_toggled` is the engagement proxy.** If it is near zero, the interactive simulator failed and the page is just a report. That is the second thing to check after conversion.

---

## 11. Build order

| Day | Deliverable |
|---|---|
| **1** | Vite scaffold, `tokens.css`, `DomainInput`, `useScan` against a mocked SSE endpoint |
| **2 AM** | `CheckFeed` + `CheckRow`, all six states, wired to the real backend |
| **2 PM** | `GradeBadge`, `PremiumBand`, `Strengths` — static result rendering |
| **3 AM** | `FixList`, `simulate.js`, `CombinedRow` — the interactive simulator with animation |
| **3 PM** | `TierOneCta`, error states, responsive pass, reduced-motion, accessibility check |

Build against a mocked SSE endpoint on day 1 so the frontend is never blocked on the backend. A static JSON file replayed on a timer is enough.

---

## 11b. Education checks

Beyond the functional acceptance below, every screen must satisfy [education-layer.md](education-layer.md):

- [ ] Every check names itself in plain words while running — *"Checking whether anyone can send email as you"*, not *"SPF/DKIM/DMARC lookup"*
- [ ] Every finding has what / why / consequence / action — four lines, no jargon in the title
- [ ] Every insurance or security term in body copy is either defined in place or wrapped in `GlossaryTerm`
- [ ] Nothing is explained that the user does not have a finding for
- [ ] A clean scan says so honestly rather than padding with generic lessons

## 12. Acceptance

Mirrors [tier-0-scorecard-spec.md §12](tier-0-scorecard-spec.md#12-acceptance-criteria). The frontend-specific ones:

1. No bare spinner is ever shown — checks stream individually.
2. Ticking any combination of fixes updates grade and premium instantly, with animation, with no network call.
3. Nothing is asked of the user before the result is shown — no email field, no modal.
4. A grade-A domain with zero fixes renders a valid "nothing to fix" state.
5. No horizontal scroll at 320 px.
6. All animation respects `prefers-reduced-motion`.
7. Every finding title is free of security jargon.
