import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

import { ax } from '../../utils/config';
import { fadeUp, stagger } from '../../utils/motion';
import RouteFallback from '../Extra/RouteFallback';
import ErrorNotice from '../Extra/ErrorNotice';

/**
 * Where every part of the product came from.
 *
 * Three tiers, ordered strongest first, and the weakest tier is rendered
 * in exactly the same type as the strongest. That is the whole design
 * decision here: a provenance section that lists only its good sources is
 * marketing with footnotes. The point values and the premium figures are
 * ours, nobody publishes a benchmark for either, and saying so in the
 * same list as the RFCs is what makes the rest of the list worth
 * anything.
 *
 * Served from `/api/methodology` rather than written into this file, so a
 * claim about provenance cannot drift away from the code it describes.
 * docs/defending-the-score.md, docs/policy-wording-evidence.md
 */
export default function ProvenanceContent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    ax.get('/methodology')
      .then((res) => live && setData(res.data))
      .catch(() => live && setError('We could not load this just now.'));
    return () => {
      live = false;
    };
  }, []);

  if (error) return <ErrorNotice message={error} />;
  if (!data) return <RouteFallback />;

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-4">
      <motion.p variants={fadeUp} className="max-w-prose text-sm leading-relaxed text-ink-muted">
        Some of what produces your grade is a published standard anyone can
        look up. Some of it we traced to a source document ourselves. Some of
        it is our own judgement. Those are three different things, and we have
        not seen a scoring product separate them — so here they are separated.
      </motion.p>

      {data.provenance?.tiers?.map((tier) => (
        <motion.div key={tier.id} variants={fadeUp}>
          <ProvenanceTier tier={tier} />
        </motion.div>
      ))}

      {data.provenance?.reviewed && (
        <motion.p variants={fadeUp} className="pt-1 text-xs text-ink-faint">
          Last reviewed {data.provenance.reviewed}. Scoring rules{' '}
          <span className="font-mono text-ink-muted">{data.rubric_version}</span>,
          rate card <span className="font-mono text-ink-muted">{data.rate_version}</span>.
        </motion.p>
      )}
    </motion.div>
  );
}

const TIER_STYLE = {
  standard: { dot: 'bg-pass', ring: 'border-pass/30', tint: 'bg-pass/5' },
  checked: { dot: 'bg-warn', ring: 'border-warn/30', tint: 'bg-warn/5' },
  judgement: { dot: 'bg-ink-faint', ring: 'border-line', tint: 'bg-canvas' },
};

function ProvenanceTier({ tier }) {
  const style = TIER_STYLE[tier.id] ?? TIER_STYLE.judgement;

  return (
    <div className={`overflow-hidden rounded-2xl border ${style.ring} ${style.tint}`}>
      <div className="border-b border-line/60 px-5 py-3.5">
        <p className="flex items-center gap-2 font-medium">
          <span className={`size-2 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
          {tier.label}
        </p>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-muted">
          {tier.blurb}
        </p>
      </div>

      <dl className="divide-y divide-line/60">
        {tier.entries.map((entry) => (
          <div key={entry.id} className="px-5 py-4">
            <dt className="font-medium">{entry.what}</dt>
            <dd className="mt-1 max-w-prose text-sm leading-relaxed text-ink-muted">
              {entry.detail}
            </dd>
            {entry.sources.length > 0 && (
              <dd className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                {entry.sources.map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-sm font-medium text-accent
                               underline-offset-2 hover:underline"
                  >
                    {source.label}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ))}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
