# AI Layer

---

## 1. Boundaries — what AI may and may not do

| AI **may** | AI **may not** |
|---|---|
| Classify a company from its website | Produce the risk score |
| Explain a finding in plain English | Produce the premium |
| Prioritise fixes and estimate effort | Produce the premium-impact percentage |
| Extract requirements from a contract PDF | Invent a finding not present in the scan data |
| Answer questions grounded in a generated report | Decide whether a risk is insurable |

**The score and the premium are deterministic.** See [scoring-and-pricing.md](scoring-and-pricing.md). The model receives them as input and writes prose around them.

This is also our strongest credibility claim, and it should be said out loud to customers and insurers:

> *"AI explains and extracts. It never invents your score or your price. Those come from a rubric we can reproduce and defend to an underwriter."*

---

## 2. Provider strategy

### Decision

**Default provider: Anthropic Claude Opus 5 (`claude-opus-5`).** Called behind a thin internal adapter (§3) so the provider can be swapped per call without touching business logic.

### Why an adapter rather than a framework

LangChain and LangGraph are orchestration libraries, not models. They add a dependency layer, an abstraction to debug, and a breaking-change surface. For a pipeline of four one-shot calls they buy nothing that ~40 lines of adapter does not.

**The legitimate reason to want a framework here is provider portability** — and that is solved more cheaply by the adapter below, or by LiteLLM if a wider provider matrix is ever needed.

**LangGraph earns its place later, for one specific component:** the Phase 4 submission router, where an underwriter exchange runs over days with cycles, persistent state, human-in-the-loop approval gates, and a requirement to survive process restarts. That is a genuine state machine. The scorecard pipeline is not.

### Provider selection per call

Calls have very different difficulty. Cost-sensitive calls may use a cheaper or free-tier provider; judgment-heavy calls should not.

| Call | Difficulty | Recommended | Acceptable free-tier substitute |
|---|---|---|---|
| 1. Classify | Low — structured extraction from a webpage | Claude Opus 5 | Gemini Flash, Groq `llama-3.3-70b` |
| 2. Report | **High** — this is the product's voice and its judgment | **Claude Opus 5. Do not substitute.** | — |
| 3. Q&A | Low–medium, cached | Claude Opus 5 | Gemini Flash |
| 5. Contract parser (Tier 5) | **High** — legal text, long context, accuracy matters | **Claude Opus 5** | — |

**Free-tier caveats, verified September 2026:** OpenRouter free models are limited to 20 requests/min and 50/day. Groq allows 30 rpm and 1,000/day but caps at 200K tokens/day, which binds first. Google's free tier marks submitted content as usable to improve its products. Mistral's free Experiment tier requires opting into training. Cerebras replaced its free tier with a card-backed trial.

**Two hard rules:**

1. **Never send customer contract text, uploaded policies, or connector data to a free tier whose terms permit training on submitted content.** That includes Google's free tier and Mistral's Experiment tier. Tier 5+ calls run on a paid endpoint, always.
2. Free-tier daily caps make them unusable for anything user-facing at volume. They are fine for local development and for call 1.

---

## 3. The adapter

One interface. Provider chosen per call site. No framework.

> **What actually shipped (checked 2026-09-20).** The interface below is
> the design; the code took the same shape with different files. There is
> no `anthropic_provider.py` and no `openai_provider.py`, and neither the
> `anthropic` nor the `openai` SDK is installed — both were declared in
> `requirements.txt` for weeks, imported nowhere, and removed.
>
> | In this doc | On disk |
> |---|---|
> | `app/ai/anthropic_provider.py`, `app/ai/openai_provider.py` | `app/ai/provider.py` — one `httpx` client speaking the OpenAI-compatible Chat Completions shape |
> | per-call-site provider choice | `app/ai/registry.py` + `AI_CHAINS` in `config.py` — an ordered fallback chain per call |
> | 3 calls (classify / report / Q&A) | 4: `classify`, `report`, `guidance` (the coverage rationale and the claim narrative, issued as one request), `qa` |
> | Claude Opus 5 recommended for call 2 | Groq `openai/gpt-oss-120b` has served **100%** of real scans. OpenRouter is configured as fallback and has never served one. |
>
> The boundary in section 1 is unchanged and is enforced by
> `test_scoring_never_imports_ai`. The code snippets below stay because
> they document the intended shape, not because they are what runs.

```python
# app/ai/provider.py
from typing import Protocol, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class LLM(Protocol):
    async def parse(self, *, system: str, user: str | list, schema: type[T]) -> T: ...
    async def stream(self, *, system: str, user: str): ...
```

```python
# app/ai/anthropic_provider.py
from anthropic import AsyncAnthropic

class ClaudeLLM:
    def __init__(self, model: str = "claude-opus-5"):
        self._client = AsyncAnthropic()      # reads ANTHROPIC_API_KEY
        self._model = model

    async def parse(self, *, system, user, schema):
        resp = await self._client.messages.parse(
            model=self._model,
            max_tokens=8000,
            thinking={"type": "adaptive"},
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=schema,
        )
        return resp.parsed_output
```

```python
# app/ai/openai_provider.py   — drop-in alternative
from openai import AsyncOpenAI

class OpenAILLM:
    def __init__(self, model: str, base_url: str | None = None, api_key: str | None = None):
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        self._model = model

    async def parse(self, *, system, user, schema):
        resp = await self._client.responses.parse(
            model=self._model,
            input=[{"role": "system", "content": system},
                   {"role": "user", "content": user}],
            text_format=schema,
        )
        return resp.output_parsed
```

Because Groq, OpenRouter, Together, and Cerebras all expose OpenAI-compatible endpoints, `OpenAILLM` covers them via `base_url` alone:

```python
# app/ai/registry.py
PROVIDERS = {
    "claude":     lambda: ClaudeLLM("claude-opus-5"),
    "gpt":        lambda: OpenAILLM("gpt-5"),
    "groq":       lambda: OpenAILLM("llama-3.3-70b-versatile",
                                    base_url="https://api.groq.com/openai/v1",
                                    api_key=os.environ["GROQ_API_KEY"]),
    "openrouter": lambda: OpenAILLM("...:free",
                                    base_url="https://openrouter.ai/api/v1",
                                    api_key=os.environ["OPENROUTER_API_KEY"]),
}

CALL_PROVIDER = {
    "classify": os.getenv("PROVIDER_CLASSIFY", "claude"),
    "report":   os.getenv("PROVIDER_REPORT",   "claude"),   # do not downgrade
    "qa":       os.getenv("PROVIDER_QA",       "claude"),
    "contract": os.getenv("PROVIDER_CONTRACT", "claude"),   # paid only
}
```

That is the whole abstraction. Swapping a provider is an environment variable.

**Note on PDFs:** Claude reads PDFs natively via a `document` content block — no OCR pipeline. Not every provider does. If call 5 is ever moved off Claude, an OCR stage must be added, which is roughly a week of work. This is a strong argument for keeping the contract parser on Claude.

---

## 4. The calls

### Call 1 — Classify

**Input:** homepage HTML (truncated to 50K chars), domain, tech fingerprint
**Runs:** in parallel with the slow network checks, not after them

```python
class CompanyProfile(BaseModel):
    company_name: str
    what_they_do: str          # one plain sentence
    industry: str
    business_model: Literal["B2B_SaaS","B2C","Marketplace","Fintech","Healthtech","Services","Other"]
    data_types_handled: list[Literal["PII","PHI","payment_card","financial","biometric","none_sensitive"]]
    dpdp_act_applies: bool
    estimated_size_band: Literal["1-10","11-50","51-200","200+"]
```

**System prompt**

```
You are a commercial insurance underwriting analyst assessing Indian technology
companies for cyber liability cover.

Infer only what the evidence supports. When uncertain, choose the more
conservative option. estimated_size_band drives pricing — if the site gives no
headcount signal, infer from customer logos, office locations, and team pages,
and prefer the smaller band.
```

`estimated_size_band` selects the revenue band in [scoring-and-pricing.md §4.2](scoring-and-pricing.md#42-revenue-band-at-tier-0). It is the largest single source of Tier 0 imprecision.

---

### Call 2 — Risk report

**The most important call in the product.** This is the product's voice. Do not run it on a cheap model.

**Input:** `CompanyProfile`, raw findings, computed score, computed grade, **and the precomputed per-fix score deltas, grades, and premiums**.

```python
class Fix(BaseModel):
    id: str
    title: str              # no security jargon
    why_it_matters: str     # business impact, second person, present tense
    how_to_fix: str         # concrete and actionable
    effort: Literal["15 min","30 min","1 hr","2 hrs","1 day","1 week"]   # rendered verbatim in the UI
    priority: int

class RiskReport(BaseModel):
    fixes: list[Fix]
    strengths: list[str]    # what they already do right
```

**Note what is absent from the schema:** no score, no grade, no premium, no percentage. Those are joined onto the response by the scoring engine after the model returns.

**System prompt**

```
You explain cyber security findings to startup founders who are not security
people, in the context of buying cyber insurance.

Rules:
- Never state a finding that is not present in the scan data.
- The score, grade, and premium are computed elsewhere and given to you. Explain
  them. Never restate them as different numbers and never compute your own.
- Every title must be free of security jargon. Jargon is allowed in how_to_fix.
- Frame why_it_matters as business impact, in the second person, present tense.
  Not "SPF record lacks a -all qualifier" but "Anyone can send email that looks
  like it's from you."
- Be direct. No hedging, no "may potentially", no exclamation marks.
- strengths must list what the company already does correctly. Never return it
  empty unless every check failed.
- Order fixes by (score_delta / effort), highest first.
```

---

### Call 3 — Report Q&A

Cache the report as the system prefix so follow-ups are near-free.

```python
system=[{
    "type": "text",
    "text": f"Answer questions about this cyber risk report. Ground every answer in "
            f"the report. If it is not in the report, say so.\n\n{report_json}",
    "cache_control": {"type": "ephemeral"},
}]
```

---

### Call 5 — Contract parser (Tier 5)

**The differentiator.** No other Indian platform does this.

**Input:** the customer's MSA as a PDF, passed as a native `document` block. No OCR.

```python
class CoverageRequirement(BaseModel):
    line: str                          # "Cyber Liability", "Commercial General Liability"
    limit_per_occurrence: str | None
    limit_aggregate: str | None
    endorsements_required: list[str]   # additional insured, waiver of subrogation, …
    verbatim_clause: str               # exact contract text
    clause_reference: str              # "Clause 14.2"

class ContractRequirements(BaseModel):
    counterparty: str | None
    requirements: list[CoverageRequirement]
    deadline_or_trigger: str | None
```

**API constraint:** Claude's citations feature is **incompatible with structured outputs** — sending both returns a 400. That is why `verbatim_clause` and `clause_reference` are schema fields instead. They give the same "here is the exact clause" interface in a single call. True page-anchored citations would require a second, citations-enabled call.

---

## 5. Cost

At Claude Opus 5 rates ($5 / $25 per million tokens in / out):

| Call | Approx. in / out | Cost per scan |
|---|---|---|
| 1. Classify | 14K / 400 | ≈ ₹7 |
| 2. Report | 3K / 2K | ≈ ₹6 |
| **Per scan** | | **≈ ₹13** |
| 5. Contract (40-page MSA) | 40K / 3K | ≈ ₹25 |

**1,000 scans/month ≈ ₹13,000.**

Do not optimise this before ~10,000 scans/month. Engineering time spent shaving token cost at prototype stage is worth far less than the same time spent on conversion.

If cost does become binding, the lever order is: (1) cache the call-2 system prompt, (2) truncate homepage HTML harder for call 1, (3) move **call 1 only** to a cheaper provider. Never call 2.

---

## 6. Failure handling

| Failure | Behaviour |
|---|---|
| Call 1 times out | Proceed without a profile. Default to the smallest revenue band. Show the premium range with a wider spread. |
| Call 2 fails | Fall back to a static template built from rule IDs. **The scan must still produce a grade and a premium** — the deterministic path has no AI dependency. |
| Call 2 returns a finding absent from the scan data | Drop that fix and log it. Validate every returned `fix.id` against the rule IDs actually present. |
| Rate limited | Retry with backoff (SDK default: 2 retries). On exhaustion, use the static template. |
| Schema validation fails | One retry, then static template. |

**Design consequence worth stating plainly:** the product degrades to a fully working, if plainer, scorecard with the AI layer entirely offline. That is deliberate.

---

## 7. Environment

```bash
# required
ANTHROPIC_API_KEY=sk-ant-...

# optional — per-call provider overrides
PROVIDER_CLASSIFY=claude
PROVIDER_REPORT=claude        # do not change
PROVIDER_QA=claude
PROVIDER_CONTRACT=claude      # paid endpoints only

# optional alternative providers
OPENAI_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=
```
