import { motion } from 'framer-motion';
import { ShieldAlert, TrendingDown, Wrench } from 'lucide-react';
import { rupees } from '../../utils/format';
import { describeEffort } from '../../utils/simulate';
import { fadeUp, stagger } from '../../utils/motion';

/**
 * Three numbers, above everything else.
 *
 * The executive-summary strip is the one pattern every serious B2B
 * dashboard shares: three to five figures at the top that answer "where
 * do I stand" before anyone scrolls. Here they are deliberately the three
 * a founder repeats to a co-founder — what is wrong, what it costs, and
 * how long it takes to be rid of it.
 */
export default function SummaryStrip({ result, simulated }) {
  const fixes = result.fixes || [];
  const combined = result.combined_if_all_fixed || {};
  const upside = simulated.selected > 0 ? simulated.saving : combined.annual_saving || 0;
  const hours = simulated.selected > 0 ? simulated.effortHours : combined.total_effort_hours || 0;

  const cells = [
    {
      Icon: ShieldAlert,
      label: 'Issues worth fixing',
      value: fixes.length === 0 ? 'None' : String(fixes.length),
      note:
        fixes.length === 0
          ? 'Nothing we can see from outside'
          : gradeMovers(fixes),
    },
    {
      Icon: TrendingDown,
      label: simulated.selected > 0 ? 'Saving, as selected' : 'Premium upside',
      value: upside > 0 ? rupees(upside) : '—',
      note: upside > 0 ? 'estimated, per year' : 'already at the best band',
    },
    {
      Icon: Wrench,
      label: 'Work involved',
      value: hours > 0 ? describeEffort(hours) : '—',
      note: hours > 0 ? 'for one engineer' : 'nothing outstanding',
    },
  ];

  return (
    <motion.dl
      variants={stagger(0.07)}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3"
      style={{ boxShadow: 'var(--shadow-e1)' }}
    >
      {cells.map(({ Icon, label, value, note }) => (
        <motion.div key={label} variants={fadeUp} className="bg-surface p-6">
          {/* The label is an eyebrow, not a sentence: uppercase, tracked out,
              small. It demotes itself so the figure below can be the thing
              the eye lands on — which is the entire job of a stat tile. */}
          <dt className="flex items-center gap-1.5 text-eyebrow uppercase text-ink-faint">
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </dt>
          <dd className="mt-3 font-display text-figure tabular-nums">{value}</dd>
          <p className="mt-2 text-caption text-ink-faint">{note}</p>
        </motion.div>
      ))}
    </motion.dl>
  );
}

/** "3 change your grade" sitting directly under the figure "3" reads as a
 *  repeat of the same number rather than a subset of it, and it says
 *  "1 change" when only one does. */
function gradeMovers(fixes) {
  const movers = fixes.filter((f) => f.grade_if_fixed).length;
  if (movers === 0) return 'None of them move your grade';
  if (movers === fixes.length) return movers === 1 ? 'It moves your grade' : 'All move your grade';
  return `${movers} of them move your grade`;
}
