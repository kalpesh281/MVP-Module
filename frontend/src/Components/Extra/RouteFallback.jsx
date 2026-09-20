/** Shown while a lazily-loaded page arrives.
 *
 *  Not a spinner. The product's rule is that a bare spinner is never on
 *  screen — a skeleton keeps the layout stable so nothing jumps when the
 *  real content lands. Gate 1 §1.5 */
export default function RouteFallback() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-8 w-2/3 rounded bg-raised" />
      <div className="h-4 w-full rounded bg-raised" />
      <div className="h-4 w-5/6 rounded bg-raised" />
    </div>
  );
}
