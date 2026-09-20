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
RATE_VERSION = "v1.0"

# --- identity ------------------------------------------------------------
USER_AGENT = os.getenv(
    "USER_AGENT",
    "CyberScorecard/0.1 (+https://example.com/about-our-scanner)",
)

# --- data sources --------------------------------------------------------
MONGODB_URI = os.getenv("MONGODB_URI") or None
MONGODB_DB = os.getenv("MONGODB_DB", "scorecard")
HIBP_API_KEY = os.getenv("HIBP_API_KEY") or None

SCAN_CACHE_HOURS = int(os.getenv("SCAN_CACHE_HOURS", "6"))

# --- timing --------------------------------------------------------------
# Per-check budgets, seconds. docs/scan-checks.md
TIMEOUTS = {
    "email_auth": 3.0,
    "tls": 5.0,
    "headers": 6.0,
    "creds": 8.0,
    "subdomains": 8.0,
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
    "openai":     "https://api.openai.com/v1",
}

# key: a short alias you use in the chains below and in PROVIDER_* overrides
# value: (provider, model id, env var holding the key)
AI_MODELS = {
    # Groq — FREE. 30 req/min, 1,000 req/day, 200K tokens/day.
    # The token cap binds first: roughly 60-80 scans/day.
    "groq-large":  ("groq", "openai/gpt-oss-120b", "GROQ_API_KEY"),
    "groq-small":  ("groq", "openai/gpt-oss-20b",  "GROQ_API_KEY"),
    "groq-qwen":   ("groq", "qwen/qwen3.8-27b",    "GROQ_API_KEY"),

    # OpenRouter — FREE. 20 req/min, 50 req/day on :free models.
    # Individually flaky (503/429 are common); good as a second choice.
    "or-large":    ("openrouter", "nvidia/nemotron-3-super-120b-a12b:free", "OPENROUTER_API_KEY"),
    "or-mid":      ("openrouter", "qwen/qwen3.8-27b:free",                  "OPENROUTER_API_KEY"),

    # OpenAI — PAID. Activates automatically once the account has credit.
    "gpt-mini":    ("openai", "gpt-4.1-mini", "OPENAI_API_KEY"),
    "gpt-nano":    ("openai", "gpt-4.1-nano", "OPENAI_API_KEY"),
    "gpt-5":       ("openai", "gpt-5",        "OPENAI_API_KEY"),
}

# Tried in order until one returns a valid object. A model whose key is
# unset is skipped silently, so the same chain works on any machine.
AI_CHAINS = {
    # Call 2 — the product's voice and its judgment. Best available first.
    "report":   ["gpt-mini", "groq-large", "or-large", "groq-small"],
    # Call 1 — structured extraction from a webpage. Runs on every scan,
    # so it leads with the cheapest model that can do the job.
    "classify": ["groq-small", "groq-large", "or-mid", "gpt-nano"],
    # Call 3 — cheap, cached, low stakes.
    "qa":       ["groq-small", "groq-large", "or-mid"],
}

# Aliases whose provider may log or train on submitted content. These must
# never appear in a chain that can carry contract text, uploaded policies,
# or connector data. Tier 0 sends only a public webpage, so free models are
# fine there — but the Tier 5 contract parser must use a paid endpoint.
# docs/ai-framework.md section 8
AI_TRAINS_ON_INPUT = {"or-large", "or-mid"}   # OpenRouter :free variants

AI_TIMEOUT = float(os.getenv("AI_TIMEOUT", "60"))
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "4000"))

# --- rate limiting -------------------------------------------------------
RATE_LIMIT_PER_IP = 10          # scans per hour
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

# --- certificates --------------------------------------------------------
TLS_EXPIRY_URGENT_DAYS = 14
TLS_EXPIRY_SOON_DAYS = 30
