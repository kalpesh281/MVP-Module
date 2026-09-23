import { useEffect, useRef, useState } from 'react';

/**
 * The value this prop had on the previous *committed* render.
 *
 * Written with state rather than the usual bare ref because reading and
 * writing a ref during render is exactly what React's rules forbid — under
 * concurrent rendering a render can be thrown away and restarted, and a ref
 * mutated during it keeps a value from a render that never happened. The
 * eslint rule `react-hooks/refs` catches it.
 *
 * Here the previous score drives the ghost arc, so a stale one would leave
 * a trail pointing at a value the user never saw.
 */
export function usePrevious(value) {
  const [previous, setPrevious] = useState(null);
  const latest = useRef(value);

  useEffect(() => {
    if (latest.current !== value) {
      setPrevious(latest.current);
      latest.current = value;
    }
  }, [value]);

  return previous;
}
