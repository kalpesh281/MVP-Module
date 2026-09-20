"""Environment, constants and tunables.

Nothing in this module imports from app.scanner, app.scoring or app.ai.
It is the bottom of the dependency graph.
"""

import os

from dotenv import load_dotenv

load_dotenv()

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
