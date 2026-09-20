/**
 * Shared animation vocabulary.
 *
 * Kept in one file so the whole product moves the same way. Two rules
 * behind every value below:
 *
 * **Motion carries meaning or it does not happen.** A row sliding in says
 * "this just arrived". A number counting up says "this changed because of
 * what you did". Decoration that says neither is noise on a page that is
 * asking someone to trust a number.
 *
 * **Fast, and out of the way.** This is an insurance report, not a
 * showreel. Everything here lands in under 450ms, and the easing settles
 * rather than bounces — a springy premium figure reads as unserious.
 */

export const EASE = [0.16, 1, 0.3, 1];

/** The default entrance. Short travel; a long slide draws attention to
 *  the movement instead of the content. */
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: EASE },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.28, ease: EASE } },
};

/** Sections of the report arriving in sequence. The delay is what makes
 *  the result feel assembled rather than dumped. */
export const stagger = (staggerChildren = 0.06, delayChildren = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});

/** The grade. The one place a little more presence is earned — it is the
 *  answer to the question they came with. */
export const gradeReveal = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: EASE },
  },
};

/** Expanding "how to fix it" panels. Height animation needs the element
 *  measured, so this pairs with AnimatePresence and an auto height. */
export const expand = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: 'auto',
    transition: { height: { duration: 0.26, ease: EASE }, opacity: { duration: 0.2 } },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { height: { duration: 0.2, ease: EASE }, opacity: { duration: 0.12 } },
  },
};

/** A tooltip or popover. Small scale change only — anything larger reads
 *  as a modal, which this is not.
 *
 *  It grows *out of* its trigger, so a panel that has flipped above must
 *  move the other way. Animating a flipped panel downward makes it read
 *  as belonging to whatever is beneath it. */
export function popoverFor(side = 'bottom') {
  const offset = side === 'top' ? 4 : -4;
  return {
    hidden: { opacity: 0, y: offset, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.16, ease: EASE } },
    exit: { opacity: 0, y: offset, scale: 0.98, transition: { duration: 0.12 } },
  };
}

export const popover = popoverFor('bottom');
