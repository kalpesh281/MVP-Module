/** Deliberately quiet.
 *
 *  The two claims that used to live here — what the scan does, and what
 *  the premium is worth — now sit beside the scan and beside the premium,
 *  where someone reading either will actually see them. A disclaimer at
 *  the bottom of a page is a disclaimer nobody reads. */
export default function Footer() {
  return (
    <footer>
      <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-5 py-5 text-xs text-ink-faint sm:px-8">
        <span>Passive checks only</span>
        <span aria-hidden="true">·</span>
        <span>Scoring rules v1.0 · Rate card v1.0</span>
        <span aria-hidden="true">·</span>
        <span>Premiums are estimates, not quotes</span>
      </div>
    </footer>
  );
}
