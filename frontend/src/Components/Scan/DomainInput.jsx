import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { tidyDomain } from '../../utils/format';

/** The only thing we ask for, ever.
 *
 *  No email, no signup, no "get your free report" gate. Tier 0 gives
 *  before it asks — that principle is the product's whole opening move,
 *  and this field is where it is either honoured or broken.
 *  docs/education-layer.md */
export default function DomainInput({ onSubmit, autoFocus = false, busy = false }) {
  const [value, setValue] = useState('');
  const cleaned = tidyDomain(value);
  const ready = cleaned.includes('.') && !busy;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit(cleaned);
      }}
      className="w-full"
    >
      <label htmlFor="domain" className="sr-only">
        Your company domain
      </label>
      {/* Stacks on a narrow phone rather than squeezing — at 320px a
          side-by-side field and button leaves room for neither. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="domain"
          name="domain"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoFocus={autoFocus}
          spellCheck="false"
          autoCapitalize="none"
          placeholder="yourcompany.com"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-4 py-3 text-base
                     placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!ready}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3
                     font-medium text-white transition-colors hover:bg-accent-hover
                     disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Check my domain'}
          {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-faint">
        No sign-up. No email. We only read what your domain already publishes.
      </p>
    </form>
  );
}
