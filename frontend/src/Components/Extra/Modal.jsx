import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

import { EASE } from '../../utils/motion';

/**
 * A full-page dialog.
 *
 * Used where the content is long enough to be its own page but the reader
 * should not lose their place to see it — the methodology is the case
 * this was built for. Sending someone from a half-read report to a
 * separate route to answer "where did 18 points come from?" costs them
 * their scroll position and their train of thought, and the back button
 * is a poor apology for that.
 *
 * Rendered through a portal so it is never clipped by an ancestor's
 * `overflow` or trapped under the sticky header's stacking context.
 *
 * The accessibility here is not decoration. A dialog that cannot be
 * closed with Escape, or that leaves the page scrolling behind it, is the
 * most common broken modal on the web:
 *
 *  - `role="dialog"` + `aria-modal` + a labelled title
 *  - Escape closes, backdrop click closes, close button closes
 *  - focus moves into the panel on open and returns to the trigger on
 *    close, so a keyboard user is not dropped at the top of the document
 *  - Tab is contained within the panel
 *  - the body is locked, and the scrollbar's width is replaced with
 *    padding so the page underneath does not visibly jump
 */
export default function Modal({ open, onClose, title, description, children }) {
  const panelRef = useRef(null);
  const restoreTo = useRef(null);
  const reduced = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();

  // Remember what had focus before we stole it.
  useEffect(() => {
    if (open) restoreTo.current = document.activeElement;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep Tab inside the panel. Without this the next Tab lands on the
      // page behind the dialog, which is invisible and still clickable.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    // Lock the page. The padding compensates for the scrollbar we just
    // removed; without it every fixed element shifts sideways on open.
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      // Return focus to whatever opened this.
      if (restoreTo.current instanceof HTMLElement) restoreTo.current.focus();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={reduced ? false : { opacity: 0, y: 12, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.14 } }}
            transition={{ duration: 0.26, ease: EASE }}
            className="relative flex max-h-full w-full flex-col overflow-hidden bg-canvas
                       outline-none sm:max-w-3xl sm:rounded-2xl sm:border sm:border-line"
            style={{ boxShadow: 'var(--shadow-pop)' }}
          >
            <div
              className="flex shrink-0 items-start justify-between gap-4 border-b border-line
                         bg-surface px-5 py-4 sm:px-7"
            >
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-h3">
                  {title}
                </h2>
                {description && (
                  <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-2 text-ink-faint transition-colors
                           hover:bg-raised hover:text-ink"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* The only scrolling region. The header and the page behind
                both stay put. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
