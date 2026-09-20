"""Environment, constants and tunables.

Nothing in this module imports from app.scanner, app.scoring or app.ai.
It is the bottom of the dependency graph.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Explicit path, not bare load_dotenv(). The bare call locates .env by
# walking the caller's stack frames, which silently finds nothing when the
# process is started from a different working directory — or from stdin.
# backend/app/config.py -> backend/.env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# --- versions ------------------------------------------------------------
# Stored on every scan document. A score must be reproducible from
# `findings` + `rubric_version` alone. Never mutate a rubric in place;
# publish v1.1 and leave v1.0 documents untouched.
RUBRIC_VERSION = "v1.0"
RATE_VERSION = "v1.1"

# --- identity ------------------------------------------------------------
USER_AGENT = os.getenv(
    "USER_AGENT",
    "CyberScorecard/0.1 (+https://github.com/kalpesh281)",
)

# --- data sources --------------------------------------------------------
MONGODB_URI = os.getenv("MONGODB_URI") or None
MONGODB_DB = os.getenv("MONGODB_DB", "scorecard")
HIBP_API_KEY = os.getenv("HIBP_API_KEY") or None

# SSLMate Cert Spotter. FREE, and the most reliable certificate-transparency
# source we found — 6/6 successful where crt.sh managed 1/6, in a third of
# the time. Measured 2026-09-20.
#
# Without a key the unauthenticated limit is low enough that a handful of
# scans exhausts it and the check starts returning HTTP 429, which costs us
# the whole 23-point attack-surface category. A free key at
# https://sslmate.com/signup?for=certspotter_api raises it to 100 queries
# an hour, which is well past what the prototype needs. Strongly recommended.
CERTSPOTTER_API_KEY = os.getenv("CERTSPOTTER_API_KEY") or None

SCAN_CACHE_HOURS = int(os.getenv("SCAN_CACHE_HOURS", "6"))

# --- timing --------------------------------------------------------------
# Per-check budgets, seconds. Measured 2026-09-20, not guessed:
#
#   email_auth  ~2.1s   three concurrent DNS lookups plus SPF include walk
#   tls         ~0.2s   fast when healthy; the 4s probe budget is separate
#   headers     ~0.2s   one GET
#   creds       ~0.6s   one HIBP call
#   subdomains  4-12s  Cert Spotter ~1.5s and crt.sh 4-8s, issued
#                       concurrently and satisfied by either, then a probe
#                       sweep over up to 40 hosts
#
# A budget must exceed the sum of the check's own internal timeouts, or the
# runner kills it and throws away work that had already succeeded. That is
# how `subdomains` was silently returning `inconclusive` on every scan: its
# crt.sh timeout was 8s and its budget was also 8s, leaving nothing for the
# probing that follows.
TIMEOUTS = {
    "email_auth": 5.0,
    "tls": 10.0,        # handshake 5s + a 4s shared budget for the two probes
    "headers": 8.0,
    "creds": 10.0,
    "subdomains": 15.0,  # two CT sources concurrently (~2-8s), then the probe sweep
}
SCAN_HARD_LIMIT = 30.0

# Minimum time the scanning screen stays up. Instant results read as fake.
MIN_SCAN_DWELL = 4.0

# --- AI models -----------------------------------------------------------
# CHANGE MODEL NAMES HERE. Nothing else needs editing.
# Every provider below speaks the OpenAI chat-completions API, so switching
# is a base URL and a key. Verified live against this account's own keys on
# 2026-09-20 — not copied from documentation.

AI_ENDPOINTS = {
    "groq":       "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "openai":     "https://api.openai.com/v1",   # unused — no working key
}

# key:   short alias, used in AI_CHAINS and in PROVIDER_* env overrides
# value: (provider, model id, env var holding the key)
#
# Every model below was probed live on 2026-09-20 and confirmed to return
# valid JSON. Models that 400/403/429'd, returned empty content, or leaked
# their reasoning into the content field are listed at the bottom as
# rejected, so nobody re-adds them.
AI_MODELS = {
    # --- Groq: FREE, fast, reliable. Primary for everything. -------------
    # 30 req/min, 1,000 req/day, 200K tokens/day. The token cap binds
    # first: roughly 60-80 scans/day.
    "groq-large":  ("groq", "openai/gpt-oss-120b", "GROQ_API_KEY"),
    "groq-small":  ("groq", "openai/gpt-oss-20b",  "GROQ_API_KEY"),
    "groq-qwen":   ("groq", "qwen/qwen3.8-27b",    "GROQ_API_KEY"),

    # --- OpenRouter: FREE, flaky individually, good as fallback ----------
    # 20 req/min, 50 req/day across :free models. Any single model may
    # 429 or 503 at any moment, which is exactly why there are several.
    "or-ultra":    ("openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free", "OPENROUTER_API_KEY"),
    "or-super":    ("openrouter", "nvidia/nemotron-3-super-120b-a12b:free", "OPENROUTER_API_KEY"),
    "or-deepseek": ("openrouter", "deepseek/deepseek-v4-flash-0731:free",   "OPENROUTER_API_KEY"),
    "or-nex-pro":  ("openrouter", "nex-agi/nex-n2.5-pro:free",              "OPENROUTER_API_KEY"),
    "or-nex-mini": ("openrouter", "nex-agi/nex-n2.5-mini:free",             "OPENROUTER_API_KEY"),
    "or-dots":     ("openrouter", "dots-studio/dots-3-note-preview:free",   "OPENROUTER_API_KEY"),

    # --- OpenAI: configured, NOT IN USE ----------------------------------
    # The account's key returns 401 and the previous one returned 429
    # insufficient_quota. Add a valid, funded key and put "gpt-luna" at the
    # front of the "report" chain below — no other change is needed.
    "gpt-luna":    ("openai", "gpt-5.6-luna", "OPENAI_API_KEY"),
    "gpt-mini":    ("openai", "gpt-5.4-mini", "OPENAI_API_KEY"),
    "gpt-nano":    ("openai", "gpt-5.4-nano", "OPENAI_API_KEY"),
}

# Rejected on 2026-09-20, with the reason. Do not re-add without retesting.
#   qwen/qwen3.8-27b:free               429  rate limited
#   z-ai/glm-5.2:free                   429  and returns empty content
#   google/gemma-4-31b-it:free          429
#   google/gemma-4-26b-a4b-it:free      429
#   poolside/laguna-s-2.1:free          429
#   poolside/laguna-xs-2.1:free         empty content (reasoning model)
#   thinkingmachines/inkling*:free      403  not available on this account
#   inclusionai/ling-3.0-*:free         400  rejects response_format
#   nvidia/nemotron-3.5-lightning:free  leaks chain-of-thought into content
#   nvidia/nemotron-3.5-content-safety  a safety classifier, not a chat model
#   cohere/north-mini-code:free         code-specialised, wrong tool here

# Tried in order until one returns a valid object. A model whose key is
# unset is skipped silently, so the same chain works on any machine.
#
# Groq leads every chain because it is the only provider here that is
# reliable request-to-request. OpenRouter follows with two different
# vendors behind it, so one provider having a bad minute is survivable.
AI_CHAINS = {
    # Call 2 — the product's voice and its judgment.
    "report":   ["groq-large", "or-ultra", "or-super", "groq-small"],
    # Call 1 — structured extraction from a webpage. Runs on every scan,
    # so it leads with the cheapest model that can do the job.
    "classify": ["groq-small", "groq-large", "or-deepseek", "or-nex-mini"],
    # Calls 4+5 — the coverage rationale and the claim narrative, issued
    # as one request concurrently with the report. Same voice as the
    # report, so the same chain: these two blocks are the ones an insurance
    # person reads, and a weaker model shows immediately.
    "guidance": ["groq-large", "or-ultra", "or-super", "groq-small"],
    # Call 3 — cheap, cached, low stakes.
    "qa":       ["groq-small", "or-deepseek", "groq-large"],
}

# Aliases whose provider may log or train on submitted content. These must
# never appear in a chain that can carry contract text, uploaded policies,
# or connector data. Tier 0 sends only a public webpage, so free models are
# fine there — but the Tier 5 contract parser needs a paid endpoint.
# docs/ai-framework.md section 8
AI_TRAINS_ON_INPUT = {"or-ultra", "or-super", "or-deepseek",
                      "or-nex-pro", "or-nex-mini", "or-dots"}

# Per-model timeout, seconds. Deliberately tight.
#
# Measured 2026-09-20: every model in AI_MODELS answers in 1.4-6.0s when
# the provider is healthy. But free tiers queue, and one observed call to
# nemotron-ultra took 75s — which would blow SCAN_HARD_LIMIT on its own.
#
# So: give a model roughly 3x its normal latency, then abandon it and try
# the next one in the chain. Failing over to a working model in 20s beats
# waiting 75s for a stalled one. Raise this only if failovers become common
# on a healthy provider.
AI_TIMEOUT = float(os.getenv("AI_TIMEOUT", "20"))
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "4000"))

# --- rate limiting -------------------------------------------------------
# Overridable so a development machine does not spend an afternoon locked
# out by its own test runs. The default is unchanged and is what ships.
RATE_LIMIT_PER_IP = int(os.getenv("RATE_LIMIT_PER_IP", "10"))   # scans per hour
RATE_LIMIT_WINDOW_S = 3600
MAX_CONCURRENT_SCANS = 20

# --- domain validation ---------------------------------------------------
# A company's own domain is the unit of analysis. An email provider is not.
FREE_MAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
    "yahoo.com", "yahoo.co.in", "rediffmail.com", "protonmail.com", "proton.me",
    "icloud.com", "aol.com", "zoho.com", "mail.com", "yandex.com",
}

# --- DNS -----------------------------------------------------------------
# Fallbacks when the system resolver fails. Consumer routers and some cloud
# resolvers truncate large TXT responses, which would otherwise mark a
# healthy domain `inconclusive`. Cloudflare, then Google.
PUBLIC_RESOLVERS = ("1.1.1.1", "8.8.8.8")

# --- email authentication ------------------------------------------------
# Absence at all of these is a warning, never a failure: a custom selector
# may exist that we cannot enumerate. docs/scoring-and-pricing.md 1.1
DKIM_SELECTORS = (
    "google", "selector1", "selector2", "k1", "s1",
    "default", "mail", "dkim", "zoho", "mandrill",
)

# RFC 7208 caps SPF at 10 DNS-querying mechanisms. More than that and
# receivers may stop evaluating, which silently breaks the record.
SPF_MAX_LOOKUPS = 10

# --- attack surface ------------------------------------------------------
# Hostname fragments that suggest infrastructure not meant to be public.
# docs/scan-checks.md 5
SUBDOMAIN_RISK_PATTERNS = (
    "staging", "stage", "dev", "test", "uat", "qa", "demo",
    "admin", "internal", "vpn", "jenkins", "grafana", "kibana",
    "phpmyadmin", "jira", "gitlab", "backup", "old", "legacy",
)
SUBDOMAIN_SPRAWL_THRESHOLD = 50
SUBDOMAIN_MAX_PROBES = 40       # cap live-host probing so one scan cannot fan out

# In-flight probes. Forty simultaneous TLS handshakes from one process
# starve each other; healthy hosts then time out and were being reported
# as plaintext-only. Eight keeps every handshake fast enough to be honest.
SUBDOMAIN_PROBE_CONCURRENCY = 8

# --- certificates --------------------------------------------------------
TLS_EXPIRY_URGENT_DAYS = 14
TLS_EXPIRY_SOON_DAYS = 30
