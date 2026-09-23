import { Download, Loader2 } from 'lucide-react';

/**
 * The one control on this page that produces something to send.
 *
 * It sits on the check-feed's header row rather than in the summary rail.
 * The rail carries the two live figures and the re-check, and all three of
 * those move when a fix is ticked; the report does not. Putting a static
 * action among moving numbers made it read as a fourth thing that might
 * change the price.
 *
 * On the feed header it lands beside "7 checks complete", which is the
 * moment the reader actually has something worth sending — and it is the
 * far end of the only full-width row on the page that was otherwise empty.
 *
 * Solid fill, because it is the only action here aimed at someone who is
 * not in the room. `Check again` next to it is an outline; two solid
 * buttons on one screen is two primary actions, which is none.
 */
export default function DownloadReport({ onDownload, downloading, error, disabled }) {
  if (!onDownload) return null;
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      {error && (
        <span className="hidden text-caption text-fail sm:inline" role="status">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading || disabled}
        aria-label="Download the full assessment as a PDF"
        title={disabled ? 'Available once every check has finished' : 'Download the full assessment as a PDF'}
        className="group inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2
                   text-sm font-medium text-white transition-colors hover:bg-ink/85
                   disabled:cursor-not-allowed disabled:bg-ink/25"
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download
            className="size-4 transition-transform group-hover:translate-y-0.5"
            aria-hidden="true"
          />
        )}
        <span className="hidden sm:inline">
          {downloading ? 'Preparing report' : 'Download report'}
        </span>
        <span className="sm:hidden">{downloading ? 'Preparing' : 'Report'}</span>
      </button>
    </span>
  );
}
