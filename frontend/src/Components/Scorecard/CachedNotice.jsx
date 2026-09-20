import { RefreshCw } from 'lucide-react';
import { timeAgo } from '../../utils/format';

/** A cached result is never presented as live.
 *
 *  Showing stale findings as though they were current would be the one
 *  dishonest thing on the page, so the age is always stated and a
 *  re-check is always one click away. docs/database.md section 5 */
export default function CachedNotice({ ageSeconds, onRefresh }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-raised px-4 py-2 text-sm">
      <span className="text-ink-muted">Last checked {timeAgo(ageSeconds)}</span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 font-medium text-accent"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Check again
        </button>
      )}
    </div>
  );
}
