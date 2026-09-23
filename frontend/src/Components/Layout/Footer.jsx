import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ax } from '../../utils/config';

/** Deliberately quiet.
 *
 *  The two claims that used to live here — what the scan does, and what
 *  the premium is worth — now sit beside the scan and beside the premium,
 *  where someone reading either will actually see them. A disclaimer at
 *  the bottom of a page is a disclaimer nobody reads.
 *
 *  What stays is the pair of version numbers, and they are fetched rather
 *  than typed: written as literal text they read "Rate card v1.0" for
 *  three weeks after the rate card became v1.1, which is the one thing a
 *  version number must never do. */
export default function Footer() {
  const [versions, setVersions] = useState(null);

  useEffect(() => {
    let live = true;
    ax.get('/config')
      .then((res) => {
        if (!live) return;
        // Both or neither. An older backend — or one mid-deploy — answers
        // this endpoint without `rate_version`, and rendering the field
        // straight from the response put the literal word "undefined" on
        // every page of the product. A version we cannot read is a version
        // we do not print.
        const { rubric_version: rubric, rate_version: rate } = res.data || {};
        if (rubric && rate) setVersions({ rubric, rate });
      })
      // A footer is not worth an error state. If it cannot load, it says
      // less rather than saying something wrong.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <footer className="mt-auto border-t border-line">
      <div className="shell flex flex-wrap items-center gap-x-2 gap-y-1 py-6 text-caption text-ink-faint">
        <span>Passive checks only</span>
        <span aria-hidden="true">·</span>
        <Link to="/methodology" className="underline-offset-2 transition-colors hover:text-ink-muted hover:underline">
          {versions
            ? `Scoring rules ${versions.rubric} · Rate card ${versions.rate}`
            : 'How we score and price'}
        </Link>
        <span aria-hidden="true">·</span>
        <span>Premiums are estimates, not quotes</span>
      </div>
    </footer>
  );
}
