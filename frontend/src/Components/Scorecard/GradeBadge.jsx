import { gradeColor, GRADE_META } from '../../data/gradeMeta';
import { useCountUp } from '../../hooks/useCountUp';
import { pointsToNextGrade } from '../../utils/simulate';

/** The grade leads; the number is secondary.
 *
 *  A bare "56/100" reads as a failed exam and makes a founder defensive
 *  before they have read a single finding. A letter invites the question
 *  "what moves it?", which is the entire product.
 *  docs/scoring-and-pricing.md section 2 */
export default function GradeBadge({ grade, score, availablePoints, suppressed }) {
  const shown = useCountUp(score ?? 0);
  const gap = grade ? pointsToNextGrade(score) : null;

  if (suppressed || !grade) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="font-display text-h3">No grade for this domain</p>
        <p className="mt-1 text-sm text-ink-muted">
          Too many checks could not complete for a grade to be fair. What we did
          confirm is below.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5 rounded-xl border border-line bg-surface p-5">
      <div
        className="flex size-20 shrink-0 items-center justify-center rounded-xl text-4xl font-semibold text-white"
        style={{ backgroundColor: gradeColor(grade) }}
      >
        <span aria-hidden="true">{grade}</span>
        <span className="sr-only">Grade {grade}</span>
      </div>

      <div className="min-w-0">
        <p className="text-ink">{GRADE_META[grade]?.summary}</p>
        <p className="mt-1 text-sm text-ink-faint">
          <span className="tabular-nums">{shown}</span> out of 100
          {availablePoints && availablePoints < 100 && (
            <> · scored over {availablePoints} points we could measure</>
          )}
          {gap ? <> · {gap} {gap === 1 ? 'point' : 'points'} from the next grade</> : null}
        </p>
      </div>
    </div>
  );
}
