import { motion } from 'framer-motion';
import { Check, X, AlertTriangle, Minus, Loader2 } from 'lucide-react';
import { CHECK_BLURBS, CHECK_DETAIL } from '../../data/gradeMeta';
import InfoTip from '../Extra/InfoTip';

const ICONS = {
  pass: { Icon: Check, tone: 'text-pass', bg: 'bg-pass/10', label: 'Passed' },
  warn: { Icon: AlertTriangle, tone: 'text-warn', bg: 'bg-warn/10', label: 'Needs attention' },
  fail: { Icon: X, tone: 'text-fail', bg: 'bg-fail/10', label: 'Failed' },
  inconclusive: {
    Icon: Minus,
    tone: 'text-inconclusive',
    bg: 'bg-inconclusive/10',
    label: 'Could not check',
  },
};

/** One check.
 *
 *  The row animates only on the transition from pending to answered —
 *  that movement says "this just landed", which is the whole reason the
 *  feed streams rather than appearing at once. It does not animate on
 *  every re-render. */
export default function CheckRow({ check }) {
  const pending = check.status === 'pending';
  const { Icon, tone, bg, label } = ICONS[check.status] ?? ICONS.inconclusive;
  const detail = CHECK_DETAIL[check.id];

  return (
    <li className="flex items-start gap-3.5 px-5 py-4">
      <motion.span
        key={check.status}
        initial={pending ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
          pending ? 'bg-raised' : bg
        }`}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-ink-faint" aria-hidden="true" />
        ) : (
          <Icon className={`size-4 ${tone}`} aria-hidden="true" />
        )}
      </motion.span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={`font-medium ${pending ? 'text-ink-muted' : 'text-ink'}`}>
            {check.label}
          </span>
          <span className="sr-only">{pending ? 'Checking' : label}</span>
          {detail ? (
            <InfoTip label={`What the ${check.label} check looks at`}>
              <span className="block">{detail.what}</span>
              <span className="mt-2 block">{detail.why}</span>
              <span className="mt-2.5 block border-t border-line pt-2.5 text-xs text-ink-faint">
                Worth up to {detail.points} of the 100 points. A clean result
                deducts nothing.
              </span>
            </InfoTip>
          ) : null}
        </span>

        <motion.span
          key={check.detail || 'pending'}
          initial={pending ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1 block text-sm leading-relaxed text-ink-muted"
        >
          {pending ? CHECK_BLURBS[check.id] : check.detail}
        </motion.span>
      </span>
    </li>
  );
}
