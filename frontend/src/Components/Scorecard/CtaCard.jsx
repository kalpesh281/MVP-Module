import { useDispatch } from 'react-redux';
import { ArrowRight } from 'lucide-react';
import Term from '../Extra/Term';
import { reportCtaClick } from '../../Features/scanSlice';

/** The Tier 0 → Tier 1 handoff, and the only ask on the page.
 *
 *  It appears *after* the result, never before it. The entire Tier 0
 *  promise is that we give before we ask, and a modal or an email gate
 *  ahead of the grade would break it. Gate 1 §1.5 checks for exactly that.
 */
export default function CtaCard({ scanId, onContinue }) {
  const dispatch = useDispatch();

  return (
    <section className="rounded-xl border border-accent/30 bg-accent-soft p-5">
      <h2 className="text-lg font-medium">Want a number you can budget against?</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        This estimate uses only what we can see from outside, so it is wide on
        purpose. Three questions — your revenue, your headcount, and the kind of
        data you hold — narrow it considerably, and they are the same three an{' '}
        <Term id="underwriter">underwriter</Term> asks first.
      </p>
      <button
        type="button"
        onClick={() => {
          if (scanId) dispatch(reportCtaClick(scanId));
          onContinue?.();
        }}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover"
      >
        Narrow it down
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
