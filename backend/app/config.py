import os
from dotenv import load_dotenv

load_dotenv()

RUBRIC_VERSION = "v1.0"
RATE_VERSION = "v1.0"

USER_AGENT = os.getenv(
    "USER_AGENT",
    "CyberScorecard/0.1 (+https://example.com/about-our-scanner)",
)
MONGODB_URI = os.getenv("MONGODB_URI") or None
MONGODB_DB = os.getenv("MONGODB_DB", "scorecard")

HIBP_API_KEY = os.getenv("HIBP_API_KEY") or None
SCAN_CACHE_HOURS = int(os.getenv("SCAN_CACHE_HOURS", "6"))

# Per-check timeouts, seconds (docs/scan-checks.md)
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

FREE_MAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
    "yahoo.com", "yahoo.co.in", "rediffmail.com", "protonmail.com", "proton.me",
    "icloud.com", "aol.com", "zoho.com", "mail.com", "yandex.com",
}
