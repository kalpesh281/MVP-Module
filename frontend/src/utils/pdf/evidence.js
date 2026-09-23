/**
 * The observed record, flattened into printable lines.
 *
 * The screen renders evidence as JSX in `Components/Scan/CheckEvidence.jsx`.
 * Paper cannot reuse that, so this is the same knowledge expressed as data
 * — one function per check id, each reading only the keys its own scanner
 * writes, returning `{ command?, record?, rows[], note? }`.
 *
 * The split matters for how it sets:
 *
 *  - `command` is the lookup we performed, set in Courier as a shell line
 *  - `record` is the answer we got back, boxed, set in Courier, verbatim
 *  - `rows` are `label → value` pairs, the value mono when it is machine
 *    output and roman when it is our summary of it
 *  - `note` is a caveat on the finding, set in roman under everything
 *
 * **Nothing is reformatted.** A CTO holding this printout must be able to
 * type the command and get back the string in the box, character for
 * character. That is the entire argument the document makes for itself.
 */

const yesNo = (value) => (value ? 'yes' : 'no');

const BUILDERS = {
  spf: (e) => ({
    command: `dig TXT ${e.lookup}`,
    record: e.record || null,
    empty: e.record ? null : 'No SPF record is published for this domain.',
    rows: [
      e.dns_lookups != null && {
        label: 'DNS lookups',
        value: `${e.dns_lookups} of 10`,
        mono: true,
        after: 'RFC 7208 caps an SPF record at ten lookups. Past ten, a receiver may stop resolving and the record fails open.',
      },
    ],
  }),

  dkim: (e) => ({
    rows: [
      {
        label: 'Selectors answering',
        value: e.selectors_found?.length ? e.selectors_found.join('  ') : 'none',
        mono: true,
      },
      {
        label: 'Names we tried',
        value: e.selectors_probed?.length ? e.selectors_probed.join('  ') : '—',
        mono: true,
      },
    ],
    note: 'A TXT lookup of <selector>._domainkey for each name above. Only selectors in common use can be found this way — a custom selector exists but does not answer to a guess, so absence here is not proof of absence.',
  }),

  dmarc: (e) => ({
    command: `dig TXT ${e.lookup}`,
    record: e.record || null,
    empty: e.record ? null : 'No DMARC record is published for this domain.',
    rows: [
      e.record && { label: 'Policy', value: `p=${e.policy || 'none'}`, mono: true },
      e.record && e.pct != null && { label: 'Applied to', value: `pct=${e.pct}%`, mono: true },
      e.record && { label: 'Reports requested', value: e.reporting ? 'yes (rua)' : 'no', mono: true },
      e.downgraded_for_pct && {
        label: 'Effective policy',
        value: String(e.effective_policy),
        mono: true,
        after: 'pct below 100 means the stated policy is not what most mail actually meets.',
      },
    ],
  }),

  tls: (e) => ({
    rows: e.error
      ? [{ label: 'Host', value: e.host, mono: true }, { label: 'Error', value: e.error, mono: true }]
      : [
          { label: 'Host', value: e.host, mono: true },
          { label: 'Issuer', value: e.issuer || '—' },
          e.expires && {
            label: 'Expires',
            value: `${String(e.expires).slice(0, 10)}${
              e.days_remaining != null ? `   (${e.days_remaining} days)` : ''
            }`,
            mono: true,
          },
          {
            label: 'Chain verified',
            value: e.verified ? 'yes' : `no — ${e.verify_error || 'not verified'}`,
            mono: true,
          },
          e.protocol && { label: 'Negotiated', value: `${e.protocol}  ${e.cipher || ''}`.trim(), mono: true },
          {
            label: 'HTTP redirects',
            value: e.http_redirects_to_https ? 'to HTTPS' : 'no — plain HTTP is served',
            mono: true,
          },
          e.accepts_tls_1_0_or_1_1 && {
            label: 'Also accepts',
            value: 'TLS 1.0 / 1.1 — withdrawn protocols',
            mono: true,
          },
        ],
    note: e.probes_timed_out
      ? 'Old-protocol probes timed out, so support for TLS 1.0 and 1.1 is not recorded either way.'
      : null,
  }),

  headers: (e) => ({
    command: `GET ${e.final_url}`,
    record: e.status_code != null ? String(e.status_code) : null,
    rows: [
      { label: 'Set', value: e.present?.length ? e.present.join('  ') : 'none', mono: true },
      { label: 'Missing', value: e.missing?.length ? e.missing.join('  ') : 'none', mono: true },
      e.fingerprint && Object.keys(e.fingerprint).length > 0 && {
        label: 'Server says',
        value: Object.entries(e.fingerprint).map(([k, v]) => `${k}: ${v}`).join('   '),
        mono: true,
      },
    ],
    note: 'One address, not the whole estate. Other hosts on this domain may answer differently.',
  }),

  creds: (e) => ({
    rows: [
      { label: 'Source', value: 'Have I Been Pwned, public breach index' },
      ...(e.own_breaches?.length
        ? e.own_breaches.map((b) => ({
            label: b.name,
            value: [
              String(b.date || '').slice(0, 10),
              b.accounts != null ? `${new Intl.NumberFormat('en-IN').format(b.accounts)} accounts` : null,
              b.verified === false ? 'unverified by HIBP' : null,
              b.data_classes?.length ? b.data_classes.join(' · ') : null,
            ].filter(Boolean).join('   '),
          }))
        : [{ label: 'Breaches listed', value: 'none naming this company' }]),
      e.unavailable?.includes('creds.account_exposure') && {
        label: 'Not searched',
        value: 'Individual employee-account exposure',
        after: 'That index is not public. This check does not claim a number either way, in either direction — an unsubstantiated count is worse than no count.',
      },
    ],
  }),

  subdomains: (e) => ({
    rows: [
      { label: 'Source', value: `${e.source} (public certificate transparency logs)` },
      { label: 'Hostnames listed', value: String(e.hostnames_found ?? '—'), mono: true },
      {
        label: 'Reachable',
        value: `${e.live ?? '—'} of ${e.probed ?? '—'} checked`,
        mono: true,
      },
      { label: 'Enumeration complete', value: yesNo(e.enumeration_complete !== false), mono: true },
    ],
    hosts: (e.risky_hosts || []).map((h) => ({
      host: `${h.scheme}://${h.host}`,
      status: String(h.status ?? ''),
      server: [h.server, h.directory_listing ? 'directory listing' : null]
        .filter(Boolean)
        .join(' · '),
    })),
    note: [
      e.truncated || e.enumeration_complete === false
        ? `Probing stopped after ${e.probed} hosts. This list is a floor, not a full inventory — there may be more.`
        : null,
      e.source_degraded
        ? 'The usual source was unavailable and this came from the fallback. Recorded rather than blended in, so a later scan that disagrees can be told apart from the company having changed.'
        : null,
    ].filter(Boolean).join(' ') || null,
  }),
};

export default function evidenceFor(id, evidence) {
  const build = BUILDERS[id];
  if (!build || !evidence || Object.keys(evidence).length === 0) return null;
  const out = build(evidence);
  return {
    command: out.command || null,
    record: out.record || null,
    empty: out.empty || null,
    rows: (out.rows || []).filter(Boolean),
    hosts: out.hosts || [],
    note: out.note || null,
  };
}
