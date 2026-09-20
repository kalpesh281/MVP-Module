/**
 * The fix simulator. Pure functions, no network, no backend.
 *
 * This is the moment the product works. A founder ticks "DMARC", watches
 * C become B and ₹85,000 become ₹60,000, and understands in one second
 * something a brochure could not explain in a page.
 *
 * Gate 1 §1.5 requires the Network tab to show **zero requests** while
 * ticking. That is why every number this needs is already in the `result`
 * payload: each fix carries its own `score_delta`, and `premium_table`
 * carries every grade's premium for this company's band and limit.
 * docs/frontend.md simulate.js
 *
 * The one rule: **this file never computes a premium.** It looks one up.
 * Pricing is the backend's, and duplicating that arithmetic here is how
 * the two quietly drift apart and the page starts disagreeing with the
 * PDF. docs/scoring-and-pricing.md principle
 */

// Must match scoring/grades.py. Duplicated deliberately and kept small:
// the alternative is a network call per tick, which is the one thing the
// gate forbids.
const BANDS = [
  ['A', 85],
  ['B', 70],
  ['C', 55],
  ['D', 40],
  ['F', 0],
];

export const GRADES = BANDS.map(([grade]) => grade);

export function gradeFor(score) {
  const found = BANDS.find(([, floor]) => score >= floor);
  return found ? found[0] : 'F';
}

export function pointsToNextGrade(score) {
  const current = gradeFor(score);
  if (current === 'A') return null;
  const index = GRADES.indexOf(current);
  return BANDS[index - 1][1] - score;
}

/**
 * Apply a set of ticked fixes to a scan result.
 *
 * Deltas are summed, not re-derived. The backend computed each one by
 * rescoring with that fix's rules removed, which already accounts for
 * category caps and the inconclusive rescale — arithmetic this file
 * cannot reproduce and should not try to.
 *
 * Summing them is an approximation when two fixes share a capped
 * category, and the backend's `combined_if_all_fixed` is the exact answer
 * for the all-ticked case. So: use the exact number when everything is
 * ticked, and the sum in between.
 */
export function simulate(result, selectedIds, limit = null) {
  const option = optionFor(result, limit);
  const base = {
    score: result.score ?? 0,
    grade: result.grade ?? null,
    // At the recommended limit this is the headline premium. At any other
    // rung it is that rung's price for the grade they have now, so the
    // saving below compares like with like.
    premium: option
      ? lookup(option.by_grade, result.grade) ?? result.premium ?? null
      : result.premium ?? null,
    limit: option?.limit ?? result.premium?.limit ?? null,
    saving: 0,
    selected: 0,
    effortHours: 0,
  };

  const fixes = result.fixes || [];
  if (!fixes.length || !selectedIds?.size) return base;

  const chosen = fixes.filter((fix) => selectedIds.has(fix.id));
  if (!chosen.length) return base;

  const everything = chosen.length === fixes.length;
  const combined = result.combined_if_all_fixed;

  let score;
  if (everything && combined?.score != null) {
    score = combined.score;
  } else {
    score = base.score + chosen.reduce((total, fix) => total + (fix.score_delta || 0), 0);
  }

  // A score above 100 or a grade better than A is not possible and would
  // be visible nonsense on screen. Gate 1 §1.5 checks for exactly this.
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeFor(score);

  const premium = premiumForGrade(result, grade, limit);
  return {
    score,
    grade,
    premium,
    limit: base.limit,
    saving: savingBetween(base.premium, premium),
    selected: chosen.length,
    effortHours: chosen.reduce((total, fix) => total + effortHours(fix.effort), 0),
  };
}

/**
 * The cover option the reader has selected, or the recommended one.
 *
 * Returns undefined when Stage 2's coverage block is absent — a cached
 * scan stored before it shipped, for instance — and every caller falls
 * back to `premium_table`, which has been in the payload since Stage 1.
 */
export function optionFor(result, limit = null) {
  const options = result.coverage?.options;
  if (!options?.length) return undefined;
  if (limit == null) return options.find((o) => o.recommended) ?? options[0];
  return options.find((o) => o.limit === limit) ?? options.find((o) => o.recommended);
}

function lookup(table, grade) {
  if (!table || !grade) return null;
  const row = table[grade];
  // F is null on purpose: referred to a human, not priced.
  if (!row) return { low: null, high: null, referred: true };
  return { ...row, referred: false };
}

/** Look up — never compute. `premium_table` ships in the result payload. */
export function premiumForGrade(result, grade, limit = null) {
  const option = optionFor(result, limit);
  if (option) return lookup(option.by_grade, grade) ?? result.premium ?? null;
  const table = result.premium_table?.by_grade;
  if (!table || !grade) return result.premium ?? null;
  const row = table[grade];
  // F is null in the table on purpose: it is referred to a human, not
  // priced. Showing a number there would be the one dishonest thing on
  // the page.
  if (!row) return { low: null, high: null, referred: true };
  return { ...row, referred: false };
}

export function midpoint(premium) {
  if (!premium || premium.low == null || premium.high == null) return 0;
  return Math.floor((premium.low + premium.high) / 2);
}

export function savingBetween(current, improved) {
  if (!current || !improved || current.referred || improved.referred) return 0;
  return Math.max(0, midpoint(current) - midpoint(improved));
}

const EFFORT_HOURS = {
  '15 min': 0.25,
  '30 min': 0.5,
  '1 hr': 1,
  '2 hrs': 2,
  '1 day': 8,
  '1 week': 40,
};

export function effortHours(effort) {
  return EFFORT_HOURS[effort] ?? 0;
}

export function describeEffort(hours) {
  if (!hours) return '';
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 2) return 'about an hour';
  if (hours < 8) return `${hours % 1 ? hours.toFixed(1) : hours} hours`;

  // Round first, then pluralise against the rounded value. Doing it the
  // other way round produced "about 1 days" for anything between one and
  // one and a half working days, which is most single-day fixes.
  const days = Math.round(hours / 8);
  return days === 1 ? 'about a day' : `about ${days} days`;
}
