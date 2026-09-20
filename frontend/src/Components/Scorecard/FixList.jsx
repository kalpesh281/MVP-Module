import { useDispatch, useSelector } from 'react-redux';
import { PartyPopper } from 'lucide-react';
import {
  allFixesSelected,
  selectSelectedIds,
  simulatorCleared,
} from '../../Features/simulatorSlice';
import FixRow from './FixRow';
import { describeEffort } from '../../utils/simulate';

export default function FixList({ fixes, simulated }) {
  const dispatch = useDispatch();
  const selected = useSelector(selectSelectedIds);
  const allSelected = fixes.length > 0 && selected.length === fixes.length;

  // A clean domain must render a real state, not an empty box. Gate 1 §1.5
  if (!fixes.length) {
    return (
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-pass" aria-hidden="true" />
          <div>
            <h2 className="font-medium">Nothing to fix</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Every check we can run from outside your network came back clean.
              That is genuinely uncommon.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="fixes-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="fixes-heading" className="text-lg font-medium">
          What to fix, best value first
        </h2>
        <button
          type="button"
          onClick={() =>
            dispatch(
              allSelected ? simulatorCleared() : allFixesSelected(fixes.map((f) => f.id)),
            )
          }
          className="text-sm font-medium text-accent"
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <p className="mt-1 text-sm text-ink-muted">
        Tick anything to see what it does to your grade and your premium. Nothing
        is sent anywhere.
      </p>

      <ul className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        {fixes.map((fix) => (
          <FixRow key={fix.id} fix={fix} />
        ))}
      </ul>

      {simulated.selected > 0 && (
        <p className="mt-3 text-sm text-ink-muted" aria-live="polite">
          {simulated.selected} of {fixes.length} selected ·{' '}
          {describeEffort(simulated.effortHours)} of work
        </p>
      )}
    </section>
  );
}
