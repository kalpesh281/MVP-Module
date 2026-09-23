import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, ShieldCheck } from 'lucide-react';

import Modal from '../Extra/Modal';
import ProvenanceContent from '../Methodology/ProvenanceContent';

/**
 * The page frame's header. Rendered by `Layout`, so everything here is on
 * every route.
 *
 * The dialog holds the provenance — what is a published standard, what we
 * traced to a source document, and what is our own judgement — and
 * nothing else. Deliberately not the whole methodology: the rate card
 * tables belong on `/methodology`, which is the URL you paste into an
 * email to a CTO. The question this button answers is the one a reader
 * has while mid-report — "where did 18 points come from?" — and routing
 * them away to answer it costs them their place.
 *
 * The bar is **opaque**, not translucent. At 85% with a backdrop blur a
 * card scrolling underneath stayed faintly visible and every row was
 * sliced in half at the header's lower edge — the page read as broken
 * rather than as layered. A sticky bar has to be a wall, or it should not
 * be sticky.
 *
 * One trigger, on every route and every screen width. There used to be a
 * "Rule-based scoring" badge here with the same explanation behind an
 * info tip; it was removed once the dialog existed. Two entry points to
 * one document is a choice the reader has to make before they can read
 * anything, and the badge was hidden on phones anyway.
 */
export default function Header() {
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  return (
    <header className='sticky top-0 z-40 border-b border-line bg-canvas'>
      <div className='shell flex items-center justify-between gap-4 py-4'>
        <Link
          to='/'
          className='flex items-center gap-2.5 transition-opacity hover:opacity-80'
        >
          <span className='flex size-8 items-center justify-center rounded-lg bg-accent'>
            <ShieldCheck
              className='size-[18px] text-white'
              aria-hidden='true'
            />
          </span>
          <span className='flex flex-col leading-none'>
            <span className='text-[15px] font-semibold tracking-tight'>
              Boundry
            </span>
            <span className='mt-0.5 hidden text-xs text-ink-faint sm:block'>
              Cyber liability, priced on what an insurer can see
            </span>
          </span>
        </Link>

        <div className='flex shrink-0 items-center gap-2'>
          <button
              type='button'
              onClick={() => setMethodologyOpen(true)}
              aria-haspopup='dialog'
              aria-expanded={methodologyOpen}
              aria-label='Where our numbers come from'
              className='inline-flex items-center gap-1.5 rounded-full border border-line
                         px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors
                         hover:border-accent/40 hover:bg-raised hover:text-ink'
            >
              <ScrollText className='size-4' aria-hidden='true' />
              {/* Label on desktop, icon alone on a phone. This project has
                  no `xs` breakpoint, so `sm` is the only honest one to
                  branch on — the button keeps its aria-label either way. */}
              <span className='hidden sm:inline' aria-hidden='true'>Sources</span>
          </button>
        </div>
      </div>

      <Modal
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        title='Where our numbers come from'
        description='What is a published standard, what we traced to a source document, and what is our own judgement.'
      >
        {/* Mounted only while open, so no page pays for a fetch nobody
            asked for. */}
        {methodologyOpen && <ProvenanceContent />}
      </Modal>
    </header>
  );
}
