/**
 * The Boundry mark.
 *
 * An asymmetric B: a solid stem with two counters, the lower one larger
 * than the upper. The counters are the whole idea — the small white one
 * on top, the large lime one below, so the letter reads as bottom-heavy
 * and the eye lands on the lime.
 *
 * **Drawn inline rather than loaded from `/logo.svg`.** The mark appears
 * in the header of every route, so an `<img>` would be a render-blocking
 * request on first paint for 576 bytes. Inline it also takes props, which
 * is what makes the reversed lockup below possible at all.
 *
 * `public/logo.svg` is kept in step by hand for anything outside React —
 * social cards, a deck, an email signature.
 *
 * **The colours are props, because one lockup does not survive a dark
 * background.** The body is `#0F0A0F`; on the deep surfaces this product
 * uses for its dark bands it disappears entirely and only the counters
 * show, which reads as two floating blobs rather than as a letter. The
 * reversed treatment — light body, upper counter knocked out in the
 * background colour — is drawn in `utils/pdf/Doc.js` for the report's
 * masthead. The lime never changes in either: it is the part of the mark
 * a reader will actually remember.
 *
 * The viewBox is tightened to the glyph. The source artwork draws a
 * 52x80 letter inside a 100x100 box, so more than half of it is empty
 * space; at a 16px favicon that padding cost about a third of the mark's
 * legible size.
 */

/* The artwork's own colours. Named here rather than in the theme because
   they belong to the mark, not to the interface — nothing else on the
   page is allowed to reach for them. The lime does get a theme token, for
   the one place the interface echoes it. */
const BODY = '#0F0A0F';
const COUNTER = '#FFFFFF';
const LIME = '#D4FF00';

export function LogoMark({
  className = '',
  body = BODY,
  counterTop = COUNTER,
  counterBottom = LIME,
}) {
  return (
    <svg
      viewBox="21 11 60 88"
      className={className}
      role="img"
      aria-label="Boundry"
    >
      {/* Stem and both lobes, as one filled path. */}
      <path
        d="M 25 15 H 55 A 18 18 0 0 1 73 33 A 18 18 0 0 1 55 51 A 22 22 0 0 1 77 73 A 22 22 0 0 1 55 95 H 25 Z"
        fill={body}
      />
      {/* Upper counter. Small, and the reason the letter reads as a B
          rather than as a bracket. */}
      <path
        d="M 40 30 H 50 A 6.5 6.5 0 0 1 56.5 36.5 A 6.5 6.5 0 0 1 50 43 H 40 Z"
        fill={counterTop}
      />
      {/* Lower counter. Deliberately much larger than the upper one. */}
      <path
        d="M 40 59 H 53 A 10.5 10.5 0 0 1 63.5 69.5 A 10.5 10.5 0 0 1 53 80 H 40 Z"
        fill={counterBottom}
      />
    </svg>
  );
}

/**
 * Mark plus wordmark, as used in the header.
 *
 * No tile behind it. The previous mark was a stroke that needed a filled
 * chip to sit on; this one is a solid letter and a box around it would be
 * a second shape competing with the first.
 *
 * The strapline is part of the lockup rather than a separate line of page
 * copy: it is the one place the product says what it is, and on a route
 * like `/scan/perseus.de` a reader who arrived from a shared link has no
 * other way to find out.
 */
export default function Logo({ withStrapline = true }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* Height-driven, width auto: the glyph is taller than it is wide,
          so sizing it on width would leave it shorter than the wordmark
          beside it. */}
      <LogoMark className="h-8 w-auto shrink-0" />
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
