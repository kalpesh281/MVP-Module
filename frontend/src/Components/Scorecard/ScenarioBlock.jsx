import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, Info, X } from 'lucide-react';

import { rupeeRangeCompact, rupeesCompact } from '../../utils/format';
import { EASE, fadeUp } from '../../utils/motion';

/**
 * Module B — what this finding costs if it happens.
 *
 * The block that stops the page being a security tool. It names a
 * **sublimit** and an **endorsement gap**, which are the two things that
 * actually decide whether a cyber claim pays out, and which no security
 * vendor would think to mention.
 *
 * Everything here except the two-sentence narrative is rendered verbatim
 * from a catalog in `scoring/scenarios.py`. The cost lines, the covered
 * list, the sublimit warning and the not-covered line are not generated
 * and never will be: in insurance, a model inventing a coverage statement
 * is the single mistake this product cannot make.
 *
 * When nothing scores above the floor it renders an honest empty state
 * rather than a manufactured threat. That is a stronger signal, and it is
 * the natural setup for the Tier 3 ask.
 *
 * **It follows the fix simulator.** Ticking the fix that closes a scenario
 * moves to the next exposure underneath it, and ticking them all leaves a
 * cleared state. Without that the page simulated in two places and not in
 * the third: the grade and the premium moved while the block below still
 * described the email spoof the reader had just ticked DMARC to prevent.
 *
 * The whole ranked list ships in the payload, so the choice here is a
 * lookup — never a recomputation. The catalog text stays verbatim and the
 * ordering stays the backend's.
 * docs/coverage-guidance.md Module B
 */
export default function ScenarioBlock({
  scenario, scenarios, selectedIds, fixes, onJumpToFix,
}) {
  const titleFor = (fixId) =>
    (fixes || []).find((fix) => fix.id === fixId)?.title || fixId;
  const ranked = scenarios?.length ? scenarios : scenario && !scenario.empty ? [scenario] : [];
  const open = ranked.filter((item) => !selectedIds?.has(item.link_to_fix));

  // Everything that had a scenario has been ticked. Say so — this is the
  // payoff for the work they just planned, and it is the one moment the
  // page can be unambiguously good news.
  if (ranked.length && !open.length) {
    const cleared = ranked.reduce((total, item) => total + (item.total?.high || 0), 0);
    const closedBy = [...new Set(ranked.map((item) => item.link_to_fix).filter(Boolean))];
    return (
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-pass/30 bg-pass/5 p-6"
      >
        <p className="flex items-start gap-2 font-medium">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pass" aria-hidden="true" />
          {/* Not "the exposure below" — in this state there is nothing
              below it. The block it used to sit above is the thing that
              has just gone. */}
          {ranked.length === 1
            ? 'That closes the exposure we found'
            : `That closes all ${ranked.length} exposures we found`}
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          {ranked.length === 1 ? 'It carried' : 'Between them they carried'} a
          typical worst case of around{' '}
          <strong className="font-medium text-ink">{rupeesCompact(cleared)}</strong>.
          Ticking the boxes does not close{' '}
          {ranked.length === 1 ? 'it' : 'them'} — doing the work does, and a
          re-scan is what proves it.
        </p>

        {/* Name the fix holding this open.
            Without it, unticking any other box looks like the page is
            stuck: the reader has no way to know which of four ticks was
            the one doing the work here. */}
        <p className="mt-3 border-t border-pass/20 pt-3 text-sm text-ink-muted">
          {ranked.length === 1 ? 'Because you ticked' : 'Because you ticked'}{' '}
          {closedBy.map((fixId, index) => (
            <span key={fixId}>
              {index > 0 && (index === closedBy.length - 1 ? ' and ' : ', ')}
              <button
                type="button"
                onClick={() => onJumpToFix?.(fixId)}
                className="font-medium text-ink underline decoration-dotted underline-offset-2
                           hover:text-accent"
              >
                {titleFor(fixId)}
              </button>
            </span>
          ))}
          . Untick {closedBy.length === 1 ? 'it' : 'either'} to see{' '}
          {ranked.length === 1 ? 'the exposure' : 'them'} again.
        </p>
      </motion.div>
    );
  }

  // The worst exposure still standing after what they have ticked.
  const active = open[0] ?? scenario;
  if (!active) return null;
  const remaining = open.length - 1;

  if (active.empty) {
    return (
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-line bg-surface p-6"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <p className="flex items-start gap-2 font-medium">
          <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          {active.title}
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          {active.body}
        </p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={active.id}
      variants={fadeUp}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.24, ease: EASE }}
      className="overflow-hidden rounded-2xl border border-line bg-surface"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-display text-h3">{active.title}</h3>
          {remaining > 0 && (
            <span className="text-xs text-ink-faint">
              {remaining} more {remaining === 1 ? 'exposure' : 'exposures'} after this
            </span>
          )}
        </div>
        {active.narrative && (
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            {active.narrative}
          </p>
        )}

        {/* The cost lines. Verbatim from the catalog — this component does
            not add them up either; `total` ships with them. */}
        <dl className="mt-5 space-y-2">
          {active.cost_lines.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-ink-muted">{line.label}</dt>
              <dd className="shrink-0 tabular-nums text-ink">{rupeeRangeCompact(line)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2 text-sm font-medium">
            <dt>Typical total</dt>
            <dd className="shrink-0 tabular-nums">{rupeeRangeCompact(active.total)}</dd>
          </div>
        </dl>
      </div>

      {/* The two lines that are the reason this block exists. Set apart
          from the costs on purpose: someone who reads nothing else on the
          page should read these. */}
      <div className="space-y-3 border-t border-line bg-canvas px-6 py-5">
        <div className="flex items-start gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-pass" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <span className="font-medium">Covered</span>{' '}
            <span className="text-ink-muted">{active.covered.join(' · ')}</span>
            {active.sublimit_warning && (
              <p className="mt-1 leading-relaxed text-warn">
                {active.sublimit_warning}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <X className="mt-0.5 size-4 shrink-0 text-fail" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <span className="font-medium">Not covered</span>{' '}
            <span className="text-ink-muted">{active.not_covered}</span>
          </div>
        </div>
      </div>

      {active.link_to_fix && (
        <div className="border-t border-line px-6 py-3.5">
          <button
            type="button"
            onClick={() => onJumpToFix?.(active.link_to_fix)}
            className="text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            This is why that fix is on your list above →
          </button>
        </div>
      )}

      <p className="border-t border-line px-6 py-3 text-xs leading-relaxed text-ink-faint">
        Typical figures, estimated — not a claims history and not a promise of
        cover. What a policy pays depends on its own wording.
      </p>
    </motion.div>
    </AnimatePresence>
  );
}
