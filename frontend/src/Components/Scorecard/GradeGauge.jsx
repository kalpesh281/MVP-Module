import { motion } from 'framer-motion';
import { gradeColor, GRADE_META } from '../../data/gradeMeta';
import { useCountUp } from '../../hooks/useCountUp';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { pointsToNextGrade } from '../../utils/simulate';
import { EASE } from '../../utils/motion';
import InfoTip from '../Extra/InfoTip';
import ScoreArc from './ScoreArc';

/**
 * The answer to the question they arrived with.
 *
 * A letter rather than a number, because the A–F scale is the unit every
 * rating provider converged on for one reason: a non-security stakeholder
 * can discuss a letter. A bare "56/100" reads as a failed exam and makes a
 * founder defensive before they have read a single finding.
 * docs/scoring-and-pricing.md section 2
 *
 * **This is the hero of the product and it is now sized like one.** It
 * previously rendered at the same visual weight as the three-figure strip
 * beneath it — a 48px letter in a 128px ring inside an ordinary card. The
 * one thing a reader came for looked like a component.
 *
 * The arc lives in ScoreArc, which can animate; this owns the framing, the
 * letter and the sentence beside it.
 */
export default function GradeGauge({ grade, score, availablePoints, suppressed, changed }) {
  const reduced = useReducedMotion();
  const shown = useCountUp(score ?? 0, { duration: 1100 });
  const gap = grade ? pointsToNextGrade(score) : null;
  const colour = gradeColor(grade);

  if (suppressed || !grade) {
    return (
      <div
        className="rounded-panel border border-line bg-surface p-7"
        style={{ boxShadow: 'var(--shadow-e1)' }}
      >
        <p className="font-display text-h3">No grade for this domain</p>
        <p className="mt-2 max-w-prose leading-relaxed text-ink-muted">
          Too many checks could not complete for a grade to be fair. Publishing a
          letter we cannot stand behind would be worse than publishing none — what
          we did confirm is below.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-panel border border-line bg-surface"
      style={{ boxShadow: 'var(--shadow-e2)' }}
    >
      {/* A whisper of the grade colour behind the arc. It is the only tint on
          the page, and it stops the hero reading as one more white card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: colour }}
      />

      <div className="relative flex flex-col items-center gap-8 p-7 sm:flex-row sm:items-center sm:gap-10 sm:p-9">
        <ScoreArc score={score ?? 0} colour={colour} grade={grade}>
          <motion.span
            key={grade}
            initial={reduced ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: reduced ? 0 : 0.25 }}
            className="font-display text-grade"
            style={{ color: colour }}
          >
            {grade}
          </motion.span>
          <span className="mt-1.5 text-caption font-medium tabular-nums text-ink-faint">
            {shown}
            <span className="text-ink-faint/60"> / 100</span>
          </span>
        </ScoreArc>

        <div className="min-w-0 text-center sm:text-left">
          <p className="font-display text-h2 text-balance">{GRADE_META[grade]?.summary}</p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-ink-muted sm:justify-start">
            {changed ? (
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-caption font-medium text-accent">
                Projected, with your fixes applied
              </span>
            ) : (
              <>
                <span>Scored over {availablePoints} measurable points</span>
                <InfoTip label="Why the score is out of a smaller number">
                  A check that could not complete has its points removed from the
                  total rather than scored as zero — we never grade a company well
                  because our own scanner failed. {100 - (availablePoints ?? 100)}{' '}
                  points were unmeasurable on this scan, so the score is out of{' '}
                  {availablePoints}.
                </InfoTip>
              </>
            )}
          </div>

          {gap ? (
            <p className="mt-2 text-sm text-ink-faint">
              <span className="tabular-nums font-medium text-ink-muted">{gap}</span>{' '}
              {gap === 1 ? 'point' : 'points'} from a{' '}
              <span className="font-medium text-ink-muted">
                {grade !== 'A' ? nextGrade(grade) : ''}
              </span>
              .
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
