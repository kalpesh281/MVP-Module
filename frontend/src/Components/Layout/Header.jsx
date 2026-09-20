import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import InfoTip from '../Extra/InfoTip';


export default function Header() {
  return (
    <header className='sticky top-0 z-40 bg-canvas/85 backdrop-blur-md'>
      <div className='flex w-full items-center justify-between gap-4 px-5 py-3.5 sm:px-8'>
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
              Scorecard
            </span>
            <span className='mt-0.5 hidden text-xs text-ink-faint sm:block'>
              Cyber liability, priced on what an insurer can see
            </span>
          </span>
        </Link>

        <span className='hidden shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-faint sm:flex'>
          Rule-based scoring
          <InfoTip label='What rule-based scoring means' align='right'>
            Every point on your grade comes from a published table of rules — a
            missing DMARC record costs 18 points, a missing content security
            policy costs 4. No model decides your score, which is why the same
            domain scanned twice gives the same grade, and why we can show you
            the exact rule behind any finding you disagree with.
          </InfoTip>
        </span>
      </div>
    </header>
  );
}
