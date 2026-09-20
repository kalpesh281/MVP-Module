import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import Scorecard from '../Components/Scorecard/Scorecard';
import ErrorNotice from '../Components/Extra/ErrorNotice';
import RouteFallback from '../Components/Extra/RouteFallback';
import { fetchStoredScan } from '../Features/scanSlice';

/** A shareable result: /s/scn_… backed by GET /api/scan/{scan_id}.
 *
 *  The founder forwards this to their CTO, and that forward is the
 *  cheapest distribution the product has. It must render without a scan
 *  running and without anything being asked of whoever opens it. */
export default function SharedScanPage() {
  const { scanId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const status = useSelector((state) => state.scan.status);
  const result = useSelector((state) => state.scan.result);
  const profile = useSelector((state) => state.scan.profile);
  const error = useSelector((state) => state.scan.error);

  useEffect(() => {
    if (scanId) dispatch(fetchStoredScan(scanId));
  }, [scanId, dispatch]);

  if (status === 'error') {
    return (
      <div className="space-y-5 py-6">
        <ErrorNotice message={error} />
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm font-medium text-accent"
        >
          Check a domain
        </button>
      </div>
    );
  }

  if (!result) return <RouteFallback />;

  // The feed is a step inside the report now, so rendering it here as
  // well would show the same seven checks twice.
  return (
    <Scorecard
      result={result}
      profile={profile}
      domain={result.domain}
      cached
      cacheAgeSeconds={result.cache_age_seconds}
    />
  );
}
