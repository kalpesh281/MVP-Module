/** Indian digit grouping: 1,20,000 — not 120,000.
 *
 * Getting this wrong in front of an Indian founder is a small thing that
 * reads as a large one: it says the product was built for somewhere else.
 * `en-IN` does the grouping correctly in every browser we care about. */
const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function rupees(amount) {
  if (amount == null) return '—';
  return INR.format(amount);
}

export function rupeeRange(premium) {
  if (!premium || premium.referred || premium.low == null) {
    return 'Referred to an underwriter';
  }
  return `${rupees(premium.low)} – ${rupees(premium.high)}`;
}

/** "3 hours ago" for a cached scan. A cached result must always be
 *  labelled with its age — presenting stale findings as live would be the
 *  one dishonest thing on the page. docs/database.md section 5 */
export function timeAgo(seconds) {
  if (seconds == null) return '';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Strip anything a user might paste around a domain, so the field accepts
 *  "https://www.acme.com/pricing" and an email address. The backend
 *  normalises authoritatively; this is only so the field feels forgiving. */
export function tidyDomain(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]
    .split('@')
    .pop();
}
