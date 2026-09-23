import { motion, useReducedMotion } from 'framer-motion';
import { Check, AlertTriangle, X } from 'lucide-react';
import { EASE } from '../../utils/motion';

/**
 * The landing page's right-hand column: a miniature of the thing you get.
 *
 * **Why a facsimile of the report rather than an illustration.** Every
 * platform in this category that looks expensive shows the artefact. Corgi
 * draws a reproduction of the policy document, form number and all, and
 * runs leader lines from it to the cover it buys. Mitigata shows a live
 * terminal panel. Neither uses stock art and neither uses a gradient mesh
 * — both of those say "we had a landing page to fill".
 *
 * Showing the report does three things a picture cannot: it proves the
 * product exists, it teaches the format before the reader commits a
 * domain, and it puts a grade and a premium on screen inside two seconds.
 *
 * **Everything here is fictional and says so.** SPECIMEN is printed across
 * it and the domain is a placeholder. On a page whose entire claim is that
 * the numbers are checkable, a mock that could be mistaken for a real scan
 * would be the worst possible opening.
 *
 * The domain was `example.com` — the IANA-reserved name that cannot ever
 * be registered. It now reads `xyztech.in`, which looks like the Indian
 * SaaS company this is actually sold to rather than like a spec document.
 * That trades the reserved-name guarantee for realism, which is only
 * acceptable because SPECIMEN is stamped across the card.
 *
 * The arc draws once, the rows land in sequence, and then it stops. An
 * infinite animation beside a form is a thing competing with the form.
 */

const ROWS = [
  { Icon: Check, label: 'DKIM signing', rail: 'bg-pass/45', tone: 'text-pass', bg: 'bg-pass/10' },
  { Icon: AlertTriangle, label: 'DMARC policy', rail: 'bg-warn', tone: 'text-warn', bg: 'bg-warn/10' },
  { Icon: X, label: 'Public subdomains', rail: 'bg-fail', tone: 'text-fail', bg: 'bg-fail/10' },
];

/** 270 of the normalised 100 units — the same geometry as the real ScoreArc. */
const SWEEP = 75;
const SCORE = 78;

export default function HeroReport() {
  const reduced = useReducedMotion();
  const colour = 'var(--color-grade-b)';

  return (
    <motion.div
      aria-hidden="true"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
      className="relative w-full max-w-sm"
    >
      {/* A wash of the grade colour behind the card, so it sits in light
          rather than on a flat ground. */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: colour }}
      />

      <div
        className="relative overflow-hidden rounded-panel border border-line bg-surface"
        style={{ boxShadow: 'var(--shadow-e3)' }}
      >
        {/* Masthead. The form number is the cheapest institutional cue there
            is — it is what makes a card read as a document. */}
        <div className="flex items-baseline justify-between border-b border-line bg-raised px-5 py-3">
          <span className="text-eyebrow uppercase text-ink-faint">Risk assessment</span>
          <span className="font-mono text-[10px] text-ink-faint">BDY-RA-2026-0041</span>
        </div>

        <div className="flex items-center gap-5 px-5 py-6">
          <div className="relative size-24 shrink-0">
            <svg viewBox="0 0 100 100" className="block size-24">
              <g transform="rotate(135 50 50)">
                <circle
                  cx="50" cy="50" r="42" pathLength="100" fill="none"
                  stroke="var(--color-line)" strokeWidth="11" strokeLinecap="round"
                  strokeDasharray={`${SWEEP} 100`}
                />
                <motion.circle
                  cx="50" cy="50" r="42" pathLength="100" fill="none"
                  stroke={colour} strokeWidth="11" strokeLinecap="round"
                  initial={reduced ? false : { strokeDasharray: '0 100' }}
                  animate={{ strokeDasharray: `${(SCORE / 100) * SWEEP} 100` }}
                  transition={{ duration: reduced ? 0 : 1.2, ease: EASE, delay: 0.4 }}
                />
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[2rem] leading-none" style={{ color: colour }}>
                B
              </span>
              <span className="mt-0.5 text-[10px] tabular-nums text-ink-faint">{SCORE} / 100</span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="font-mono text-sm text-ink">xyztech.in</p>
            <p className="mt-1 text-caption leading-relaxed text-ink-muted">
              Good, with a few gaps worth closing before you apply.
            </p>
          </div>
        </div>

        <ul className="border-t border-line">
          {ROWS.map(({ Icon, label, rail, tone, bg }, index) => (
            <motion.li
              key={label}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.34, ease: EASE, delay: 0.7 + index * 0.12 }}
              className="relative flex items-center gap-3 border-b border-line px-5 py-2.5 pl-6 last:border-b-0"
            >
              <span className={`absolute inset-y-1.5 left-0 w-[3px] rounded-r-full ${rail}`} />
              <span className={`flex size-5 items-center justify-center rounded-full ${bg}`}>
                <Icon className={`size-3 ${tone}`} />
              </span>
              <span className="text-caption text-ink-muted">{label}</span>
            </motion.li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between border-t border-line bg-raised px-5 py-3.5">
          <span className="text-eyebrow uppercase text-ink-faint">Est. premium</span>
          <motion.span
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE, delay: 1.15 }}
            className="font-display text-h3 tabular-nums"
          >
            ₹2.4 L – ₹3.3 L
          </motion.span>
        </div>

        {/* Says what it is. A convincing mock that does not admit to being
            one is a credibility liability on this page of all pages. */}
        <span className="pointer-events-none absolute right-3 top-14 rotate-12 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint/70">
          Specimen
        </span>
      </div>
    </motion.div>
  );
}
