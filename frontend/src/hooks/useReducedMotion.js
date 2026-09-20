import { useEffect, useState } from 'react';

/** Gate 1 §1.5: with `prefers-reduced-motion: reduce`, values must jump
 *  rather than animate. The CSS in index.css handles transitions; this
 *  hook is for the places where JavaScript drives the movement — the
 *  count-up on the score, for instance, which CSS cannot reach. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
