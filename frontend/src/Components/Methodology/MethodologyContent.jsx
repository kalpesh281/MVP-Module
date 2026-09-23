import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { ax } from '../../utils/config';
import { rupeeRange } from '../../utils/format';
import { fadeUp, stagger } from '../../utils/motion';
import RouteFallback from '../Extra/RouteFallback';
import ErrorNotice from '../Extra/ErrorNotice';
import InfoTip from '../Extra/InfoTip';

/**
 * The published methodology, without a page around it.
 *
 * Extracted so the `/methodology` route and the dialog opened from the
 * header render the same thing. Two copies of a page whose entire claim
 * is "this cannot drift from the code" would be the wrong place to keep
 * a second copy of anything.
 *
 * Every number is fetched from `/api/methodology`, which reads the same
 * constants that scored the company reading it. Nothing is transcribed.
 * docs/defending-the-score.md, docs/defending-the-premium.md
 */
export default function MethodologyContent({ onVersions }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    ax.get('/methodology')
      .then((res) => {
        if (!live) return;
        setData(res.data);
        onVersions?.(res.data);
      })
      .catch(() => live && setError('We could not load the methodology just now.'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorNotice message={error} />;
  if (!data) return <RouteFallback />;

  return (
    <motion.div
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      className="space-y-10"
    >
      {/* --- scoring ------------------------------------------------------ */}
      <motion.section variants={fadeUp} className="space-y-4">
        <div>
          <h2 className="font-display text-h3">
            The scoring rules
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Every domain starts at {data.total_points} and loses points for what we
            find. Absence of a problem is the normal state, so we deduct rather than
            reward. The weights are ours — judgment, published and versioned, not
            actuarial — and they follow what shows up in a claim file rather than
            what a security tool would rank highest.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {data.categories.map((category) => (
            <details key={category.id} className="group border-b border-line last:border-0">
              <summary
                className="flex cursor-pointer list-none items-baseline gap-3 px-5 py-4
                           transition-colors hover:bg-raised"
              >
                <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {category.points}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{category.label}</span>
                  {category.always_inconclusive && (
                    <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-xs text-ink-faint">
                      not scored at this tier
                    </span>
                  )}
                  <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                    {category.always_inconclusive || category.reason}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-ink-faint group-open:hidden">
                  {category.rules.length} rules
                </span>
              </summary>

              <ul className="space-y-1.5 border-t border-line bg-canvas px-5 py-4">
                {category.rules.map((rule) => (
                  <li key={rule.id} className="flex items-baseline gap-3 text-sm">
                    <span
                      className={`w-10 shrink-0 text-right tabular-nums ${
                        rule.deducts === 0 ? 'text-pass' : 'text-ink-muted'
                      }`}
                    >
                      {rule.deducts === 0 ? 'pass' : `−${rule.deducts}`}
                    </span>
                    <code className="font-mono text-xs text-ink-faint">{rule.id}</code>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          A check we cannot complete is marked inconclusive and its points leave the
          total rather than counting as zero — we never grade a company well because
          our own scanner failed. Above{' '}
          <strong className="font-medium text-ink">
            {data.suppress_above_inconclusive} points that failed to run
          </strong>{' '}
          we show no grade at all.
        </p>

        {/* The distinction has to be on this page, because this page is
            where the rule is published. Employee account exposure is
            inconclusive on every Tier 0 scan by design; counting it
            toward the limit left too little room for a real outage and
            blanked the grade of companies with nothing wrong. */}
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          "Failed to run" is doing real work in that sentence. A check that{' '}
          <em>cannot</em> run at this stage — employee account exposure needs a paid
          data source and proof you control the domain — is a known gap rather than
          an outage, so it does not count toward that limit. Its points still leave
          the total. Only checks that were meant to run and did not count against it.
        </p>
      </motion.section>

      {/* --- grades ------------------------------------------------------- */}
      <motion.section variants={fadeUp} className="space-y-4">
        <h2 className="font-display text-h3">The grade bands</h2>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {data.grades.map((band, index) => {
            const ceiling = index === 0 ? 100 : data.grades[index - 1].floor - 1;
            return (
              <div
                key={band.grade}
                className="flex items-baseline gap-4 border-b border-line px-5 py-3.5 last:border-0"
              >
                <span
                  className="w-6 shrink-0 text-lg font-semibold"
                  style={{ color: `var(--color-grade-${band.grade.toLowerCase()})` }}
                >
                  {band.grade}
                </span>
                <span className="w-20 shrink-0 text-sm tabular-nums text-ink-muted">
                  {band.floor}–{ceiling}
                </span>
                <span className="text-sm leading-relaxed text-ink-muted">
                  {band.summary}
                </span>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* --- pricing ------------------------------------------------------ */}
      <motion.section variants={fadeUp} className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-h3">
            The rate card
            <InfoTip label="What these rates are and are not">
              These are directional estimates of the Indian cyber market, sanity
              checked against published broker ranges. They are{' '}
              <strong className="font-medium text-ink">not insurer-validated</strong>,
              and nothing here is a quote. When we have a partner insurer we replace
              the table and bump the rate card version, and every past scan reprices.
            </InfoTip>
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
            Two inputs only — {data.pricing.inputs.join(' and ')} — pick one row. The
            cover amount follows the band. We hold{' '}
            {data.pricing.not_used.join(', ')} and deliberately do not price on any of
            them: each is inferred from a website, and a number you can trace beats a
            number that merely looks precise.
          </p>
        </div>

        {/* The figures are printed in full — ₹1,20,000, not ₹1.2L —
            because this page's whole claim is that you can check them, and
            a rounded rate card is not a checkable one. That costs width,
            which `overflow-x-auto` absorbs by scrolling the table.

            It used to buy that width with `lg:-mx-20 xl:-mx-32`, breaking
            out of the reading column. On a 1440 screen that carried the
            table past the blueprint rails and out to the window edge,
            aligned with nothing on the page — it read as a layout fault
            rather than as emphasis. A table that ignores the grid the rest
            of the page is built on does not look wider, it looks broken. */}
        <div className="-mx-4 overflow-x-auto rounded-xl border border-line bg-surface sm:mx-0">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-3 font-medium">Revenue band</th>
                <th className="px-3 py-3 font-medium">Cover</th>
                {priced(data.grades).map((band) => (
                  <th key={band.grade} className="px-3 py-3 font-medium">
                    {band.grade}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.pricing.bands.map((band) => (
                <tr key={band.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{band.label}</td>
                  <td className="px-3 py-3 tabular-nums text-ink-muted">
                    {band.cover_label}
                  </td>
                  {priced(data.grades).map((grade) => (
                    <td
                      key={grade.grade}
                      className="whitespace-nowrap px-3 py-3 tabular-nums text-ink-muted"
                    >
                      {rupeeRange(band.by_grade[grade.grade])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* F has no column because it has no price. Four cells reading
            "referred" would be a column of nothing; the reason is worth a
            sentence instead. */}
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          Grade F is not priced. It is referred to an underwriter — showing a
          number for a company most insurers would decline would be the one
          outright dishonest figure in the product.
        </p>
      </motion.section>

    </motion.div>
  );
}

/** Every grade that has a price. F never does. */
function priced(grades) {
  return grades.filter((band) => band.grade !== 'F');
}
