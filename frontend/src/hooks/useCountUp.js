import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** Animates a number towards its target.
 *
 *  Used on the score and the premium, where the movement is the point: a
 *  founder ticking DMARC should *see* C become B.
 *
 *  With reduced motion the target is returned straight from render rather
 *  than pushed through state. Setting state inside an effect body to
 *  achieve the same thing causes a cascading second render on every
 *  change — react-hooks/set-state-in-effect flags it, and it is the
 *  wrong shape regardless: a value that needs no animation needs no
 *  state. The information still arrives, just without the theatre.
 */
export function useCountUp(target, { duration = 550 } = {}) {
  const reduced = useReducedMotion();
  const [animated, setAnimated] = useState(target ?? 0);
  const frameRef = useRef(0);
  const fromRef = useRef(target ?? 0);

  const skip = reduced || duration <= 0 || target == null;

  useEffect(() => {
    if (skip) {
      // Keep the starting point current so that re-enabling motion later
      // animates from what is on screen, not from a stale value.
      fromRef.current = target ?? 0;
      return undefined;
    }

    const from = fromRef.current;
    const distance = target - from;
    if (distance === 0) return undefined;

    const startedAt = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      // Same curve as --ease-out-soft, so JS-driven and CSS-driven
      // movement on the same screen feel like one system.
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(Math.round(from + distance * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, skip]);

  return skip ? (target ?? 0) : animated;
}
