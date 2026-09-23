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
      // Capped, not full-width. The page measure is 80rem so that the
      // layout can use the screen — but a single text field stretched to
      // 1,100px looks like a search bar for a database, and the eye has no
      // idea how much it is expected to type. A domain is short; the field
      // should look like it is expecting a short thing.
      className="w-full max-w-xl"
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
          className="min-w-0 flex-1 rounded-card border border-line-strong bg-surface px-4 py-2.5
                     text-[15px] transition-colors placeholder:text-ink-faint
                     hover:border-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!ready}
          // 0.4 opacity made the page's only call to action look broken on
          // arrival — the first thing a visitor sees was a greyed-out button.
          // Disabled still has to read as "not yet", not as "failed".
          // Tight padding, like every button measured across this category
          // — Corgi's are 8px/16px at 37px tall. A chunky button beside a
          // slim field reads as two unrelated controls.
          //
          // Disabled is a muted ink, not 40% opacity: the page's only call
          // to action used to arrive looking broken rather than looking
          // like it was waiting for you.
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-card
                     bg-accent px-4 py-2.5 text-[15px] font-medium text-white
                     transition-colors duration-200 hover:bg-accent-hover
                     disabled:cursor-not-allowed disabled:bg-ink/20"
        >
          {busy ? 'Checking…' : 'Check'}
          {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
        </button>
      </div>
      <p className="mt-2.5 text-caption text-ink-faint">
        No sign-up. No email. We only read what your domain already publishes.
      </p>
    </form>
  );
}
