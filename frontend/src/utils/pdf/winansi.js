/**
 * Make a string safe for a standard PDF font.
 *
 * **The bug this exists to prevent.** Helvetica, Courier and Times — the
 * faces every PDF reader is required to have, and the ones this document
 * is set in — are WinAnsi-encoded. WinAnsi is Latin-1 plus 27 extras in
 * 0x80–0x9F. Anything outside that is not "rendered badly": jsPDF falls
 * out of its fast path for the whole run, and readers disagree about what
 * to do with the result. Chrome's viewer sets the entire line at a
 * per-character advance, which is how a one-line company description
 * became a tracked-out line running off the right edge of page 1.
 *
 * Two characters caused it, and both arrive from outside this codebase:
 * the AI profile writer returns U+2011 NON-BREAKING HYPHEN, so
 * "cyber‑security protection" broke the line it sat on, and the scoring
 * layer returns U+2212 MINUS SIGN, which turned "−15 of 18 pts" into a
 * tracked-out '"15 of 18 pts' that collided with the status chip beside
 * it. Neither raised an error anywhere.
 *
 * So every string is routed through here on its way to jsPDF — see
 * `Doc.text`, `Doc.line`, `Doc.dataRow`, `Doc.table` and the direct draws
 * in `report.js`. The boundary is the only place this can be done once:
 * the text arrives from a language model, from a scanner, from a policy
 * catalogue and from this codebase, and any of those can grow a new
 * character tomorrow.
 *
 * Substitutions are semantic, never decorative. A minus becomes a hyphen
 * because a hyphen means the same thing at this size; an arrow becomes
 * '->' because that is what an arrow says. Characters with no honest
 * ASCII reading are dropped rather than replaced with '?', because a
 * question mark in the middle of an evidence line reads as a defect in
 * the evidence rather than a limit of the typeface.
 */

/** The 27 code points WinAnsi carries above Latin-1. */
const WIN_ANSI_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/** Deliberate readings for characters this product actually produces. */
const SUBSTITUTIONS = new Map([
  [0x20b9, 'INR '], // the rupee sign — the reason money.js exists
  [0x2011, '-'],    // non-breaking hyphen, from the AI profile writer
  [0x2212, '-'],    // minus sign, from the scoring layer
  [0x2010, '-'],    // hyphen
  [0x2015, '-'],    // horizontal bar
  [0x2043, '-'],    // hyphen bullet
  [0x00a0, ' '],    // no-break space
  [0x2007, ' '],    // figure space
  [0x2009, ' '],    // thin space
  [0x200a, ' '],    // hair space
  [0x202f, ' '],    // narrow no-break space
  [0x200b, ''],     // zero-width space
  [0x200c, ''],
  [0x200d, ''],
  [0xfeff, ''],
  [0x2192, ' -> '],
  [0x2190, ' <- '],
  [0x2265, '>='],
  [0x2264, '<='],
  [0x2260, '!='],
  [0x2032, "'"],
  [0x2033, '"'],
  [0x2044, '/'],
]);

export default function winAnsi(input) {
  const text = String(input ?? '');

  /* Fast path: almost every string in this document is already plain.
     Tested by code point rather than by a character class — a class
     spanning U+0000 puts a literal control character in this file. */
  let needsWork = false;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 0xff) {
      needsWork = true;
      break;
    }
  }
  if (!needsWork) return text;

  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code <= 0xff || WIN_ANSI_EXTRAS.has(code)) {
      out += char;
      continue;
    }

    const replacement = SUBSTITUTIONS.get(code);
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }

    /* A combining mark is dropped rather than left to attach itself to
       whatever character happens to follow it into the output. */
    if (code >= 0x0300 && code <= 0x036f) continue;

    /* Last resort: decompose and keep what encodes. An accented letter
       written as base + combining mark survives as the base letter, which
       is a worse rendering of a name but a readable one. */
    for (const part of char.normalize('NFKD')) {
      if (part.codePointAt(0) <= 0xff) out += part;
    }
  }
  return out;
}
