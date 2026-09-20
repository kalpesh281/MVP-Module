import { motion } from 'framer-motion';
import { gradeColor } from '../../data/gradeMeta';
import { rupeeRange } from '../../utils/format';
import { EASE } from '../../utils/motion';

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
 */
export default function ResultRail({ grade, score, premium, changed, suppressed }) {
  if (suppressed || !grade) return null;

  const colour = gradeColor(grade);

  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line
                 bg-surface px-4 py-3"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <span className="flex items-center gap-2.5">
        <motion.span
          key={grade}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="flex size-8 items-center justify-center rounded-lg text-base font-semibold"
          style={{ backgroundColor: `${colour}1a`, color: colour }}
        >
          {grade}
        </motion.span>
        <span className="text-sm tabular-nums text-ink-muted">{score}/100</span>
      </span>

      <span className="h-5 w-px bg-line" aria-hidden="true" />

      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="text-sm text-ink-faint">Estimated premium</span>
        <motion.span
          key={`${premium?.low}-${premium?.high}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="text-sm font-medium tabular-nums"
        >
          {rupeeRange(premium)}
        </motion.span>
      </span>

      {changed && (
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
          Projected
        </span>
      )}
    </div>
  );
}
