# AI Framework Decision — LangChain, LangGraph, or Direct SDK

**Decision: direct SDK behind a thin adapter for Tier 0. LangGraph enters at Phase 4, for one specific component.**

This document records the reasoning, and gives complete working code for all three paths so the decision can be revisited without research.

---

## 1. The question, stated correctly

Two things get conflated and should not be:

| | What it is | Does it make the product "more AI"? |
|---|---|---|
| **The model** | Claude Opus 5, GPT-5, Llama 3.3 | **Yes.** This is the intelligence. |
| **LangChain / LangGraph** | Orchestration libraries that pass strings between function calls | **No.** This is plumbing. |

Telling a client "we use LangChain" describes which package was imported. Telling them "we use Claude Opus 5 / GPT-5, called directly with schema-validated outputs" describes the intelligence. The second is the stronger statement and it is true either way, because a framework would be calling the same model underneath.

**What actually demonstrates AI to a client** is behaviour they can see:

1. Paste a domain — the system works out what the business does and what data it holds. No form.
2. Every finding explained in plain English with its business impact.
3. Upload a customer's MSA — get back exactly what insurance it requires, with the clause quoted.
4. Ask any question about the report.
5. Claimed controls cross-checked against observed reality.

Demo any one of those and the framework never comes up.

---

## 2. The decision

| Phase | Component | Choice | Reason |
|---|---|---|---|
| **1–2** | Scorecard pipeline (4 one-shot calls) | **Direct SDK + adapter** | No cycles, no persistent state, no human-in-the-loop. A framework adds a dependency layer and a debugging surface for nothing. |
| **3** | Evidence reconciler | Direct SDK | Still one-shot. |
| **4** | **Submission router** | **LangGraph** | Genuine state machine: multi-day cycles, underwriter back-and-forth, approval gates, must survive restarts. |

The industry guidance matches: *"Skip both if you only need one or two LLM calls behind a clean function — the raw Anthropic SDK will ship faster and break less."* And for LangGraph: add it the moment the workflow needs cycles, branching across agents, persistent state, human-in-the-loop gates, or durable execution.

Tier 0 has none of those. Phase 4 has all five.

---

## 3. The legitimate argument for a framework — and the cheaper answer

The real reason to want LangChain here is **provider portability**: free and cheap API keys, and the ability to switch when limits or pricing change.

That is a valid need. It does not need LangChain.

```python
# app/ai/provider.py — the entire abstraction
from typing import Protocol, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class LLM(Protocol):
    async def parse(self, *, system: str, user: str | list, schema: type[T]) -> T: ...
```

```python
# app/ai/claude.py
from anthropic import AsyncAnthropic

class ClaudeLLM:
    def __init__(self, model="claude-opus-5"):
        self._c, self._m = AsyncAnthropic(), model

    async def parse(self, *, system, user, schema):
        r = await self._c.messages.parse(
            model=self._m, max_tokens=8000,
            thinking={"type": "adaptive"},
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=schema,
        )
        return r.parsed_output
```

```python
# app/ai/openai_compat.py — covers OpenAI, Groq, OpenRouter, Together, Cerebras
from openai import AsyncOpenAI

class OpenAICompatLLM:
    def __init__(self, model, base_url=None, api_key=None):
        self._c = AsyncOpenAI(base_url=base_url, api_key=api_key)
        self._m = model

    async def parse(self, *, system, user, schema):
        r = await self._c.responses.parse(
            model=self._m,
            input=[{"role": "system", "content": system},
                   {"role": "user", "content": user}],
            text_format=schema,
        )
        return r.output_parsed
```

```python
# app/ai/registry.py
import os

PROVIDERS = {
    "claude":     lambda: ClaudeLLM("claude-opus-5"),
    "gpt":        lambda: OpenAICompatLLM("gpt-5"),
    "groq":       lambda: OpenAICompatLLM("llama-3.3-70b-versatile",
                          base_url="https://api.groq.com/openai/v1",
                          api_key=os.environ["GROQ_API_KEY"]),
    "openrouter": lambda: OpenAICompatLLM("meta-llama/llama-3.3-70b-instruct:free",
                          base_url="https://openrouter.ai/api/v1",
                          api_key=os.environ["OPENROUTER_API_KEY"]),
}

def _auto() -> str:
    if os.getenv("ANTHROPIC_API_KEY"): return "claude"
    if os.getenv("OPENAI_API_KEY"):    return "gpt"
    if os.getenv("GROQ_API_KEY"):      return "groq"
    raise RuntimeError("No AI provider key set")

def llm_for(call: str) -> LLM:
    return PROVIDERS[os.getenv(f"PROVIDER_{call.upper()}") or _auto()]()
```

**About 40 lines.** Groq, OpenRouter, Together and Cerebras all expose OpenAI-compatible endpoints, so one class covers them via `base_url`. Swapping a provider is an environment variable.

If a genuinely wide provider matrix is ever needed, use **LiteLLM** — it does exactly this and nothing else. LangChain is a much larger surface for the same outcome.

---

## 4. If you choose LangChain anyway

This is a defensible choice, not a wrong one — particularly if the team already knows it. Here is the complete equivalent so the decision is not blocked on unfamiliarity.

```bash
pip install langchain-core langchain-anthropic langchain-openai
```

```python
# app/ai/lc_provider.py
from langchain.chat_models import init_chat_model
from langchain_core.prompts import ChatPromptTemplate

def model_for(call: str):
    spec = os.getenv(f"PROVIDER_{call.upper()}", "anthropic:claude-opus-5")
    return init_chat_model(spec, temperature=0)
    # "openai:gpt-5" | "groq:llama-3.3-70b-versatile" | "anthropic:claude-opus-5"
```

```python
# app/ai/classify.py — LangChain version
from .models import CompanyProfile

CLASSIFY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", CLASSIFY_SYSTEM),
    ("human",  "Domain: {domain}\nTech: {tech}\n\nHomepage:\n{html}"),
])

async def classify(domain, tech, html) -> CompanyProfile:
    chain = CLASSIFY_PROMPT | model_for("classify").with_structured_output(CompanyProfile)
    return await chain.ainvoke({"domain": domain, "tech": tech, "html": html[:50_000]})
```

`init_chat_model` gives provider switching by string, and `.with_structured_output(PydanticModel)` gives the same validated objects as `messages.parse()`.

**What you gain:** one-line provider switching; a large integration catalogue you will mostly not use; a team already fluent in it ships faster.

**What you pay:** three packages instead of one; an abstraction between you and provider error messages; breaking changes on someone else's schedule; and **PDF handling becomes non-trivial** — Claude reads PDFs natively as a `document` block, and routing that through a framework abstraction is more work than calling the SDK. That matters for the Tier 5 contract parser.

**If you go this route, still keep `scoring/` free of any AI import.** The framework choice must not leak into the deterministic path.

---

## 5. LangGraph — where it genuinely earns its place

Not Tier 0. **Phase 4, the submission router.**

That workflow: submit to several insurers in parallel → an underwriter emails a question → the system answers from the profile graph → two days pass → another question → a human approves a disclosure → a quote returns → compare and present. Cycles, multi-day persistence, human gates, and it must survive a process restart.

```python
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt
from langgraph.checkpoint.mongodb import MongoDBSaver   # same Mongo as the app

class SubmissionState(TypedDict):
    profile: dict
    insurers: list[str]
    questions: list[dict]
    answers: list[dict]
    quotes: list[dict]
    needs_human: bool

g = StateGraph(SubmissionState)
g.add_node("submit",         submit_to_insurers)
g.add_node("await_question", poll_underwriter_inbox)
g.add_node("answer",         answer_from_profile)       # LLM call
g.add_node("human_gate",     lambda s: interrupt(s))    # pauses, resumes on approval
g.add_node("collect_quote",  parse_quote)

g.add_conditional_edges("await_question", route,
    {"answerable": "answer", "needs_human": "human_gate",
     "quote": "collect_quote", "done": END})
g.add_edge("answer", "await_question")                  # ← the cycle
g.add_edge("human_gate", "answer")

app = g.compile(checkpointer=MongoDBSaver(mongo_client))
```

The checkpointer is what makes it worth using: state persists to MongoDB, so a submission survives a deploy, a crash, or a weekend. That is exactly the problem a hand-rolled loop gets wrong.

Since the application already runs on MongoDB, `langgraph-checkpoint-mongodb` reuses the same connection — no new infrastructure.

---

## 6. Comparison

| | Direct SDK + adapter | LangChain | LangGraph |
|---|---|---|---|
| Lines to first working call | ~40 | ~15 | ~60 |
| Dependencies | 1 | 3+ | 5+ |
| Provider switching | env var | env var | env var |
| Structured output | native | `.with_structured_output()` | via LangChain |
| Native PDF input | **yes (Claude)** | awkward | awkward |
| Cycles / retries / reflection | hand-rolled | hand-rolled | **built in** |
| Durable state across days | no | no | **checkpointer** |
| Human-in-the-loop gates | hand-rolled | hand-rolled | **`interrupt()`** |
| Debugging | your stack trace | through an abstraction | through an abstraction |
| **Right for Tier 0** | **✅** | acceptable | no |
| **Right for Phase 4 router** | no | no | **✅** |

---

## 7. Provider selection per call

Calls differ in difficulty. Cost-optimise the easy ones; do not touch the hard ones.

| Call | Difficulty | Use | Free-tier substitute |
|---|---|---|---|
| 1. Classify | Low — structured extraction | Whatever key you have | Groq, Gemini Flash |
| 2. **Report** | **High — the product's voice** | **Claude Opus 5 or GPT-5. Do not downgrade.** | — |
| 3. Q&A | Low, cached | Your main key | Gemini Flash |
| 5. Contract parser | **High — legal text, long context** | **Claude, paid** (native PDF) | — |

Call 2 costs roughly **₹6 per scan**. It is the cheapest line item in the stack and it is the entire user experience. Optimising it is a false economy.

---

## 8. Free tiers — verified September 2026

| Provider | Limits | Card | Catch |
|---|---|---|---|
| **Groq** | 30 rpm, 1,000/day, **200K tokens/day** | No | The token cap binds long before the request cap |
| **Google Gemini** | Flash-Lite 1,500/day, 1M tok/min | No | ⚠️ Free-tier content is used to improve Google's products |
| **OpenRouter** | 20 rpm, 50/day on `:free` | No | 50/day ≈ 50 scans; rises to 1,000/day after a one-time $10 credit purchase |
| **Mistral** | 1B tokens/month | No | ⚠️ Requires opting into training |
| **Cerebras** | $5 trial | **Yes** | No longer a free tier as of Sept 2026 |
| Cloudflare Workers AI / Cohere / HF | Various | No | Smaller models |

### Two rules that are not negotiable

1. **Never send contract text, uploaded policies, or connector data to a provider whose free tier trains on submissions.** That excludes Google's free tier and Mistral's Experiment tier from Tier 5 onward. Uploading a customer's confidential MSA into a training set is a breach of their contract and the end of our credibility with insurers.
2. **Free daily caps are unusable for anything user-facing.** 50 scans/day or 200K tokens/day is a development budget, not a launch budget. Use free tiers for local development and call 1 only.

---

## 9. What to tell the client

> *"The intelligence layer is Claude Opus 5 / GPT-5, called directly through the official SDK with typed, schema-validated outputs. We deliberately avoid a wrapper framework for the scan pipeline — it adds latency and failure modes between us and the model without adding capability. Reliability comes from validated schemas and a deterministic scoring engine, not from an orchestration library. When we build the multi-day insurer submission workflow, we'll use LangGraph, because that genuinely needs durable state and human approval gates."*

And the statement that carries the most weight with both clients and insurers:

> *"AI explains and extracts. It never invents your score or your price. Those come from a rubric we can reproduce and defend to an underwriter."*

An insurer will not grant delegated authority to a black box. Knowing exactly where the model is and is not in the loop is the strongest AI story available here.
