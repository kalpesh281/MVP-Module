import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Layout from './Components/Layout/Layout';
import ErrorBoundary from './Components/Extra/ErrorBoundary';
import RouteFallback from './Components/Extra/RouteFallback';

// Lazily loaded so the landing page — the only thing most visitors ever
// see — ships as little JavaScript as possible. The domain field has to be
// interactive fast; everything behind it can arrive while they type.
const HomePage = lazy(() => import('./Pages/HomePage'));
const ScanPage = lazy(() => import('./Pages/ScanPage'));
const SharedScanPage = lazy(() => import('./Pages/SharedScanPage'));
const MethodologyPage = lazy(() => import('./Pages/MethodologyPage'));
const NotFoundPage = lazy(() => import('./Pages/NotFoundPage'));

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/scan/:domain" element={<ScanPage />} />
              {/* Shareable result URL, backed by GET /api/scan/{scan_id} */}
              <Route path="/s/:scanId" element={<SharedScanPage />} />
              {/* Public on purpose: the rubric is the thing we give
                  away, the scan history is the product. */}
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </Router>
  );
}
