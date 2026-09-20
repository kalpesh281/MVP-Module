"""TLS and certificate — 15 of the 100 points.

An ordinary TLS handshake on port 443, which is what every browser does.
Nothing here probes, fuzzes, or enumerates anything the server would not
hand to any visitor. docs/scan-checks.md legal basis

Built on stdlib `ssl` over asyncio rather than sslyze: it is non-blocking
without a thread pool, and it covers every rule the rubric actually needs.
sslyze was declared in requirements for weeks and imported nowhere; it was
removed on 2026-09-20 rather than left implying this file wraps it. If
cipher-suite enumeration ever earns points at Tier 2, add it back then.

Side effect worth knowing: this check is where the certificate's SAN list
comes from, and that list is the fallback source of subdomains when crt.sh
is slow or down. See `subdomains.py`.
"""

from __future__ import annotations

import asyncio
import ssl
from datetime import datetime, timezone

import httpx

from ..config import (
    TLS_EXPIRY_SOON_DAYS,
    TLS_EXPIRY_URGENT_DAYS,
    USER_AGENT,
)
from .base import CheckResult, Deduction

# OpenSSL verify codes we can turn into a specific, honest sentence.
# Anything else falls through to a generic "could not be verified".
_VERIFY_EXPIRED = {10, 12}          # cert / CRL has expired
_VERIFY_SELF_SIGNED = {18, 19}      # self-signed, or self-signed in chain
_VERIFY_NO_ISSUER = {2, 20, 21}     # unable to get issuer / verify leaf


async def _handshake(domain: str, ctx: ssl.SSLContext, timeout: float):
    """Open a TLS connection and return (peer cert, protocol, cipher)."""
    reader, writer = await asyncio.wait_for(
        asyncio.open_connection(domain, 443, ssl=ctx, server_hostname=domain),
        timeout,
    )
    try:
        sslobj = writer.get_extra_info("ssl_object")
        return (
            sslobj.getpeercert(),
            sslobj.getpeercert(binary_form=True),
            sslobj.version(),
            sslobj.cipher(),
        )
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass    # a server that drops the connection on close is not a finding


def _parse_der(der: bytes) -> dict:
    """Read a certificate we could not verify.

    `ssl.getpeercert()` returns an empty dict whenever `verify_mode` is
    CERT_NONE — which is precisely the path we take for an expired or
    self-signed certificate. Without this, the check would report "expired"
    while being unable to say when, or by whom it was issued. Those are the
    two facts a user needs in order to act.
    """
    try:
        from cryptography import x509
        from cryptography.x509.oid import ExtensionOID, NameOID
    except ImportError:
        return {}

    try:
        cert = x509.load_der_x509_certificate(der)
    except Exception:
        return {}

    out: dict = {}

    try:
        ext = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
        out["sans"] = list(ext.value.get_values_for_type(x509.DNSName))
    except Exception:
        out["sans"] = []

    for oid, key in ((NameOID.ORGANIZATION_NAME, "issuer"),
                     (NameOID.COMMON_NAME, "issuer_cn")):
        try:
            values = cert.issuer.get_attributes_for_oid(oid)
            if values:
                out[key] = values[0].value
        except Exception:
            pass

    try:
        # not_valid_after_utc is tz-aware; the deprecated not_valid_after is not.
        out["expires"] = getattr(cert, "not_valid_after_utc", None) or \
            cert.not_valid_after.replace(tzinfo=timezone.utc)
    except Exception:
        pass

    return out


def _expiry(cert: dict) -> datetime | None:
    raw = cert.get("notAfter")
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _issuer(cert: dict) -> str:
    for rdn in cert.get("issuer", ()):
        for key, value in rdn:
            if key == "organizationName":
                return value
    return "unknown"


async def _accepts_legacy_tls(domain: str) -> bool:
    """Does the server still accept TLS 1.0 or 1.1?

    Both are deprecated and both are a finding an underwriter recognises.
    Its own small budget: this is a second handshake and it must never be
    the reason the whole check times out.
    """
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        ctx.minimum_version = ssl.TLSVersion.TLSv1
        ctx.maximum_version = ssl.TLSVersion.TLSv1_1
    except ValueError:
        # OpenSSL 3 builds at security level 2 refuse to even offer these.
        # We cannot test, so we do not claim. Absence of proof, not proof
        # of absence.
        return False

    try:
        _, _, version, _ = await _handshake(domain, ctx, 2.5)
        return version in ("TLSv1", "TLSv1.1")
    except Exception:
        return False


async def _redirects_to_https(domain: str) -> bool | None:
    """Does plain HTTP redirect to HTTPS? None if we could not tell."""
    try:
        async with httpx.AsyncClient(
            follow_redirects=False, timeout=4.0, headers={"User-Agent": USER_AGENT}
        ) as client:
            response = await client.get(f"http://{domain}/")
    except Exception:
        return None

    if response.status_code in (301, 302, 303, 307, 308):
        return response.headers.get("location", "").lower().startswith("https://")
    # A 200 over plain HTTP means the site is served without redirecting.
    return False if response.status_code < 400 else None


async def run(domain: str) -> CheckResult:
    deductions: list[Deduction] = []
    evidence: dict = {"host": domain}

    verified_ctx = ssl.create_default_context()
    fatal: Deduction | None = None
    status_detail: str | None = None

    try:
        cert, der, version, cipher = await _handshake(domain, verified_ctx, 5.0)
        evidence["verified"] = True

    except ssl.SSLCertVerificationError as exc:
        # The certificate is real but does not validate. Reconnect without
        # verification so we can still read and report what it actually is
        # — refusing to look would leave us with nothing to show the user.
        code = getattr(exc, "verify_code", None)
        evidence["verified"] = False
        evidence["verify_error"] = getattr(exc, "verify_message", str(exc))

        if code in _VERIFY_SELF_SIGNED:
            fatal = Deduction("tls.self_signed")
            status_detail = "Certificate is self-signed — browsers will warn every visitor"
        elif code in _VERIFY_EXPIRED:
            fatal = Deduction("tls.invalid", note="expired")
            status_detail = "Certificate has expired"   # date appended below once parsed
        elif code in _VERIFY_NO_ISSUER:
            fatal = Deduction("tls.invalid", note="incomplete chain")
            status_detail = "Certificate chain is incomplete — some clients will reject it"
        else:
            fatal = Deduction("tls.invalid", note=str(code))
            status_detail = "Certificate does not match this domain"

        loose = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        loose.check_hostname = False
        loose.verify_mode = ssl.CERT_NONE
        try:
            cert, der, version, cipher = await _handshake(domain, loose, 5.0)
        except Exception:
            cert, der, version, cipher = {}, b"", None, None

    except (asyncio.TimeoutError, TimeoutError):
        return CheckResult.inconclusive("tls", "TLS handshake timed out", "Certificate")
    except (ConnectionRefusedError, OSError) as exc:
        # No HTTPS at all. That is a finding, not an inconclusive result —
        # a company with no TLS on its apex is meaningfully exposed.
        return CheckResult(
            id="tls", label="Certificate", status="fail",
            detail="No HTTPS service on this domain",
            evidence={"host": domain, "error": str(exc)},
            deductions=[Deduction("tls.invalid", note="no https")],
        )

    if fatal:
        deductions.append(fatal)

    # Parse the DER too. It is the only source of issuer and expiry when
    # the handshake was unverified, and the only source of SANs either way.
    parsed = _parse_der(der) if der else {}

    # --- expiry ----------------------------------------------------------
    expires = _expiry(cert) if cert else None
    if expires is None:
        expires = parsed.get("expires")
    days_left: int | None = None
    if expires:
        days_left = (expires - datetime.now(timezone.utc)).days
        evidence["expires"] = expires.isoformat()
        evidence["days_remaining"] = days_left
        if days_left < 0 and not fatal:
            deductions.append(Deduction("tls.invalid", note="expired"))
            status_detail = "Certificate has expired"
        elif 0 <= days_left <= TLS_EXPIRY_URGENT_DAYS:
            deductions.append(Deduction("tls.expiring_urgent", note=f"{days_left} days"))
        elif TLS_EXPIRY_URGENT_DAYS < days_left <= TLS_EXPIRY_SOON_DAYS:
            deductions.append(Deduction("tls.expiring_soon", note=f"{days_left} days"))

    issuer = _issuer(cert) if cert else "unknown"
    if issuer == "unknown":
        issuer = parsed.get("issuer") or parsed.get("issuer_cn") or "unknown"
    evidence["issuer"] = issuer
    if version:
        evidence["protocol"] = version
    if cipher:
        evidence["cipher"] = cipher[0]

    # SANs feed the attack-surface check. Free hostnames, already paid for.
    sans = parsed.get("sans", [])
    evidence["san_count"] = len(sans)

    # --- legacy protocol and redirect, concurrently ----------------------
    # These are worth 8 and 4 points, but the certificate itself is worth
    # 15 and is already in hand. Give the two probes a shared budget and
    # drop them if they overrun: losing two optional signals beats the
    # runner killing the check and throwing the certificate away too.
    try:
        legacy, redirects = await asyncio.wait_for(
            asyncio.gather(_accepts_legacy_tls(domain), _redirects_to_https(domain)),
            timeout=4.0,
        )
    except (asyncio.TimeoutError, TimeoutError):
        legacy, redirects = False, None
        evidence["probes_timed_out"] = True
    if legacy:
        deductions.append(Deduction("tls.legacy_protocol"))
        evidence["accepts_tls_1_0_or_1_1"] = True
    if redirects is False:
        deductions.append(Deduction("tls.no_redirect"))
    evidence["http_redirects_to_https"] = redirects

    # --- render ----------------------------------------------------------
    if status_detail:
        status, detail = "fail", status_detail
        if status_detail.startswith("Certificate has expired") and days_left is not None:
            detail = f"Certificate expired {abs(days_left)} days ago"
        if issuer != "unknown" and "self-signed" not in detail:
            detail += f" (issued by {issuer})"
    elif days_left is not None and days_left <= TLS_EXPIRY_URGENT_DAYS:
        status, detail = "fail", f"Certificate expires in {days_left} days"
    elif days_left is not None and days_left <= TLS_EXPIRY_SOON_DAYS:
        status, detail = "warn", f"Certificate expires in {days_left} days"
    elif deductions:
        status = "warn"
        detail = "Valid, but the configuration has gaps"
        if legacy:
            detail = "Valid, but the server still accepts TLS 1.0/1.1"
        elif redirects is False:
            detail = "Valid, but plain HTTP is served without redirecting to HTTPS"
    else:
        status = "pass"
        detail = (f"Valid, expires in {days_left} days" if days_left is not None
                  else "Valid")

    return CheckResult(
        id="tls", label="Certificate", status=status, detail=detail,
        evidence=evidence, deductions=deductions,
        extra={"sans": sans},          # consumed by subdomains.py
    )
