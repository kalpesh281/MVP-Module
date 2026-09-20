import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import {
  checkReceived,
  profileReceived,
  resultReceived,
  scanFailed,
  scanStarted,
} from '../Features/scanSlice';
import { simulatorReset } from '../Features/simulatorSlice';
import { domainRemembered } from '../Features/uiSlice';
import { config, errorMessage } from '../utils/config';

/**
 * Opens the scan stream and dispatches each event as it arrives.
 *
 * `fetch` with a ReadableStream rather than `EventSource`, for two reasons
 * that both matter here:
 *
 *  1. **EventSource cannot read a status code.** A 400 for `gmail.com` and
 *     a 429 for rate limiting both surface as a bare `onerror` with no
 *     body. Recovering the real reason would mean re-requesting the same
 *     URL — which, for a valid domain, starts a second full scan and
 *     spends another slot against the user's hourly limit.
 *  2. **EventSource reconnects on its own.** After the backend closes a
 *     completed stream it would reopen it and scan again, which is both a
 *     wasted 30 seconds of someone's infrastructure and a wasted slot.
 *
 * The cost is parsing the SSE framing by hand, which is about fifteen
 * lines because the backend emits only `data:` frames.
 */

function parseFrames(buffer, onEvent) {
  // SSE frames are separated by a blank line. Anything after the last
  // separator is a partial frame and stays in the buffer.
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';

  for (const frame of parts) {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!data) continue;
    try {
      onEvent(JSON.parse(data));
    } catch {
      /* a frame we cannot parse is not worth failing the scan over */
    }
  }
  return remainder;
}

export function useScanStream() {
  const dispatch = useDispatch();
  const abortRef = useRef(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // A user who navigates away mid-scan must not leave the stream open. The
  // backend cancels its check workers when the client disconnects, and it
  // only learns about that if we actually close.
  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (domain, { refresh = false } = {}) => {
      stop();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch(scanStarted(domain));
      dispatch(simulatorReset());

      const params = new URLSearchParams({ domain });
      if (refresh) params.set('refresh', 'true');

      let settled = false;

      try {
        const response = await fetch(`${config.api}/scan?${params}`, {
          signal: controller.signal,
          headers: { Accept: 'text/event-stream' },
        });

        if (!response.ok) {
          // The whole reason for not using EventSource: a readable reason.
          const body = await response.json().catch(() => ({}));
          dispatch(
            scanFailed({
              code: body.code,
              message: body.message || errorMessage(body.code),
            }),
          );
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handle = (payload) => {
          switch (payload.type) {
            case 'check':
              dispatch(checkReceived(payload));
              break;
            case 'profile':
              dispatch(profileReceived(payload));
              break;
            case 'result':
              settled = true;
              dispatch(resultReceived(payload));
              dispatch(domainRemembered(domain));
              break;
            case 'error':
              settled = true;
              dispatch(
                scanFailed({
                  code: payload.code,
                  message: payload.message || errorMessage(payload.code),
                }),
              );
              break;
            default:
              break;
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer = parseFrames(buffer + decoder.decode(value, { stream: true }), handle);
        }
        // Flush whatever is left — the final frame may arrive without a
        // trailing blank line if the server closes immediately after it.
        parseFrames(`${buffer}\n\n`, handle);

        if (!settled) {
          dispatch(scanFailed({ code: 'internal', message: errorMessage('internal') }));
        }
      } catch (error) {
        // An abort is the user navigating away, not a failure to report.
        if (error?.name === 'AbortError') return;
        dispatch(scanFailed({ code: 'network', message: errorMessage('network') }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [dispatch, stop],
  );

  return { start, stop };
}
