import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { ax, errorMessage } from '../utils/config';
import { CHECK_ORDER, CHECK_LABELS } from '../data/gradeMeta';

/**
 * The scan. One long-lived Server-Sent Events stream, not a request.
 *
 * Why this slice does not use `createAsyncThunk` for the scan itself:
 * a thunk resolves once, and this endpoint emits eight separate events
 * over up to thirty seconds. The feed filling in one row at a time is the
 * product's first moment of surprise — a founder watching a stranger's
 * software read their infrastructure live. Collapsing that into a single
 * resolved promise would throw away the thing that makes them read the
 * rest of the page. docs/education-layer.md section 7
 *
 * So the stream is driven imperatively by `startScan` and dispatches plain
 * actions as events arrive. The thunks below are for the ordinary
 * request/response endpoints.
 */

// Seeded before the first event so the list never appears empty and never
// reorders. Rows are filled in place as results land.
function pendingChecks() {
  return CHECK_ORDER.map((id) => ({
    id,
    label: CHECK_LABELS[id],
    status: 'pending',
    detail: '',
    evidence: {},
  }));
}

const initialState = {
  domain: '',
  status: 'idle', // idle | scanning | done | error
  checks: pendingChecks(),
  profile: null,
  result: null,
  cached: false,
  cacheAgeSeconds: 0,
  error: null,
  errorCode: null,
  startedAt: null,
};

export const fetchStoredScan = createAsyncThunk(
  'scan/fetchStored',
  async (scanId, { rejectWithValue }) => {
    try {
      const response = await ax.get(`/scan/${scanId}`);
      return response.data;
    } catch (error) {
      const code = error.response?.data?.code || 'network';
      return rejectWithValue({ code, message: errorMessage(code) });
    }
  },
);

export const reportCtaClick = createAsyncThunk(
  'scan/cta',
  async (scanId) => {
    // The Tier 0 → Tier 1 conversion event, and the single most important
    // number in the prototype's analytics. Deliberately fire-and-forget:
    // a failed analytics write must never block the user.
    try {
      await ax.post('/cta', { scan_id: scanId });
    } catch {
      /* ignored on purpose */
    }
    return scanId;
  },
);

const scanSlice = createSlice({
  name: 'scan',
  initialState,
  reducers: {
    scanStarted(state, action) {
      state.domain = action.payload;
      state.status = 'scanning';
      state.checks = pendingChecks();
      state.profile = null;
      state.result = null;
      state.cached = false;
      state.cacheAgeSeconds = 0;
      state.error = null;
      state.errorCode = null;
      state.startedAt = Date.now();
    },

    checkReceived(state, action) {
      const incoming = action.payload;
      const row = state.checks.find((check) => check.id === incoming.id);
      if (row) {
        // Filled in place — the list keeps its display order regardless of
        // which check happened to finish first.
        Object.assign(row, incoming, { status: incoming.status });
      } else {
        state.checks.push({ ...incoming });
      }
    },

    profileReceived(state, action) {
      state.profile = action.payload;
    },

    resultReceived(state, action) {
      const result = action.payload;
      state.result = result;
      state.cached = Boolean(result.cached);
      state.cacheAgeSeconds = result.cache_age_seconds || 0;
      state.status = 'done';
      if (result.profile) state.profile = result.profile;
      // A cached replay may carry findings rather than streamed checks.
      if (Array.isArray(result.findings) && result.findings.length) {
        for (const finding of result.findings) {
          const row = state.checks.find((check) => check.id === finding.id);
          if (row) Object.assign(row, finding);
        }
      }
    },

    scanFailed(state, action) {
      const { code, message } = action.payload || {};
      state.status = 'error';
      state.errorCode = code || 'internal';
      state.error = message || errorMessage(code);
      // Any check still pending when the stream dies is unknown, not passed.
      for (const check of state.checks) {
        if (check.status === 'pending') {
          check.status = 'inconclusive';
          check.detail = 'Did not complete';
        }
      }
    },

    scanReset() {
      return { ...initialState, checks: pendingChecks() };
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchStoredScan.pending, (state) => {
        state.status = 'scanning';
        state.error = null;
      })
      .addCase(fetchStoredScan.fulfilled, (state, action) => {
        const result = action.payload;
        state.domain = result.domain;
        state.result = result;
        state.profile = result.profile || null;
        state.cached = true;
        state.cacheAgeSeconds = result.cache_age_seconds || 0;
        state.status = 'done';
        state.checks = CHECK_ORDER.map((id) => {
          const finding = (result.findings || []).find((f) => f.id === id);
          return finding
            ? { ...finding, label: finding.label || CHECK_LABELS[id] }
            : { id, label: CHECK_LABELS[id], status: 'inconclusive', detail: '' };
        });
      })
      .addCase(fetchStoredScan.rejected, (state, action) => {
        state.status = 'error';
        state.errorCode = action.payload?.code || 'not_found';
        state.error = action.payload?.message || errorMessage('not_found');
      });
  },
});

export const {
  scanStarted,
  checkReceived,
  profileReceived,
  resultReceived,
  scanFailed,
  scanReset,
} = scanSlice.actions;

// --- selectors -----------------------------------------------------------

export const selectChecks = (state) => state.scan.checks;
export const selectResult = (state) => state.scan.result;
export const selectStatus = (state) => state.scan.status;
export const selectProfile = (state) => state.scan.profile;
export const selectIsScanning = (state) => state.scan.status === 'scanning';
export const selectCompletedCount = (state) =>
  state.scan.checks.filter((check) => check.status !== 'pending').length;

export default scanSlice.reducer;
