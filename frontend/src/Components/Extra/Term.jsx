import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GLOSSARY } from '../../data/glossary';
import { popover } from '../../utils/motion';

/**
 * An insurance term, defined where it is used.
 *
 * Rendered with a dotted underline so it reads as "there is more here"
 * without shouting like a link. Opens on hover, focus or tap — the same
 * three paths as InfoTip, for the same reason: hover alone is invisible
 * on a phone and unreachable by keyboard.
 */
export default function Term({ id, children }) {
  const entry = GLOSSARY[id];
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const timer = useRef(0);
  const tipId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false);
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!entry) return children ?? null;

  return (
    <span className="relative inline-block" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          timer.current = setTimeout(() => setOpen(false), 120);
        }}
        onPointerEnter={() => {
          clearTimeout(timer.current);
          setOpen(true);
        }}
        onPointerLeave={() => {
          timer.current = setTimeout(() => setOpen(false), 120);
        }}
        className="cursor-help underline decoration-dotted decoration-from-font underline-offset-4
                   transition-colors hover:text-accent"
      >
        {children ?? entry.term}
      </button>

      <AnimatePresence>
        {/* `tracking-normal` and `font-sans` are not decoration — they are a
            fix. `letter-spacing` is inherited as a COMPUTED PIXEL value, not
            as the `em` it was written in. This popover opens inside an h1
            set at 56px with -0.035em of tracking, which computes to -1.96px
            and is then inherited by every descendant. At the popover's 14px
            that is nearly two pixels pulled out of every letter gap, which
            closes the word spaces entirely: "The person at the insurer" had
            been rendering as "Thepersonattheinsurer".

            Any small text nested inside display type needs this reset. */}
        {open && (
          <motion.span
            id={tipId}
            role="note"
            variants={popover}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute left-0 top-full z-30 mt-2 block w-max rounded-card border border-line
                       bg-surface p-3.5 text-left font-sans text-sm font-normal normal-case
                       leading-relaxed tracking-normal text-ink-muted"
            style={{
              maxWidth: 'min(20rem, calc(100vw - 2rem))',
              boxShadow: 'var(--shadow-pop)',
            }}
          >
            <span className="block font-medium text-ink">{entry.term}</span>
            <span className="mt-0.5 block">{entry.definition}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
