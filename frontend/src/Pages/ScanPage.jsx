import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

import CheckFeed from '../Components/Scan/CheckFeed';
import Scorecard from '../Components/Scorecard/Scorecard';
import ErrorNotice from '../Components/Extra/ErrorNotice';
import { useScanStream } from '../hooks/useScanStream';
import { tidyDomain } from '../utils/format';

/** Not retryable: re-running the same scan cannot change the answer, and
 *  offering a button that cannot help is worse than offering none. */
const TERMINAL = new Set(['free_mail_domain', 'invalid_domain']);

export default function ScanPage() {
  const { domain: raw } = useParams();
  const domain = tidyDomain(raw);
  const navigate = useNavigate();
  const { start } = useScanStream();

  /** An explicit re-run — the retry button and "check again". The ref
   *  guard only exists to stop *automatic* duplicate starts; a user
   *  asking for the same domain again must always be honoured. */
  const restart = (options) => {
    startedFor.current = domain;
    start(domain, options);
  };

  // Which domain we have already kicked off, as a ref rather than a
  // selector.
  //
  // React 19's StrictMode invokes effects twice in development, and the
  // obvious guard — comparing against the domain in the store — reads a
  // value captured in the render closure, which is still the *old* domain
  // on the second invocation. The effect therefore fires twice: two full
  // thirty-second scans of someone's infrastructure, and two slots off
  // their hourly rate limit, for one page load. Observed as a pair of 429s
  // from a single navigation.
  //
  // A ref is written synchronously and survives the re-invocation, so the
  // second call sees it and stops.
  const startedFor = useRef(null);

  const status = useSelector((state) => state.scan.status);
  const result = useSelector((state) => state.scan.result);
  const profile = useSelector((state) => state.scan.profile);
  const cached = useSelector((state) => state.scan.cached);
  const cacheAge = useSelector((state) => state.scan.cacheAgeSeconds);
  const error = useSelector((state) => state.scan.error);
  const errorCode = useSelector((state) => state.scan.errorCode);

  useEffect(() => {
    if (!domain || startedFor.current === domain) return undefined;
    startedFor.current = domain;
    start(domain);

    // The cleanup has to release the guard, and this is load-bearing
    // rather than tidiness. StrictMode runs mount -> cleanup -> mount in
    // development; the cleanup inside useScanStream aborts the in-flight
    // request, so without releasing the guard here the second mount skips
    // the restart and the page sits on "Checking" forever with no error —
    // an AbortError is deliberately silent. Releasing it means exactly one
    // scan survives the double mount, which is what we want in both
    // development and production.
    return () => {
      startedFor.current = null;
    };
    // Keyed on the domain alone: re-running whenever `start` changes
    // identity would restart the scan mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  if (status === 'error') {
    return (
      <div className="space-y-5 py-6">
        <ErrorNotice
          message={error}
          onRetry={TERMINAL.has(errorCode) ? undefined : () => restart()}
        />
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm font-medium text-accent"
        >
          Try a different domain
        </button>
      </div>
    );
  }

  // While the scan streams, the feed is the page. Once the result lands
  // the report takes over and the feed becomes one of its steps — still
  // there, still the evidence behind the grade, no longer the thing a
  // reader has to scroll past to reach the answer they came for.
  if (!result) {
    return (
      <div className="space-y-8">
        <CheckFeed domain={domain} />
      </div>
    );
  }

  return (
    <Scorecard
      result={result}
      profile={profile}
      domain={domain}
      cached={cached}
      cacheAgeSeconds={cacheAge}
      onRefresh={() => restart({ refresh: true })}
    />
  );
}
