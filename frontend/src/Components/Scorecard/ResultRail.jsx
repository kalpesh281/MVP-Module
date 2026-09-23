import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { gradeColor } from '../../data/gradeMeta';
import { rupeeRange, timeAgo } from '../../utils/format';
import { EASE } from '../../utils/motion';
import InfoTip from '../Extra/InfoTip';

/**
 * Grade and premium, kept on screen on every step.
 *
 * This exists because paging the report threatened the one moment the
 * product works: a founder ticks a fix and watches C become B and the
 * premium fall. Put the fixes on their own page and that payoff happens
 * somewhere the reader cannot see, which would trade the insight for
 * tidiness.
 *
 * So the two numbers travel with the reader. Ticking a fix on the last
 * step still moves them, in view, with no request in flight.
 *
 * **The cached-result notice lives here too**, at the far end. It used to
 * be its own full-width bar directly above this one, and two stacked bars
 * each carrying one short sentence spent most of the first screen on
 * furniture. It is folded in rather than dropped: "a cached result is
 * never presented as live" is a rule the product is built on
 * (docs/database.md section 5), and with nothing stating the age a
 * six-hour-old scan would quietly read as a fresh one.
 *
 * The PDF download is deliberately NOT here — see `DownloadReport`. Every
 * control on this bar changes one of the two figures on it, and a button
 * that does not belongs somewhere those figures are not moving.
 */
export default function ResultRail({
  grade,
  score,
  premium,
  changed,
  suppressed,
  cached,
  cacheAgeSeconds,
  onRefresh,
}) {
  if (suppressed || !grade) return null;

  const colour = gradeColor(grade);

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-line
                 bg-surface px-5 py-3.5"
      style={{ boxShadow: 'var(--shadow-e1)' }}
    >
      <span className="flex items-center gap-2.5">
        <motion.span
          key={grade}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="flex size-10 items-center justify-center rounded-card font-display text-h3"
          style={{ backgroundColor: `${colour}14`, color: colour }}
        >
          {grade}
        </motion.span>
        <span className="tabular-nums font-medium text-ink-muted">
          {score}
          <span className="text-ink-faint"> / 100</span>
        </span>
      </span>

      {/* Hidden once the row wraps — a divider with nothing to its right is
          just a tick mark. */}
      <span className="hidden h-7 w-px bg-line sm:block" aria-hidden="true" />

      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        {/* An eyebrow, not a sentence. The label's job is to name the figure
            and then get out of its way. */}
        <span className="text-eyebrow uppercase text-ink-faint">Estimated premium</span>
        <motion.span
          key={`${premium?.low}-${premium?.high}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="font-display text-h3 tabular-nums"
        >
          {rupeeRange(premium)}
        </motion.span>
      </span>

      {changed && (
        <span className="rounded-full border border-accent-line bg-accent-soft px-2.5 py-1 text-eyebrow uppercase text-accent">
          Projected
        </span>
      )}

      {/* Far end, so the two figures keep the left. */}
      {cached && (
        <span className="ml-auto flex items-center gap-2.5 text-caption text-ink-faint">
          <span className="hidden sm:inline">Checked {timeAgo(cacheAgeSeconds)}</span>
          <InfoTip label="Why you are seeing an earlier result" align="right">
            <span className="block">
              This is an earlier scan replayed, not a fresh one. A domain
              checked again within six hours returns what we already found
              rather than re-running seven public lookups against it.
            </span>
            <span className="mt-2 block">
              That window keeps us from hammering other people&apos;s DNS and
              certificate logs, and it is why the age is printed rather than
              hidden. Nothing here is ever shown as live when it is not.
            </span>
            <span className="mt-2 block">
              <strong className="font-medium text-ink">Check again</strong> runs
              a real scan now and replaces this.
            </span>
          </InfoTip>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Check again"
              title="Check again"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-line
                         px-2.5 py-1 font-medium text-accent transition-colors
                         hover:border-accent/40 hover:bg-accent-soft"
            >
              <RefreshCw
                className="size-3.5 transition-transform duration-500 group-hover:-rotate-180"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Check again</span>
            </button>
          )}
        </span>
      )}
    </div>
  );
}
