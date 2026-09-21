import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ScrollText } from 'lucide-react';

import MethodologyContent from '../Components/Methodology/MethodologyContent';
import { fadeUp } from '../utils/motion';

/**
 * The published methodology, as a page.
 *
 * A public URL on purpose. The rubric is the thing we give away; the scan
 * history is the product. It stays a route even though the header opens
 * the same content in a dialog, because this is the link that gets pasted
 * into an email to a CTO.
 *
 * The content itself lives in `MethodologyContent` so that the page and
 * the dialog cannot disagree. docs/defending-the-score.md
 */
export default function MethodologyPage() {
  const [versions, setVersions] = useState(null);

  return (
    <div className="space-y-10 pb-4">
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted
                     transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Check a domain
        </Link>

        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          <ScrollText className="size-6 text-accent" aria-hidden="true" />
          How we score and price
        </h1>

        <p className="max-w-2xl leading-relaxed text-ink-muted">
          Every figure below is read live from the same tables that produced your
          grade — not copied here by hand.
          {versions && (
            <>
              {' '}Scoring rules{' '}
              <span className="font-mono text-[0.9em] text-ink">
                {versions.rubric_version}
              </span>{' '}
              and rate card{' '}
              <span className="font-mono text-[0.9em] text-ink">
                {versions.rate_version}
              </span>
              .
            </>
          )}
        </p>

        <p className="max-w-2xl text-sm leading-relaxed text-ink-faint">
          We publish this because an insurer will eventually have to accept these
          numbers, and no insurer grants underwriting authority to something it
          cannot inspect.
        </p>
      </motion.header>

      <MethodologyContent onVersions={setVersions} />
    </div>
  );
}
