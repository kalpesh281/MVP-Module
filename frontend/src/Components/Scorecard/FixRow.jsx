import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { expand } from '../../utils/motion';
import { fixToggled, selectSelectedIds } from '../../Features/simulatorSlice';
import { rupees } from '../../utils/format';

/** One fix, with its own arithmetic already attached.
 *
 *  `score_delta`, `grade_if_fixed` and `premium_if_fixed` were computed by
 *  the backend by rescoring with this fix's rules removed. Nothing here
 *  recalculates them — ticking the box only records that it is ticked.
 *  docs/scoring-and-pricing.md section 5 */
export default function FixRow({ fix }) {
  const dispatch = useDispatch();
  const selected = useSelector(selectSelectedIds).includes(fix.id);
  const [open, setOpen] = useState(false);
  const inputId = `fix-${fix.id}`;
  const detailsId = `fix-${fix.id}-details`;

  return (
    // The anchor the claim scenario scrolls to. Deliberately not
    // `fix-${id}` — that is already the checkbox's own id, and two
    // elements sharing it silently breaks the label-to-input association
    // that makes the whole row clickable.
    <li
      id={`fix-row-${fix.id}`}
      className="scroll-mt-24 border-b border-line transition-colors last:border-b-0 hover:bg-raised/40"
    >
      <div className="flex items-start gap-3 p-4">
        <input
          id={inputId}
          type="checkbox"
          checked={selected}
          onChange={() => dispatch(fixToggled(fix.id))}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--color-accent)]"
        />

        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="cursor-pointer font-medium">
            {fix.title}
          </label>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">+{fix.score_delta}</span>{' '}
              {fix.score_delta === 1 ? 'point' : 'points'}
              {fix.grade_if_fixed && <> → grade {fix.grade_if_fixed}</>}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {fix.effort}
            </span>
            {fix.annual_saving > 0 && (
              <span className="font-medium text-pass">
                saves about {rupees(fix.annual_saving)}/year
              </span>
            )}
          </div>

          {fix.why_it_matters && (
            <p className="mt-2 text-sm text-ink-muted">{fix.why_it_matters}</p>
          )}

          {fix.notes?.length > 0 && (
            <p className="mt-2 font-mono text-xs text-ink-faint">
              {fix.notes.join(', ')}
            </p>
          )}

          {fix.how_to_fix && (
            <>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls={detailsId}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent"
              >
                How to fix it
                <ChevronDown
                  className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={detailsId}
                    variants={expand}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <p className="mt-2 rounded-lg border border-line bg-raised p-3.5 text-sm leading-relaxed text-ink-muted">
                      {fix.how_to_fix}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
