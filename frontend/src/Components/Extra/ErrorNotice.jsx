import { AlertCircle } from 'lucide-react';

/** One error presentation for the whole app, so a rejected domain and a
 *  dropped connection look and behave the same. `onRetry` is optional —
 *  some errors (a free-mail domain) are not retryable, and offering a
 *  button that cannot help is worse than offering none. */
export default function ErrorNotice({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-fail" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-ink">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium hover:bg-raised"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
