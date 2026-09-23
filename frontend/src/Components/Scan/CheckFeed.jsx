import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectChecks, selectCompletedCount } from '../../Features/scanSlice';
import CheckRow from './CheckRow';
import CircularProgress from './CircularProgress';
import InfoTip from '../Extra/InfoTip';

/** The streaming feed.
 *
 *  Rows are seeded in display order and filled in place as results land,
 *  which is why the list never reorders even though the server streams in
 *  completion order. The list is a live region so a screen reader
 *  announces each result as it arrives rather than going silent for
 *  thirty seconds. */
export default function CheckFeed({ domain }) {
  const checks = useSelector(selectChecks);
  const done = useSelector(selectCompletedCount);
  const total = checks.length;
  const running = done < total;

  return (
    <section aria-labelledby="feed-heading">
      <div className="flex items-center gap-4">
        <CircularProgress done={done} total={total} />

        <div className="min-w-0">
          <h2 id="feed-heading" className="font-display text-h3">
            {running ? 'Checking' : 'Checked'}{' '}
            <span className="font-mono text-base">{domain}</span>
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-muted">
            {running
              ? 'Reading what your domain publishes publicly.'
              : `${total} checks complete.`}
            <InfoTip label="What this scan does and does not do">
              <span className="block">
                Every check reads only what your domain already publishes to the
                public internet — DNS records, your TLS certificate, your
                response headers, and public certificate transparency logs.
                Nothing is probed, port-scanned, fuzzed or logged into. It is the
                same information any visitor to your site can see.
              </span>
              {/* Volunteered, not buried. The grade measures a slice of a
                  company's security, and a reader who mistakes it for the
                  whole thing was misled by us, not by their own optimism. */}
              <span className="mt-2 block">
                That also means it cannot see most of what keeps a company safe:
                multi-factor authentication, backups, patching, or anything
                behind a login. A strong grade is not a clean bill of health.
              </span>
              <Link
                to="/methodology"
                className="mt-2 block font-medium text-accent underline-offset-2 hover:underline"
              >
                Every rule, and what we do not measure
              </Link>
            </InfoTip>
          </p>
        </div>
      </div>

      <ul
        // No overflow-hidden: a tip opened on the last row was being cut
        // off at the card's edge. The rounded corners hold without it —
        // the rows are separated by divide-y, not by a clipped background.
        className="mt-6 divide-y divide-line rounded-panel border border-line bg-surface"
        aria-live="polite"
        aria-busy={running}
      >
        {checks.map((check, index) => (
          <CheckRow key={check.id} check={check} index={index + 1} />
        ))}
      </ul>
    </section>
  );
}
