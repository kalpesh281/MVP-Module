/**
 * The print design system.
 *
 * Deliberately not a copy of the screen's tokens. Paper is white, has no
 * hover state, no scroll and a hard edge at 297mm, and it is read at arm's
 * length rather than at 60cm — so the type is set larger relative to the
 * measure, the greys are darker to survive toner and photocopying, and the
 * warm canvas the site sits on is dropped entirely. Only the ink, the
 * grade ramp and the one accent carry over, because those are the brand.
 *
 * Everything is in millimetres except font sizes, which are points. The
 * document is A4, because this is an Indian market and Letter is not.
 */

/* --- page ------------------------------------------------------------- */
export const PAGE = {
  width: 210,
  height: 297,
  margin: 16,
  top: 14,
  bottom: 16,
};
PAGE.content = PAGE.width - PAGE.margin * 2; // 178mm measure

/* --- ink -------------------------------------------------------------- */
export const INK = {
  /* Body ink is darker than the screen's #14120f equivalent would need to
     be, because a laser printer's dot gain lightens small type. */
  ink: '#121110',
  muted: '#54504a',
  faint: '#6b665e',

  line: '#dcd8d2',
  lineStrong: '#b9b4ac',

  raised: '#f2f0ec',
  sunken: '#e9e6e0',

  deep: '#1a1815',
  onDeep: '#eae6de',
  onDeepMuted: '#9f988c',

  accent: '#2222e0',
  accentSoft: '#eeedfe',

  white: '#ffffff',
};

/** Matches scoring/grades.py through the screen's `--color-grade-*`. */
export const GRADE = {
  A: '#0f6e4f',
  B: '#456f26',
  C: '#8a5a00',
  D: '#a8511c',
  F: '#a8202b',
};
export const gradeInk = (grade) => GRADE[grade] || INK.faint;

/** Status colours for the finding chips. Never colour alone — every chip
 *  also carries its word, exactly as on screen. */
export const STATUS = {
  pass: { ink: '#0f6e4f', fill: '#e8f2ed', label: 'PASS' },
  warn: { ink: '#8a5a00', fill: '#f7efdf', label: 'ATTENTION' },
  fail: { ink: '#a8202b', fill: '#fbeaec', label: 'FAILED' },
  inconclusive: { ink: '#6b665e', fill: '#eceae6', label: 'NOT CHECKED' },
};
export const statusOf = (s) => STATUS[s] || STATUS.inconclusive;

/* --- type ------------------------------------------------------------- */
/**
 * Helvetica and Courier, which are two of the fourteen faces every PDF
 * reader is required to have. Embedding Inter would add ~300KB of base64
 * to the bundle for a document most readers will glance at once, and a
 * missing-glyph fallback in a document that is supposed to be evidence is
 * a worse failure than a slightly different H.
 *
 * Courier does real work here rather than being decoration: it is the
 * face every DNS record, hostname and cipher suite is set in, and the
 * switch is what separates what a machine observed from what we wrote
 * about it.
 */
export const TYPE = {
  eyebrow: { size: 6.4, weight: 'bold', spacing: 0.55 },
  micro: { size: 6.8, weight: 'normal' },
  caption: { size: 7.6, weight: 'normal' },
  body: { size: 8.6, weight: 'normal' },
  lead: { size: 9.8, weight: 'normal' },
  h4: { size: 9.2, weight: 'bold' },
  h3: { size: 11, weight: 'bold' },
  h2: { size: 14.5, weight: 'bold' },
  h1: { size: 21, weight: 'bold' },
  figure: { size: 26, weight: 'bold' },
  grade: { size: 42, weight: 'bold' },
};

/** Points to millimetres. */
export const pt = (points) => points * 0.352778;

/** The leading we set everything on. 1.38 is loose enough for 8.6pt text
 *  at a 178mm measure to stay trackable across the line. */
export const leading = (size, factor = 1.38) => pt(size) * factor;
