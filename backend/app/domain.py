"""Domain normalisation and validation.

The single entry point for turning whatever a user typed into the
registrable domain we scan — or a specific, readable rejection.

Rejections are specific on purpose. "Invalid domain" teaches nothing;
"that's an email provider, enter your company's own domain" teaches
the user what we need. docs/education-layer.md
"""

from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlsplit

from .config import FREE_MAIL_DOMAINS

# Hostname label rules, RFC 1123: alphanumeric and hyphen, no leading or
# trailing hyphen, 1-63 characters per label.
_LABEL = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")


class InvalidDomain(Exception):
    """Raised with a machine code and a message written for a human."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def normalise(raw: str) -> str:
    """Return the registrable domain, or raise InvalidDomain.

    >>> normalise("https://www.Yourco.com/pricing?x=1")
    'yourco.com'
    >>> normalise("  YOURCO.CO.IN  ")
    'yourco.co.in'
    """
    if not raw or not raw.strip():
        raise InvalidDomain("invalid_domain", "Enter a domain to check.")

    value = raw.strip().lower()

    # Accept a pasted URL. urlsplit needs a scheme to populate .netloc.
    if "://" not in value:
        value = f"//{value}"
    host = urlsplit(value).netloc or urlsplit(value).path

    host = host.split("@")[-1]          # tolerate someone pasting an email
    host = host.split(":")[0]           # strip a port
    host = host.strip("/").strip(".")

    if not host:
        raise InvalidDomain("invalid_domain", "Enter a domain to check.")

    if len(host) > 253:
        raise InvalidDomain("invalid_domain", "That domain is too long to be real.")

    # An IP address has no DNS records to read and no company behind it.
    try:
        ipaddress.ip_address(host)
        raise InvalidDomain(
            "invalid_domain",
            "That's an IP address. Enter your company's domain name instead.",
        )
    except ValueError:
        pass

    try:
        host = host.encode("idna").decode("ascii")
    except UnicodeError:
        raise InvalidDomain("invalid_domain", "We couldn't read that domain name.") from None

    labels = host.split(".")
    if len(labels) < 2:
        raise InvalidDomain(
            "invalid_domain",
            "That looks like a hostname, not a domain. Try yourcompany.com.",
        )
    for label in labels:
        if not _LABEL.match(label):
            raise InvalidDomain("invalid_domain", "That doesn't look like a valid domain.")

    host = _registrable(host)

    if host in FREE_MAIL_DOMAINS:
        raise InvalidDomain(
            "free_mail_domain",
            "That's an email provider. Enter your company's own domain — "
            "the one on your website.",
        )

    return host


def _registrable(host: str) -> str:
    """Strip subdomains down to the registrable domain.

    Uses the public suffix list when available so `yourco.co.in` survives
    but `www.yourco.co.in` collapses correctly. Falls back to a two-label
    heuristic, which is wrong for multi-part suffixes — acceptable only as
    a fallback, and the reason publicsuffixlist is a dependency.
    """
    try:
        from publicsuffixlist import PublicSuffixList
    except ImportError:
        return ".".join(host.split(".")[-2:])

    registrable = PublicSuffixList().privatesuffix(host)
    if not registrable:
        # No recognised public suffix — .local, .internal, a typo'd TLD.
        raise InvalidDomain(
            "invalid_domain",
            "We don't recognise that domain ending. Check the spelling?",
        )
    return registrable


def is_free_mail(host: str) -> bool:
    return host.lower() in FREE_MAIL_DOMAINS
