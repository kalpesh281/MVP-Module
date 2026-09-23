import { Children, isValidElement } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { EASE } from '../../utils/motion';

/**
 * A headline that resolves into focus, word by word.
 *
 * Adapted from React Bits' `BlurText`
 * (https://reactbits.dev — MIT + Commons Clause, © David Haz), which is
 * itself the technique Corgi ships on its own hero: each fragment starts
 * blurred and slightly low, then sharpens as it rises. The resolving blur
 * is the part that matters. A plain fade-and-rise is the default every
 * framework ships; the blur is what makes type feel like it is coming
 * into focus rather than sliding in, and it is most of the difference
 * between "animated" and "considered".
 *
 * Three deliberate departures from the original:
 *
 *  1. **It takes children, not a string.** The original splits `text` on
 *     spaces, which would flatten the `<Term>` inside our headline into
 *     plain characters and lose the glossary popover. Element children are
 *     kept whole and animated as a single unit; only the string parts are
 *     split into words.
 *
 *  2. **It is tuned down, hard.** The stock defaults are a 10px blur, 50px
 *     of travel and 200ms between words — on a six-word headline that is
 *     1.2 seconds before the last word arrives, and it reads as a title
 *     sequence. These values are Corgi's measured ones: 3px of blur, 12px
 *     of travel, 40ms apart. The whole line lands in under 600ms.
 *
 *  3. **It honours `prefers-reduced-motion`.** The original has no such
 *     check, so it blurs and moves regardless. Here the text simply
 *     renders.
 *
 * The heading element is the caller's — `as` — so this never turns an h1
 * into a `<p>` the way the original does, which would quietly cost the
 * page its document outline.
 */
export default function RevealText({ as: Tag = 'h1', className = '', children, delay = 0 }) {
  const reduced = useReducedMotion();

  if (reduced) return <Tag className={className}>{children}</Tag>;

  // Flatten to a list of animatable units: each word of a string child, and
  // each element child whole.
  const units = [];
  Children.toArray(children).forEach((child) => {
    if (typeof child === 'string') {
      child.split(/(\s+)/).forEach((part) => {
        if (part.trim()) units.push(part);
      });
    } else if (isValidElement(child)) {
      units.push(child);
    }
  });

  return (
    <Tag className={className}>
      {/* `inline` rather than the original's flex wrapper: a flex container
          cannot be justified or balanced as text, and `text-balance` on the
          headline is doing real work at these sizes. */}
      {units.map((unit, index) => (
        <motion.span
          key={index}
          className="inline-block will-change-[transform,filter,opacity]"
          initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: EASE, delay: delay + index * 0.04 }}
        >
          {unit}
          {index < units.length - 1 && ' '}
        </motion.span>
      ))}
    </Tag>
  );
}
