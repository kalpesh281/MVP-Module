import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { EASE } from '../../utils/motion';

/**
 * The step indicator.
 *
 * A report that answers "how bad is it?", "what does cover cost?" and
 * "what do I do?" was a single column two and a half screens long, and the
 * premium — the thing a founder came for — sat below the fold behind a
 * scroll nobody was promised. Paging it means each question gets a screen
 * and the reader always knows how many are left.
 *
 * Every step stays reachable at all times. This is a report, not a wizard:
 * gating step 3 behind step 2 would be pure ceremony, and someone who
 * wants the price first is entitled to it.
 */
export default function ReportNav({ steps, current, onSelect }) {
  return (
    <nav aria-label="Report sections">
      <ol className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => {
          const active = index === current;
          const seen = index < current;

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={active ? 'step' : undefined}
                className={`relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm
                            transition-colors ${
                              active
                                ? 'text-ink'
                                : 'text-ink-faint hover:text-ink-muted'
                            }`}
              >
                {active && (
                  // One element sliding between steps rather than a class
                  // toggling on five. The movement is what tells you the
                  // page changed when the content below fades.
                  <motion.span
                    layoutId="report-step-pill"
                    className="absolute inset-0 rounded-full bg-raised"
                    transition={{ duration: 0.32, ease: EASE }}
                  />
                )}
                <span
                  className={`relative flex size-5 shrink-0 items-center justify-center
                              rounded-full text-[11px] font-medium ${
                                seen
                                  ? 'bg-accent/10 text-accent'
                                  : active
                                    ? 'bg-accent text-white'
                                    : 'bg-raised text-ink-faint'
                              }`}
                >
                  {seen ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                </span>
                <span className="relative whitespace-nowrap font-medium">
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
