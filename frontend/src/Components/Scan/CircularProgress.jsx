import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * The loading ring shown while a scan runs.
 *
 * Built from a CSS conic-gradient rather than an SVG, so it is drawn
 * entirely from the theme tokens — change --color-accent and the ring
 * changes with it, with nothing to keep in sync.
 *
 * **Determinate, not a bare spinner.** It fills as checks land and shows
 * the count in the middle, so at any moment the user knows how much is
 * left. A spinner that just turns says only "wait", and the product's
 * rule is that the waiting time teaches something.
 * docs/education-layer.md section 7
 *
 * The slow sweep on top is the only indeterminate part: it says the
 * process is alive during the long gap while certificate transparency
 * logs are read, which can take ten seconds with no visible change.
 */
export default function CircularProgress({ done, total, size = 72, label }) {
  const reduced = useReducedMotion();
  const fraction = total ? Math.min(1, done / total) : 0;
  const degrees = fraction * 360;
  const complete = done >= total;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={label || `${done} of ${total} checks complete`}
    >
      {/* The filled arc. transition on the gradient angle would not
          animate, so the angle is animated through a custom property on
          the element instead — which does. */}
      <div
        className="absolute inset-0 rounded-full transition-[background] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          background: `conic-gradient(var(--color-accent) ${degrees}deg, var(--color-line) ${degrees}deg)`,
        }}
      />

      {/* The live sweep. Hidden once everything is in, and hidden for
          anyone who has asked for reduced motion. */}
      {!complete && !reduced && (
        <div
          className="absolute inset-0 animate-spin rounded-full"
          style={{
            background:
              'conic-gradient(transparent 0deg, transparent 300deg, var(--color-accent-soft) 360deg)',
            animationDuration: '1.4s',
          }}
        />
      )}

      {/* The hole, which is what turns the disc into a ring. */}
      <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-canvas">
        <span className="text-sm font-medium tabular-nums text-ink">
          {done}
          <span className="text-ink-faint">/{total}</span>
        </span>
      </div>
    </div>
  );
}
