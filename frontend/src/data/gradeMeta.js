/** Presentation only. The grade itself is always the backend's.
 *
 * `summary` mirrors scoring/grades.py GRADE_SUMMARY so the page reads the
 * same when the AI layer is offline and the headline is static. */
export const GRADE_META = {
  A: { color: 'var(--color-grade-a)', summary: 'Strong. Nothing an insurer can see from outside stands out as a problem.' },
  B: { color: 'var(--color-grade-b)', summary: 'Good, with a few gaps worth closing before you apply.' },
  C: { color: 'var(--color-grade-c)', summary: 'Workable, but an underwriter will ask about several of these.' },
  D: { color: 'var(--color-grade-d)', summary: 'Weak. Expect a higher premium or additional conditions.' },
  F: { color: 'var(--color-grade-f)', summary: 'Serious gaps. Most insurers would want these fixed before quoting.' },
};

export function gradeColor(grade) {
  return GRADE_META[grade]?.color ?? 'var(--color-grade-none)';
}

/** Display order for the check feed. The server streams results as they
 *  land — DNS in milliseconds, certificate transparency in seconds — so
 *  the client seeds the list with these and fills each row in place.
 *  Rendering in completion order makes the list jump. */
export const CHECK_ORDER = ['spf', 'dkim', 'dmarc', 'tls', 'headers', 'creds', 'subdomains'];

export const CHECK_LABELS = {
  spf: 'SPF record',
  dkim: 'DKIM signing',
  dmarc: 'DMARC policy',
  tls: 'Certificate',
  headers: 'Security headers',
  creds: 'Breach history',
  subdomains: 'Public subdomains',
};

/** What each check is for, in one line a founder understands. Shown under
 *  the row while it is still pending, so the waiting time teaches
 *  something instead of being dead air. docs/education-layer.md */
export const CHECK_BLURBS = {
  spf: 'Which servers are allowed to send email as you',
  dkim: 'Whether your outgoing mail is signed',
  dmarc: 'What happens to email that fakes your domain',
  tls: 'Whether your certificate is valid and current',
  headers: 'The protections your site tells browsers to apply',
  creds: 'Whether a breach of your company is on public record',
  subdomains: 'What else of yours is reachable from the internet',
};

/** The long form of each check, shown on the info icon beside the row.
 *
 * Three things, in this order, because it is the order a founder asks
 * them in: what was actually looked at, why an underwriter cares, and
 * what it is worth. The points are the rubric's — scoring/rubric.py
 * CHECK_POINTS — and duplicating them here is deliberate: a number on
 * screen that nobody can trace back to a rule is the thing that makes a
 * score feel arbitrary. If the rubric changes, these change with it.
 *
 * `points` is what the check can deduct at most, not what it did. */
export const CHECK_DETAIL = {
  spf: {
    points: 7,
    what: 'We read the SPF record your domain publishes in DNS — the list of servers allowed to send email as you.',
    why: 'Without it, anyone can send mail that appears to come from your domain. Invoice fraud against your customers starts here, and that is a third-party liability claim.',
  },
  dkim: {
    points: 5,
    what: 'We look for a DKIM public key on the selectors mail providers commonly use, which is what lets a recipient verify your mail was not altered in transit.',
    why: 'DKIM is what gives DMARC something to check against. On its own it proves a message is genuinely yours.',
  },
  dmarc: {
    points: 18,
    what: 'We read your DMARC record and, more importantly, its policy: none, quarantine, or reject.',
    why: 'This is the single heaviest email check because it is the one that decides what actually happens to a forged message. A policy of none publishes a rule and enforces nothing.',
  },
  tls: {
    points: 15,
    what: 'We complete a normal HTTPS connection and read the certificate your server presents — issuer, validity dates, and whether it matches the hostname.',
    why: 'An expired or mismatched certificate is visible to every customer and is the kind of lapse an underwriter reads as a sign of how the rest is run.',
  },
  headers: {
    points: 12,
    what: 'We read the response headers your site returns — HSTS, Content-Security-Policy, X-Content-Type-Options, X-Frame-Options and Referrer-Policy.',
    why: 'These are the protections you ask the browser to enforce for your users. Most are one line of config, which is why missing ones stand out.',
  },
  creds: {
    points: 8,
    what: 'We check public breach databases for a disclosed breach of your company. This is the free half: confirming exposure of individual employee accounts needs you to verify the domain first.',
    why: 'Prior breach history is a standard proposal-form question. Answering it wrongly, even by accident, is a material misstatement.',
  },
  subdomains: {
    points: 23,
    what: 'We read public certificate transparency logs for hostnames issued under your domain, then check which still resolve and respond.',
    why: 'It carries the most points because it is the check companies are most often surprised by — a forgotten staging box or an old admin panel is how a great many incidents actually start.',
  },
};
