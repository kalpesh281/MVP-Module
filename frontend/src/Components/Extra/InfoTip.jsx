import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { popoverFor } from '../../utils/motion';

/** Gap kept between the panel and the edge of the viewport. */
const MARGIN = 12;

/**
 * A note attached to the thing it qualifies. Opens on hover, and on focus
 * or tap for everyone who cannot hover.
 *
 * Hover alone would make this invisible on every phone, and a meaningful
 * share of the people reading a report like this are on one. Hover alone
 * is also unreachable by keyboard. So: pointer-enter opens it, focus opens
 * it, click toggles it, Escape and outside-click close it.
 *
 * This is progressive disclosure, which is the pattern most B2B products
 * are converging on — show the minimum needed to make the next decision,
 * reveal the rest on demand. What it must never do is hide something the
 * page is *required* to say. The premium card keeps "Estimated" in its
 * visible label and its "not a quote" line; the tip holds the longer
 * explanation behind them. docs/scoring-and-pricing.md section 4
 *
 * It flips above its trigger when there is not room below. A tip on the
 * last row of a card is the one most likely to be opened and the one with
 * least room under it, so "always below" fails exactly where it matters.
 */
export default function InfoTip({ label, children, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState('bottom');
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const closeTimer = useRef(0);
  const id = useId();

  // Measured before paint, so the panel is never seen below and then
  // above. Height is read from the panel itself rather than assumed,
  // because these hold anything from one line to a paragraph and a rule.
  useLayoutEffect(() => {
    if (!open) return undefined;

    const place = () => {
      const trigger = wrapRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!trigger || !panel) return;

      const below = window.innerHeight - trigger.bottom - MARGIN;
      const above = trigger.top - MARGIN;
      // Only flip if it genuinely does not fit *and* there is more room
      // the other way — flipping into an equally bad position just moves
      // the clipping.
      setSide(panel.height > below && above > below ? 'top' : 'bottom');
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // A small grace period on leave. Without it the tip vanishes the moment
  // the pointer crosses the gap between the icon and the panel, which
  // makes any link inside it unusable.
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const cancelClose = () => clearTimeout(closeTimer.current);

  return (
    <span
      className="relative inline-flex"
      ref={wrapRef}
      onPointerEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onPointerLeave={scheduleClose}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={scheduleClose}
        className="inline-flex items-center justify-center rounded-full text-ink-faint
                   transition-colors hover:text-accent"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="note"
            ref={panelRef}
            variants={popoverFor(side)}
            initial="hidden"
            animate="show"
            exit="exit"
            className={`absolute z-30 block w-max rounded-xl border border-line
                        bg-surface p-3.5 text-sm leading-relaxed text-ink-muted
                        ${side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
                        ${align === 'right' ? 'right-0' : 'left-0'}`}
            style={{
              // Never wider than the viewport minus its gutters, so a tip
              // cannot cause horizontal scroll at 320px. Gate 1 §1.5
              maxWidth: 'min(21rem, calc(100vw - 2rem))',
              boxShadow: 'var(--shadow-pop)',
            }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
