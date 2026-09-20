import { motion } from 'framer-motion';
import InfoTip from '../Extra/InfoTip';
import { rupeeRange, rupees } from '../../utils/format';

/** The estimate, and the honesty around it.
 *
 *  "Estimated" stays in the visible label and the "not a quote" sentence
 *  stays on the card. Only the longer explanation moves into the note —
 *  hiding the disclaimer itself behind a hover would be the wrong kind of
 *  tidy. docs/scoring-and-pricing.md section 4 */
export default function PremiumCard({
  premium,
  baseline,
  saving,
  bandLabel,
  coverLabel,
  rateVersion,
  grade,
}) {
  const improved = saving > 0;

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
          {/* The whole derivation, shown rather than described. Two inputs
              pick a row from a published table — and a client who can see
              that can check it. docs/defending-the-premium.md */}
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
          </span>
        </InfoTip>
      </p>

      <motion.p
        key={`${premium?.low}-${premium?.high}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mt-2 text-3xl font-semibold tabular-nums tracking-tight"
      >
        {rupeeRange(premium)}
      </motion.p>

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

      {/* The cover amount is data, not copy. It read "₹5 Cr" for every
          company while the figure above it changed with the band. */}
      <p className="mt-4 border-t border-line pt-3 text-sm text-ink-faint">
        For {coverLabel ?? '₹5 Cr'} of cover{bandLabel ? `, ${bandLabel}` : ''}. An
        estimate to show you the shape of the market, not a quote.
      </p>
    </div>
  );
}
