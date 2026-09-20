import { useDispatch } from 'react-redux';
import { ArrowRight } from 'lucide-react';
import Term from '../Extra/Term';
import { reportCtaClick } from '../../Features/scanSlice';

/** The Tier 0 → Tier 1 handoff, and the only ask on the page.
 *
 *  It appears *after* the result, never before it. The entire Tier 0
 *  promise is that we give before we ask, and a modal or an email gate
 *  ahead of the grade would break it. Gate 1 §1.5 checks for exactly that.
 *
 *  **The button is currently off.** The three-question form it leads to is
 *  Stage 2.5 and does not exist yet, so the page's primary call to action
 *  recorded a click and then did nothing — which is worse than not having
 *  it. Someone who wanted more just learned the product does not respond.
 *
 *  What stays is the explanation, because the honest reason the range is
 *  wide is worth saying whether or not we can narrow it today. Pass
 *  `onContinue` to turn the ask back on; that is the whole switch.
 */
export default function CtaCard({ scanId, onContinue }) {
  const dispatch = useDispatch();
  const canContinue = typeof onContinue === 'function';

  return (
    <section className="rounded-xl border border-accent/30 bg-accent-soft p-5">
      <h2 className="text-lg font-medium">
        {canContinue ? 'Want a number you can budget against?' : 'Why this range is wide'}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        This estimate uses only what we can see from outside, so it is wide on
        purpose. Three things would narrow it considerably — your revenue, your
        headcount, and the kind of data you hold — and they are the same three an{' '}
        <Term id="underwriter">underwriter</Term> asks first.
      </p>

      {canContinue && (
        <button
          type="button"
          onClick={() => {
            if (scanId) dispatch(reportCtaClick(scanId));
            onContinue();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover"
        >
          Narrow it down
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
