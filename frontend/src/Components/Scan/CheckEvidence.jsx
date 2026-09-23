/**
 * What we actually observed, printed verbatim.
 *
 * Every check already ships an `evidence` object — `CheckResult.as_event()`
 * in `backend/app/scanner/base.py` puts it on the wire — and until now the
 * frontend read exactly one field out of it (`final_url`) and discarded
 * the rest. That was the single largest credibility loss in the product:
 * the page said "No security headers are set" and gave the reader no way
 * to check, which is the opposite of what this page claims about itself.
 *
 * **Nothing here is reformatted.** The SPF string is the SPF string, the
 * status code is the status code, the hostname list is the hostname list.
 * A prettified record is not evidence — the whole point is that a CTO can
 * paste `dig TXT _dmarc.example.com` into a terminal and get back
 * character-for-character what this panel shows. Where we summarise, the
 * summary sits beside the raw value and never replaces it.
 *
 * It is deliberately monospace on a sunken panel. Prose in the page's
 * body font reads as something we wrote; a fixed-width block on a recessed
 * surface reads as something a machine recorded. That distinction is the
 * whole job of this component.
 *
 * `extra` — raw HTML, the parsed certificate — is never serialised to the
 * client, so nothing in this file can leak it.
 *
 * docs/defending-the-score.md
 */

/**
 * One `label → value` line of the record.
 *
 * Two columns from `sm`, stacked below it. A fixed 144px label column on a
 * 390px screen left about 90px for the value, which broke
 * `16 of 40 checked` across three lines mid-word — unreadable, and worse,
 * it made machine output look like a rendering fault.
 */
function Row({ label, children, mono = true }) {
  return (
    <div className="flex flex-col gap-y-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
      <dt className="shrink-0 text-caption text-ink-faint sm:w-36">{label}</dt>
      <dd
        // `break-all` only on machine output. A hostname or a cipher suite
        // has no sensible break point and must be allowed to split
        // anywhere; prose must not, or "logs)" comes back as "log/s)".
        className={`min-w-0 text-caption text-ink-muted sm:flex-1 ${
          mono ? 'break-all font-mono' : 'break-words'
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

/** A record as it came off the wire. Selectable, wraps, never truncated. */
function Raw({ children }) {
  return (
    <p className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-caption
                  leading-relaxed break-all text-ink">
      {children}
    </p>
  );
}

/** A DNS answer: the exact name queried, then the exact string returned. */
function Lookup({ type = 'TXT', name, record, none }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-caption text-ink-faint">
        dig {type} {name}
      </p>
      {record ? <Raw>{record}</Raw> : (
        <p className="font-mono text-caption text-ink-muted">
          {none || 'NXDOMAIN — no record returned'}
        </p>
      )}
    </div>
  );
}

/** Names as chips. Used for selectors and header names. */
function Names({ items, tone = 'text-ink-muted' }) {
  if (!items?.length) return <span className="font-mono text-caption text-ink-faint">none</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((name) => (
        <span
          key={name}
          className={`rounded border border-line bg-surface px-1.5 py-0.5 font-mono
                      text-caption ${tone}`}
        >
          {name}
        </span>
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------- */

/**
 * One renderer per check. Each reads only the keys its own scanner writes,
 * so a scanner that grows a field does not silently change another check's
 * panel. An id with no renderer produces nothing rather than a dump of raw
 * JSON — an object printed at a reader is not evidence either.
 */
const RENDERERS = {
  spf: (e) => (
    <>
      <Lookup name={e.lookup} record={e.record} none="no SPF record published" />
      {typeof e.dns_lookups === 'number' && (
        <dl className="space-y-1">
          <Row label="DNS lookups">
            {e.dns_lookups} of 10
            <span className="ml-2 font-sans text-ink-faint">
              {/* Over ten and receivers are entitled to stop resolving,
                  which fails the record open. RFC 7208 section 4.6.4. */}
              (RFC 7208 caps this at 10)
            </span>
          </Row>
        </dl>
      )}
    </>
  ),

  dkim: (e) => (
    <dl className="space-y-1.5">
      <Row label="Selectors answering">
        <Names items={e.selectors_found} tone="text-ink" />
      </Row>
      <Row label="Names we tried">
        <Names items={e.selectors_probed} />
      </Row>
      <Row label="Method" mono={false}>
        <span className="text-ink-faint">
          A TXT lookup of <code className="font-mono">&lt;selector&gt;._domainkey</code> for
          each name above. Only common selectors can be found this way — a
          custom one exists but does not answer here.
        </span>
      </Row>
    </dl>
  ),

  dmarc: (e) => (
    <>
      <Lookup name={e.lookup} record={e.record} none="no DMARC record published" />
      {e.record && (
        <dl className="space-y-1">
          <Row label="Policy">p={e.policy || 'none'}</Row>
          {typeof e.pct === 'number' && <Row label="Applied to">pct={e.pct}%</Row>}
          <Row label="Reports requested">{e.reporting ? 'yes (rua)' : 'no'}</Row>
          {e.downgraded_for_pct && (
            <Row label="Effective policy">
              {e.effective_policy}
              <span className="ml-2 font-sans text-ink-faint">
                (pct&lt;100 means the stated policy is not what most mail meets)
              </span>
            </Row>
          )}
        </dl>
      )}
    </>
  ),

  tls: (e) => (
    <dl className="space-y-1">
      <Row label="Host">{e.host}</Row>
      {e.error ? (
        <Row label="Error">{e.error}</Row>
      ) : (
        <>
          <Row label="Issuer" mono={false}>{e.issuer}</Row>
          {e.expires && (
            <Row label="Expires">
              {e.expires.slice(0, 10)}
              {typeof e.days_remaining === 'number' && (
                <span className="ml-2 font-sans text-ink-faint">
                  ({e.days_remaining} days)
                </span>
              )}
            </Row>
          )}
          <Row label="Chain verified">{e.verified ? 'yes' : `no — ${e.verify_error}`}</Row>
          {e.protocol && <Row label="Negotiated">{e.protocol} · {e.cipher}</Row>}
          <Row label="HTTP redirects">
            {e.http_redirects_to_https ? 'to HTTPS' : 'no — plain HTTP is served'}
          </Row>
          {e.accepts_tls_1_0_or_1_1 && (
            <Row label="Also accepts">TLS 1.0 / 1.1 — withdrawn protocols</Row>
          )}
          {e.probes_timed_out && (
            <Row label="Note" mono={false}>
              <span className="text-ink-faint">
                Old-protocol probes timed out, so this is not recorded either way.
              </span>
            </Row>
          )}
        </>
      )}
    </dl>
  ),

  headers: (e) => (
    <>
      <div className="space-y-1.5">
        <p className="font-mono text-caption text-ink-faint">GET {e.final_url}</p>
        <p className="font-mono text-caption text-ink">{e.status_code}</p>
      </div>
      <dl className="space-y-1.5">
        <Row label="Set">
          <Names items={e.present} tone="text-ink" />
        </Row>
        <Row label="Missing">
          <Names items={e.missing} tone="text-ink" />
        </Row>
        {e.fingerprint && Object.keys(e.fingerprint).length > 0 && (
          <Row label="Server says">
            {Object.entries(e.fingerprint)
              .map(([key, value]) => `${key}: ${value}`)
              .join('  ·  ')}
          </Row>
        )}
      </dl>
      {/* Last line, not first. Without it "No security headers are set"
          reads as a claim about a company's whole estate rather than about
          the single page we asked for, which is all we looked at — but it
          is a caveat on the finding, so it belongs under the finding. */}
      <p className="text-caption leading-relaxed text-ink-faint">
        One address, not your whole estate. Other hosts may answer differently.
      </p>
    </>
  ),

  creds: (e) => (
    <dl className="space-y-1.5">
      <Row label="Source" mono={false}>
        Have I Been Pwned, public breach index
      </Row>
      {e.own_breaches?.length ? (
        e.own_breaches.map((breach) => (
          <Row key={breach.name} label={breach.name} mono={false}>
            <span className="font-mono">{String(breach.date || '').slice(0, 10)}</span>
            {typeof breach.accounts === 'number' && (
              <span className="ml-2 text-ink-faint">
                {breach.accounts.toLocaleString('en-IN')} accounts
              </span>
            )}
            {breach.verified === false && (
              <span className="ml-2 text-ink-faint">unverified by HIBP</span>
            )}
            {breach.data_classes?.length > 0 && (
              <span className="mt-0.5 block text-ink-faint">
                {breach.data_classes.join(' · ')}
              </span>
            )}
          </Row>
        ))
      ) : (
        <Row label="Breaches listed" mono={false}>
          <span className="text-ink-muted">
            none naming this company
          </span>
        </Row>
      )}
      {/* The count of exposed employee accounts sits behind HIBP's paid
          API. We say the search was not run rather than implying a zero —
          docs/scan-checks.md: never display a figure we cannot substantiate. */}
      {e.unavailable?.includes('creds.account_exposure') && (
        <Row label="Not searched" mono={false}>
          <span className="text-ink-faint">
            Individual employee-account exposure. That index is not public, so
            this check does not claim a number either way.
          </span>
        </Row>
      )}
    </dl>
  ),

  subdomains: (e) => (
    <>
      <dl className="space-y-1">
        <Row label="Source" mono={false}>
          {e.source}
          <span className="ml-2 text-ink-faint">
            (public certificate transparency logs)
          </span>
        </Row>
        <Row label="Hostnames listed">{e.hostnames_found}</Row>
        <Row label="Resolved and reachable">{e.live} of {e.probed} checked</Row>
      </dl>

      {e.risky_hosts?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-caption text-ink-faint">
            Reachable and named like something internal
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line
                         bg-surface">
            {e.risky_hosts.map((host) => (
              <li
                key={host.host}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5
                           px-3 py-1.5"
              >
                <span className="min-w-0 break-all font-mono text-caption text-ink">
                  {host.scheme}://{host.host}
                </span>
                <span className="shrink-0 font-mono text-caption text-ink-faint">
                  {host.status}
                  {host.server ? ` · ${host.server}` : ''}
                  {host.directory_listing ? ' · directory listing' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Say when the list is a floor rather than a census. A reader who
          assumes this is everything will under-read their own exposure. */}
      {(e.truncated || e.enumeration_complete === false) && (
        <p className="text-caption leading-relaxed text-ink-faint">
          We stopped after {e.probed} hosts. This is a floor, not a full
          inventory — there may be more.
        </p>
      )}
      {e.source_degraded && (
        <p className="text-caption leading-relaxed text-ink-faint">
          The usual source was unavailable, so this came from the fallback.
          Recorded rather than blended in, so a later scan that disagrees can
          be told apart from the company having changed.
        </p>
      )}
    </>
  ),
};

export default function CheckEvidence({ id, evidence }) {
  const render = RENDERERS[id];
  if (!render || !evidence || Object.keys(evidence).length === 0) return null;

  return (
    <div className="space-y-2.5 rounded-lg border border-line bg-sunken px-4 py-3">
      <p className="text-eyebrow uppercase text-ink-faint">What we read</p>
      {render(evidence)}
    </div>
  );
}
