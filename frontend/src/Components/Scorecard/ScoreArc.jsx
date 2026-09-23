import { motion } from 'framer-motion';
import { usePrevious } from '../../hooks/usePrevious';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { EASE, EASE_MOVE } from '../../utils/motion';

/**
 * The score, as a 270° arc.
 *
 * **Why an arc and not a ring.** A full circle reads as *progress* — a
 * thing that will one day be complete. A score on a scale is not that, and
 * the open gap at the bottom is what says so. 270° is the usable sweep;
 * a 180° half-donut wastes the top half of its own box.
 *
 * **Why not the conic-gradient this replaces.** A conic gradient cannot be
 * animated — the browser interpolates it as an image, so the arc could
 * only ever cut instantly to its new length. The one movement in this
 * product that carries real meaning is the score moving when a fix is
 * ticked, and that was the one movement the old implementation could not
 * perform. Stroke-dashoffset animates properly.
 *
 * **The ghost.** When the score changes, a dimmed arc is left at the old
 * value and fades out behind the new one. The eye reads "it moved from
 * there to here" without anything having to say so.
 *
 * `pathLength="100"` normalises the geometry away: the dash array is then
 * in plain percentage units and none of it has to be recomputed if the
 * radius or stroke width ever change.
 */

/** 270 of 360 degrees drawn, so 75 of the normalised 100 units. */
const SWEEP = 75;

export default function ScoreArc({
  score = 0,
  colour,
  grade,
  size = 168,
  strokeWidth = 12,
  children,
}) {
  const reduced = useReducedMotion();

  const clamped = Math.max(0, Math.min(100, score));
  const filled = (clamped / 100) * SWEEP;
  // A round cap adds half a stroke width of visual length at each end, so
  // a 1% score still draws something that looks like 4%. Below the floor
  // the cap alone would be the entire arc, so there is nothing to show.
  const visible = clamped > 0 ? Math.max(filled, 1.5) : 0;

  // Reading a ref during render is forbidden — a render can be discarded
  // and restarted, leaving the ref holding a value nobody ever saw. The
  // ghost would then point at the wrong place.
  const ghost = usePrevious(clamped);
  const moved = ghost != null && ghost !== clamped;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={
          grade
            ? `Grade ${grade}. Score ${clamped} out of 100.`
            : `Score ${clamped} out of 100.`
        }
        className="block"
      >
        {/* Rotated on a <g> rather than the circle: transform-box and
            transform-origin resolve differently across browsers for shapes,
            and a group sidesteps the whole argument.
            135° puts the 90° gap centred at the bottom. */}
        <g transform="rotate(135 50 50)">
          {/* The track is always neutral. Colouring a track makes the unearned
              portion of the score look earned. */}
          <circle
            cx="50"
            cy="50"
            r="42"
            pathLength="100"
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${SWEEP} 100`}
          />

          {moved && !reduced && (
            <motion.circle
              key={`ghost-${ghost}`}
              cx="50"
              cy="50"
              r="42"
              pathLength="100"
              fill="none"
              stroke={colour}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${(ghost / 100) * SWEEP} 100`}
              initial={{ opacity: 0.35 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
            />
          )}

          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            pathLength="100"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={reduced ? false : { strokeDasharray: `0 100` }}
            animate={{
              strokeDasharray: `${visible} 100`,
              // The band colour crosses late — at the end of the sweep — so a
              // C becoming a B does not give the answer away before the arc
              // has finished travelling.
              stroke: colour,
            }}
            transition={{
              strokeDasharray: { duration: reduced ? 0 : 1.1, ease: EASE },
              stroke: { duration: 0.3, delay: reduced ? 0 : 0.85, ease: EASE_MOVE },
            }}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
