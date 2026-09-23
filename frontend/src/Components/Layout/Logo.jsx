/**
 * The Boundry mark.
 *
 * It replaces a `ShieldCheck` from lucide in a rounded blue square, which
 * is the single most-used placeholder logo on the internet and the
 * loudest signal a product was assembled rather than designed. A stock
 * icon as a logo is read, correctly, as "nobody has done the work yet".
 *
 * **What it draws.** Four corner brackets make a perimeter — the boundary
 * the name is about. The top-right bracket is detached and sitting
 * outside the line. That is the product in one glyph: we trace the edge
 * of what a company exposes, and we show the piece that is on the wrong
 * side of it. The `perseus.de` scan finds fourteen of those.
 *
 * It is drawn on geometry, not on a grid of hand-placed points: brackets
 * span 5→19 of a 24 unit box with a 2 unit corner radius, and the loose
 * one is translated by a constant. That is why it stays legible at 16px
 * in a browser tab and at 40px in a header.
 *
 * The loose bracket takes its own colour so the idea survives being
 * printed in one ink — at favicon size the shift alone is too small to
 * read, and the colour break carries it.
 */
export function LogoMark({ className = '', stroke = 'currentColor', loose = stroke }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* The three corners that hold. */}
      <g stroke={stroke}>
        <path d="M10 5H7a2 2 0 0 0-2 2v3" />
        <path d="M5 14v3a2 2 0 0 0 2 2h3" />
        <path d="M14 19h3a2 2 0 0 0 2-2v-3" />
      </g>
      {/* The one that does not. Same path as the others, moved off the
          perimeter — never a different shape, or it stops reading as a
          piece of the same boundary. */}
      <path
        d="M14 5h3a2 2 0 0 1 2 2v3"
        stroke={loose}
        transform="translate(1.7 -1.7)"
      />
    </svg>
  );
}

/**
 * Mark plus wordmark, as used in the header.
 *
 * The strapline is part of the lockup rather than a separate line of page
 * copy: it is the one place the product says what it is, and on a route
 * like `/scan/perseus.de` a reader who arrived from a shared link has no
 * other way to find out.
 */
export default function Logo({ withStrapline = true }) {
  return (
    <span className="flex items-center gap-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-deep"
      >
        <LogoMark
          className="size-[22px]"
          stroke="var(--color-on-deep)"
          loose="var(--color-accent-on-deep)"
        />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
          Boundry
        </span>
        {withStrapline && (
          <span className="mt-1 hidden text-caption text-ink-faint sm:block">
            Cyber liability, priced on what an insurer can see
          </span>
        )}
      </span>
    </span>
  );
}
