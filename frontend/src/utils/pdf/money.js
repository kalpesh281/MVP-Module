/**
 * Money and dates, for print.
 *
 * **Why not `utils/format.js`.** That module prints `₹`. The rupee sign is
 * U+20B9, and the fourteen faces a PDF reader is required to have are
 * WinAnsi-encoded — which predates the sign by fifteen years and does not
 * contain it. Setting `₹` in Helvetica produces a blank or a substituted
 * glyph in Preview, Acrobat and Chrome's viewer alike, and a premium
 * figure that renders as `?1,30,000` in front of a client is worse than no
 * PDF at all.
 *
 * So the document says `INR`. That is not a workaround dressed up as a
 * decision: ISO 4217 codes are what schedules of cover, broker slips and
 * quote sheets actually use, and this document is meant to sit in that
 * pile. Embedding a font carrying ₹ would cost ~300KB of base64 in the
 * bundle to say the same thing less formally.
 *
 * The digit grouping stays Indian — 1,30,000, never 130,000. Getting that
 * wrong in front of an Indian founder is a small thing that reads as a
 * large one.
 */

const GROUP = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** `INR 1,30,000`. */
export function inr(amount) {
  if (amount == null) return '—';
  return `INR ${GROUP.format(Math.round(amount))}`;
}

/** `1,30,000` — for table cells that sit under an INR column head. */
export function plain(amount) {
  if (amount == null) return '—';
  return GROUP.format(Math.round(amount));
}

/** `INR 1,30,000 – 1,80,000`. The unit is not repeated: a range is one
 *  figure with two ends, and printing INR twice reads as two prices. */
export function inrRange(range) {
  if (!range || range.referred || range.low == null) return 'Referred to an underwriter';
  if (range.low === range.high) return inr(range.low);
  return `${inr(range.low)} – ${GROUP.format(Math.round(range.high))}`;
}

/** Lakhs and crores, for the claim-cost table. Mirrors `rupeesCompact`. */
function compactParts(amount) {
  if (amount == null) return [null, ''];
  if (amount >= 10000000) {
    const crore = amount / 10000000;
    return [Number.isInteger(crore) ? crore : Number(crore.toFixed(1)), 'Cr'];
  }
  return [Math.round(amount / 100000), 'L'];
}

export function inrCompact(amount) {
  const [value, unit] = compactParts(amount);
  return value == null ? '—' : `INR ${value} ${unit}`;
}

export function inrRangeCompact(range) {
  if (!range || range.low == null || range.high == null) return '—';
  const [low, lowUnit] = compactParts(range.low);
  const [high, highUnit] = compactParts(range.high);
  if (lowUnit === highUnit) return `INR ${low} – ${high} ${lowUnit}`;
  return `INR ${low} ${lowUnit} – ${high} ${highUnit}`;
}

/** A label like `₹5 Cr` that came from the backend, de-rupeed for print. */
export const deRupee = (label) => String(label ?? '').replace(/₹\s?/g, 'INR ');

/** `23 September 2026, 13:04 IST`. Asia/Kolkata explicitly: a report
 *  timestamped in the reader's own zone cannot be compared with a
 *  colleague's copy of the same report. */
export function stamp(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(date);
  return `${parts} IST`;
}

/** `2026-09-23` for the filename. */
export function fileStamp(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return 'undated';
  return date.toISOString().slice(0, 10);
}

/**
 * The document's own reference, derived from the scan id.
 *
 * Deterministic, not random: two people holding two printouts of the same
 * scan must be able to establish that they are holding the same document,
 * and a reference that changed on every download could not do that.
 */
export function reference(scanId, iso) {
  const year = (iso ? new Date(iso) : new Date()).getFullYear();
  const tail = String(scanId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase()
    .padStart(6, '0');
  return `BDY-RA-${year}-${tail}`;
}
