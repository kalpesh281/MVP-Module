/**
 * Shared animation vocabulary.
 *
 * Kept in one file so the whole product moves the same way. Three rules
 * behind every value below:
 *
 * **Motion carries meaning or it does not happen.** A row sliding in says
 * "this just arrived". A number counting up says "this changed because of
 * what you did". Decoration that says neither is noise on a page that is
 * asking someone to trust a number.
 *
 * **Three curves, six durations, nothing ad-hoc.** Thirty hand-tuned
 * beziers scattered through a codebase is itself the cheapness signal —
 * nothing ends up feeling like one system. Enter with ease-out, exit with
 * ease-in, reposition with ease-in-out.
 *
 * **An exit is two-thirds of its entrance.** Symmetric open/close is the
 * single most common reason UI motion reads as amateur. Everything here
 * that has both directions obeys the ratio.
 */

/** Expo-out. Fast start, long coast. The default for anything arriving. */
export const EASE = [0.16, 1, 0.3, 1];
/** Expo-in. Accelerating departure — things leave faster than they arrive. */
export const EASE_EXIT = [0.7, 0, 0.84, 0];
/** Symmetric. For an element repositioning on screen rather than entering. */
export const EASE_MOVE = [0.65, 0, 0.35, 1];
/** Gentler than expo. Hover, focus, colour — anywhere expo reads dramatic. */
export const EASE_SOFT = [0.2, 0, 0, 1];

/** Mirrors the --dur-* custom properties in index.css. Seconds, because
 *  that is what framer-motion takes. */
export const DUR = {
  instant: 0.08,
  fast: 0.16,
  base: 0.24,
  medium: 0.36,
  slow: 0.52,
};

/** The default entrance. Short travel; a long slide draws attention to the
 *  movement instead of the content. */
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base, ease: EASE } },
};

/** Sections of the report arriving in sequence. The delay is what makes the
 *  result feel assembled rather than dumped.
 *
 *  40ms, not the 60ms this used to be. Under 20ms a stagger reads as one
 *  blob and the effort is wasted; over 80ms the reader is waiting by the
 *  eighth item. 40ms is the value that reads considered. */
export const stagger = (staggerChildren = 0.04, delayChildren = 0.06) => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});

/** The grade. The one place a little more presence is earned — it is the
 *  answer to the question they came with.
 *
 *  Scale from 0.94, not 0.9: a large glyph scaling from further away reads
 *  as a zoom effect rather than as something settling into place. */
export const gradeReveal = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.slow, ease: EASE },
  },
};

/** Expanding "how to fix it" panels. Height animation needs the element
 *  measured, so this pairs with AnimatePresence and an auto height. */
export const expand = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: 'auto',
    transition: { height: { duration: 0.28, ease: EASE }, opacity: { duration: 0.2 } },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { height: { duration: 0.18, ease: EASE_EXIT }, opacity: { duration: 0.12 } },
  },
};

/** A tooltip or popover. Small scale change only — anything larger reads as
 *  a modal, which this is not.
 *
 *  It grows *out of* its trigger, so a panel that has flipped above must
 *  move the other way. Animating a flipped panel downward makes it read as
 *  belonging to whatever is beneath it. */
export function popoverFor(side = 'bottom') {
  const offset = side === 'top' ? 4 : -4;
  return {
    hidden: { opacity: 0, y: offset, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.fast, ease: EASE } },
    exit: { opacity: 0, y: offset, scale: 0.98, transition: { duration: 0.11, ease: EASE_EXIT } },
  };
}

export const popover = popoverFor('bottom');
