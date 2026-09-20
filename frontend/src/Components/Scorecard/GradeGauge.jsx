import { motion, useReducedMotion } from 'framer-motion';
import { gradeColor, GRADE_META } from '../../data/gradeMeta';
import { useCountUp } from '../../hooks/useCountUp';
import { pointsToNextGrade } from '../../utils/simulate';
import InfoTip from '../Extra/InfoTip';

/**
 * The answer to the question they arrived with.
 *
 * A ring rather than a bar, and a letter rather than a number, because
 * the A–F scale is the unit every rating provider converged on for one
 * reason: a non-security stakeholder can discuss a letter. A bare "56/100"
 * reads as a failed exam and makes a founder defensive before they have
 * read a single finding. docs/scoring-and-pricing.md section 2
 *
 * The ring is a conic-gradient driven by the theme tokens, so the grade
 * colour flows from one source. It sweeps on mount, and re-sweeps when a
 * simulated fix moves the score — that movement is the product's whole
 * argument, so it is the one animation allowed to be noticeable.
 */
export default function GradeGauge({ grade, score, availablePoints, suppressed, changed }) {
  const reduced = useReducedMotion();
  const shown = useCountUp(score ?? 0);
  const gap = grade ? pointsToNextGrade(score) : null;
  const colour = gradeColor(grade);
  const degrees = ((score ?? 0) / 100) * 360;

  if (suppressed || !grade) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-lg font-medium">No grade for this domain</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          Too many checks could not complete for a grade to be fair. Publishing a
          letter we cannot stand behind would be worse than publishing none — what
          we did confirm is below.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-line bg-surface p-6"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative size-32 shrink-0">
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={reduced ? false : { rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: `conic-gradient(${colour} ${degrees}deg, var(--color-line) ${degrees}deg)`,
              transition: 'background 600ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
          <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-surface">
            <motion.span
              key={grade}
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl font-semibold leading-none"
              style={{ color: colour }}
            >
              {grade}
            </motion.span>
            <span className="mt-1 text-xs tabular-nums text-ink-faint">
              {shown}/100
            </span>
          </div>
          <span className="sr-only">
            Grade {grade}, {score} out of 100
          </span>
        </div>

        <div className="min-w-0 text-center sm:text-left">
          <p className="text-lg leading-snug text-ink">{GRADE_META[grade]?.summary}</p>

          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-ink-faint sm:justify-start">
            {changed ? (
              <span className="font-medium text-accent">Projected, with your fixes applied</span>
            ) : (
              <>
                Scored over {availablePoints} measurable points
                <InfoTip label="Why the score is out of a smaller number">
                  A check that could not complete has its points removed from the
                  total rather than scored as zero — we never grade a company well
                  because our own scanner failed. {100 - (availablePoints ?? 100)}{' '}
                  points were unmeasurable on this scan, so the score is out of{' '}
                  {availablePoints}.
                </InfoTip>
              </>
            )}
          </p>

          {gap ? (
            <p className="mt-1 text-sm text-ink-muted">
              {gap} {gap === 1 ? 'point' : 'points'} from a{' '}
              {gap && grade !== 'A' ? nextGrade(grade) : ''}.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function nextGrade(grade) {
  const order = ['F', 'D', 'C', 'B', 'A'];
  const index = order.indexOf(grade);
  return index >= 0 && index < order.length - 1 ? order[index + 1] : '';
}
