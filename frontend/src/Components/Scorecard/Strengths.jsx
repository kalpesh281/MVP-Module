import { Check } from 'lucide-react';

/** What they already do right.
 *
 *  Never omitted unless every check failed. A page that is only bad news
 *  gets closed; opening with three things they got right earns the
 *  attention the bad news needs. docs/education-layer.md */
export default function Strengths({ items }) {
  if (!items?.length) return null;

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-medium">What you already do right</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-ink-muted">
            <Check className="mt-0.5 size-4 shrink-0 text-pass" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
