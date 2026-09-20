"""The product with every AI key unset.

This is not a degraded mode to apologise for. It is a gate-1 requirement:
a full scan with `GROQ_API_KEY` and `OPENROUTER_API_KEY` unset must still
produce a grade, a premium, a prioritised fix list and readable copy.
docs/testing.md GATE 1

The copy below is deliberately plainer than the model's, and written to
the same rules: business impact, second person, present tense, no jargon
in the title, jargon allowed in the instructions. docs/education-layer.md

One fix id, one entry. Keep this in sync with `scoring.fixes.CATALOG` —
the test `test_every_fix_has_fallback_copy` fails if it drifts.
"""

from __future__ import annotations

COPY: dict[str, tuple[str, str]] = {
    # fix id: (why_it_matters, how_to_fix)
    "dmarc": (
        "Right now anyone can send email that looks like it came from your "
        "domain, and the receiving mail server has no instruction to stop it. "
        "This is how most invoice and payment fraud against companies your "
        "size begins — a supplier or a customer gets an email that appears to "
        "be from your finance team, with new bank details.",
        "Publish a DMARC record as a TXT entry at _dmarc.yourdomain. Start "
        "with p=none and an rua address so you can see who is sending as you "
        "without breaking anything. After two weeks of reports, move to "
        "p=quarantine, then to p=reject. Do not start at p=reject.",
    ),
    "spf": (
        "Your domain does not clearly state which servers are allowed to send "
        "its mail, so receiving servers have to guess. Mail you send is more "
        "likely to land in spam, and mail someone else sends as you is more "
        "likely to get through.",
        "Publish a single SPF TXT record listing every service that sends on "
        "your behalf — your mail provider, your CRM, your billing system — and "
        "end it with -all. Keep it under 10 DNS lookups, which usually means "
        "flattening or removing an include you no longer use.",
    ),
    "dkim": (
        "Your outgoing mail carries no cryptographic signature, so a receiving "
        "server cannot confirm the message really came from you and was not "
        "altered on the way. DMARC cannot reach its strongest setting without it.",
        "Turn on DKIM signing in your mail provider's admin console — it is a "
        "checkbox in Google Workspace and Microsoft 365 — then publish the "
        "public key it gives you as a TXT record at the selector it names.",
    ),
    "tls_certificate": (
        "Visitors to your site get a browser security warning before they see "
        "anything you have written. Most leave. It also means any assessor "
        "looking at you sees the most visible possible sign that nobody is "
        "watching the basics.",
        "Issue a valid certificate from a public CA — Let's Encrypt is free — "
        "for every hostname the site answers on, and install the full chain, "
        "not just the leaf certificate. Then set up automatic renewal.",
    ),
    "tls_expiry": (
        "Your certificate expires shortly. When it does, every visitor gets a "
        "full-page security warning and your site is effectively down, usually "
        "on a weekend.",
        "Renew it now, then automate renewal so this cannot recur. Certbot or "
        "your hosting provider's managed certificates both handle this.",
    ),
    "tls_legacy": (
        "Your server still accepts encryption standards that were withdrawn "
        "years ago. An attacker positioned on the network between your users "
        "and you can force the weaker option and read the traffic.",
        "Disable TLS 1.0 and TLS 1.1 at your web server or CDN and accept only "
        "TLS 1.2 and 1.3. On any managed platform this is a single setting.",
    ),
    "tls_redirect": (
        "Someone typing your address without https gets an unencrypted "
        "connection, and anything they submit on that page — including a "
        "password — travels in the clear.",
        "Redirect all HTTP traffic to HTTPS with a 301 at the web server or "
        "CDN, then add HSTS so browsers stop trying HTTP at all.",
    ),
    "hsts": (
        "Browsers are not told to insist on HTTPS for your domain, so the "
        "first request of every visit can still be downgraded to an "
        "unencrypted one before your redirect takes effect.",
        "Add the header Strict-Transport-Security: max-age=31536000; "
        "includeSubDomains. Confirm every subdomain works over HTTPS first — "
        "this header is not easily reversed.",
    ),
    "csp": (
        "Nothing limits what code is allowed to run on your pages. If any "
        "third-party script you load is ever compromised — an analytics tag, a "
        "chat widget, a payment form — it can read whatever your users type.",
        "Add a Content-Security-Policy header. Deploy it in "
        "Content-Security-Policy-Report-Only mode first, collect the reports "
        "for a week to find everything your own site legitimately loads, then "
        "enforce it.",
    ),
    "headers_basic": (
        "Two one-line browser protections are missing. Without them your pages "
        "can be loaded invisibly inside someone else's site to capture clicks, "
        "and a file a user uploads can be served back as executable code.",
        "Add X-Frame-Options: DENY (or a CSP frame-ancestors directive) and "
        "X-Content-Type-Options: nosniff. Both are single lines in your web "
        "server or CDN configuration.",
    ),
    "risk_hosts": (
        "Systems that look like they were meant to be internal are reachable "
        "from the public internet. A forgotten staging server running an old "
        "build with a copy of production data is the most common way a company "
        "your size gets ransomwared, and it is invisible from the inside "
        "because nobody remembers it exists.",
        "For each host: decide whether it should be public at all. If not, put "
        "it behind your VPN or an IP allowlist and remove the public DNS "
        "record. If it must stay public, make sure it holds no production data "
        "and requires authentication.",
    ),
    "directory_listing": (
        "A server is listing its own files to anyone who asks. Backups, logs "
        "and configuration files left in a web directory get found this way, "
        "usually by an automated scanner rather than a person.",
        "Turn off automatic directory indexing — Options -Indexes in Apache, "
        "autoindex off in nginx — and move anything that is not meant to be "
        "downloaded out of the web root entirely.",
    ),
    "plaintext_hosts": (
        "Some of your sites are served without encryption. Anything submitted "
        "to them can be read in transit, and browsers now label them as Not "
        "Secure in the address bar.",
        "Issue certificates for these hostnames and redirect HTTP to HTTPS. If "
        "a host is no longer used, remove its DNS record instead.",
    ),
    "subdomain_sprawl": (
        "You have more public hostnames than anyone is actively tracking. Each "
        "one is a way in, and the ones nobody remembers are the ones nobody "
        "patches.",
        "Export your DNS zone and go through it. Remove records pointing at "
        "infrastructure you no longer run — those are also the ones open to "
        "subdomain takeover — and write down an owner for each one that stays.",
    ),
}

HEADLINE: dict[str, str] = {
    "A": "Your externally visible security is in good shape.",
    "B": "Solid overall, with a few gaps an underwriter would ask about.",
    "C": "Several things here would come up in an insurance application.",
    "D": "Enough is exposed that cover will cost more than it needs to.",
    "F": "Serious gaps are visible from outside. Most insurers would want these closed first.",
}

NO_GRADE_HEADLINE = (
    "We could not complete enough checks to grade this domain fairly, so we "
    "are showing only what we were able to confirm."
)


def headline(grade: str | None) -> str:
    return HEADLINE.get(grade or "", NO_GRADE_HEADLINE)


def copy_for(fix_id: str) -> tuple[str, str]:
    """(why_it_matters, how_to_fix). Never raises — a fix with no entry
    still renders, it just says less."""
    return COPY.get(fix_id, ("", ""))


# --- Stage 2: coverage guidance ------------------------------------------
#
# One template per driver. These are not placeholders waiting for a model —
# they are what a reader sees whenever the AI layer is unavailable, so they
# have to stand on their own. Each names the specific reason the limit was
# chosen, because "we recommend ₹5 Cr" with no reason attached is the
# failure mode this whole module exists to avoid.
_RATIONALE: dict[str, str] = {
    "contract": (
        "This is not our recommendation — it is what your customer contract "
        "already requires you to carry."
    ),
    "sensitive_data": (
        "You handle health or payment card data, which is the most expensive "
        "category to lose and the one regulators respond to fastest."
    ),
    "financial_data": (
        "You handle financial and transactional data, so an incident reaches "
        "your customers' money, not just their records."
    ),
    "pii_at_scale": (
        "You hold personal data at a scale where the DPDP Act applies and "
        "notification alone is a significant cost."
    ),
    "pii": (
        "You hold customer personal data, so the DPDP Act applies to you and a "
        "breach carries a notification obligation."
    ),
    "headcount": (
        "At your headcount, an outage stops enough people working that business "
        "interruption becomes the largest line in the claim."
    ),
    "baseline": (
        "You handle no sensitive data we can see from outside, so this is a "
        "floor rather than a needs analysis."
    ),
}

_NARRATIVE: dict[str, str] = {
    "email_spoof": (
        "Someone registers a lookalike domain or sends mail that passes as yours, "
        "and asks a customer or your own finance team to change bank details. "
        "The message arrives from an address that looks correct because nothing "
        "in your DNS tells the receiving server to reject it."
    ),
    "account_takeover": (
        "A password exposed in someone else's breach is reused on one of your "
        "accounts, and the first sign is activity that looks legitimate because "
        "it is authenticated. What follows is a data question, not a hacking one."
    ),
    "ransomware": (
        "An internet-reachable server that was never meant to be public is found "
        "by a scanner that is not ours, and used as the way in. Recovery is "
        "rarely the expensive part; the days you cannot trade are."
    ),
    "web_compromise": (
        "Code you did not write runs on a page your customers trust, because "
        "nothing on your site limits what is allowed to load. The people harmed "
        "are your customers, which is what turns it into a liability claim."
    ),
}


def _rupees(amount: int) -> str:
    """₹40 L / ₹1.2 Cr. Indian units, because the reader thinks in them."""
    if amount >= 10_000_000:
        crore = amount / 10_000_000
        return f"₹{crore:.0f} Cr" if crore == int(crore) else f"₹{crore:.1f} Cr"
    return f"₹{amount // 100_000} L"


def coverage_rationale(
    driver: str,
    limit_label: str,
    band: dict[str, int],
    clause: str | None = None,
) -> dict[str, str]:
    """Module A's copy with no model involved."""
    reason = _RATIONALE.get(driver, _RATIONALE["baseline"])
    if driver == "contract" and clause:
        reason = (
            f"Clause {clause} of your customer contract requires this limit. "
            "It is an obligation, not advice."
        )
    return {
        "headline": f"Recommended: {limit_label}",
        "reasoning": (
            f"{reason} An incident at your size typically costs "
            f"{_rupees(band['low'])}–{_rupees(band['high'])} once notification, "
            "forensics, legal and regulatory response are counted."
        ),
        "downside": (
            "A lower limit leaves the balance with you, and the shortfall is "
            "payable at the worst possible moment."
        ),
    }


def scenario_narrative(scenario_id: str | None) -> str:
    return _NARRATIVE.get(scenario_id or "", "")
