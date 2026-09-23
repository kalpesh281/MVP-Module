import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { limitChosen, selectLimit } from '../../Features/simulatorSlice';
import { rupeeRange, rupees } from '../../utils/format';
import { EASE } from '../../utils/motion';
import InfoTip from '../Extra/InfoTip';

/**
 * The price, the cover it buys, and why that much — one card.
 *
 * These were two cards stacked, and both printed the same premium on
 * consecutive lines. That happened because this card was built in Stage 1
 * when the cover amount was fixed at ₹5 Cr and never shown, and the
 * coverage module then arrived owning both the amount and its price. One
 * number in two boxes reads like a bug even when it isn't.
 *
 * Merged, it answers the two questions in the order a reader asks them:
 * what does it cost, and why that much cover. The selector sits between
 * them because it is the thing that connects the two — it shows the
 * premium is a consequence of a decision they control, not a price handed
 * down.
 *
 * Switching re-prices this card, the rail and the fix simulator at once,
 * with no request in flight: every rung shipped with its own grade table.
 * docs/coverage-guidance.md Module A
 */
export default function PremiumCard({
  premium,
  baseline,
  saving,
  bandLabel,
  coverLabel,
  rateVersion,
  grade,
  coverage,
}) {
  const dispatch = useDispatch();
  const chosen = useSelector(selectLimit);
  const improved = saving > 0;

  const options = coverage?.options || [];
  const recommended = options.find((o) => o.recommended) ?? options[0];
  const activeLimit = chosen ?? recommended?.limit;
  const rationale = coverage?.rationale || {};
  const belowRecommendation =
    recommended != null && activeLimit != null && activeLimit < recommended.limit;

  return (
    <div
      className="rounded-2xl border border-line bg-surface p-6"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
        Estimated annual premium
        <InfoTip label="Where this estimate comes from">
          <span className="block">
            These figures are indicative of the Indian cyber market and are{' '}
            <strong className="font-medium text-ink">not insurer-validated</strong>.
            A real quote needs a proposal form and a human.
          </span>
          <span className="mt-2.5 block border-t border-line pt-2.5 text-xs">
            <span className="block font-medium text-ink">
              Everything that went into this number
            </span>
            <span className="mt-1 block">
              Grade {grade ?? '—'} · {bandLabel ?? 'revenue band'} ·{' '}
              {coverLabel ?? '—'} of cover · rate card {rateVersion ?? 'v1.1'}
            </span>
            <span className="mt-1.5 block text-ink-faint">
              Nothing else. We do not adjust it for your industry or the data you
              hold, because both are inferred from your website — a number we can
              trace beats a number that looks precise.
            </span>
            <Link
              to="/methodology"
              className="mt-2 block font-medium text-accent underline-offset-2 hover:underline"
            >
              See the full rate card
            </Link>
          </span>
        </InfoTip>
      </p>

      <motion.p
        key={`${premium?.low}-${premium?.high}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        // The second-most-important number on the page, and it was set at
        // 30px — the size of a section heading. A premium range is the thing
        // a founder repeats to a co-founder; it earns display type.
        className="mt-2 font-display text-figure tabular-nums"
      >
        {rupeeRange(premium)}
      </motion.p>

      {/* The cover amount is data, not copy. It read "₹5 Cr" for every
          company while the figure above it changed with the band. */}
      <p className="mt-1.5 text-sm text-ink-muted">
        for <span className="font-medium text-ink">{coverLabel ?? '₹5 Cr'}</span> of
        cover{bandLabel ? `, ${bandLabel}` : ''}
      </p>

      {improved && baseline && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 flex flex-wrap items-center gap-x-2 text-sm"
        >
          <span className="text-ink-faint line-through">{rupeeRange(baseline)}</span>
          <span className="rounded-full bg-pass/10 px-2 py-0.5 font-medium text-pass">
            about {rupees(saving)} a year less
          </span>
        </motion.p>
      )}

      {options.length > 0 && (
        <div className="mt-5 border-t border-line pt-5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
            How much cover do you need?
            <InfoTip label="How this amount was chosen">
              <span className="block">
                A published rule picked this, not a model. The strongest thing we
                can see about you sets the floor — health or card data, then
                financial data, then personal data at scale, then headcount.
              </span>
              <span className="mt-2 block text-xs text-ink-faint">
                We never recommend more than the cost band supports. When the
                numbers do not justify a rung, we recommend the one below it.
              </span>
            </InfoTip>
          </p>

          {rationale.reasoning && (
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-muted">
              {rationale.reasoning}
            </p>
          )}

          <div role="radiogroup" aria-label="Cover amount" className="mt-3 flex flex-wrap gap-2">
            {options.map((option) => {
              const selected = option.limit === activeLimit;
              const price = priceFor(option, grade);
              return (
                <button
                  key={option.limit}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => dispatch(limitChosen(option.limit))}
                  className={`relative flex-1 basis-28 rounded-xl border px-3 py-2.5 text-left
                              transition-colors ${
                                selected
                                  ? 'border-accent bg-accent-soft'
                                  : 'border-line hover:border-ink-faint'
                              }`}
                >
                  <span
                    className={`block text-sm font-medium tabular-nums ${
                      selected ? 'text-accent' : 'text-ink'
                    }`}
                  >
                    {option.limit_label}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums text-ink-faint">
                    {price?.referred ? 'referred' : rupeeRange(price)}
                  </span>
                  {option.recommended && (
                    <span className="absolute -top-2 right-2 rounded-full bg-surface px-1.5 text-[0.65rem] font-medium text-accent">
                      ours
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Dropping below the recommendation must be visible, not silent.
              The whole module is an argument for a number; letting someone
              walk past it without a word would make the argument decorative. */}
          {belowRecommendation && rationale.downside && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="mt-3 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2.5 text-sm
                         leading-relaxed text-ink-muted"
            >
              {rationale.downside}
            </motion.p>
          )}
        </div>
      )}

      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
        An estimate to show you the shape of the market, not a quote. Typical
        incident cost at your size and data type justifies the amount of cover —
        it is never used to price it. Pending insurer validation.
      </p>
    </div>
  );
}

/** The option's price at the grade currently on screen, which moves when
 *  the reader ticks a fix. Never computed here; looked up. */
function priceFor(option, grade) {
  if (!grade) return option.premium;
  const row = option.by_grade?.[grade];
  if (row === undefined) return option.premium;
  if (row === null) return { low: null, high: null, referred: true };
  return row;
}
