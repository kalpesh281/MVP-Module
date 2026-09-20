import axios from 'axios';

// Blank in development: vite.config.js proxies /api to the backend so the
// SSE stream stays same-origin. Set VITE_API_BASE_URL only when the API is
// deployed somewhere else.
const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

export const config = {
  baseUrl,
  api: `${baseUrl}/api`,
};

export const ax = axios.create({
  baseURL: config.api,
  timeout: 15000,
});

// Backend error codes, from tier-0-scorecard-spec.md section 7. Every one of
// them has a sentence a non-technical person can act on — "invalid_domain"
// on screen is a bug report, not a message.
export const ERROR_COPY = {
  invalid_domain: "That doesn't look like a domain. Try yourcompany.com.",
  domain_unresolvable: "We couldn't find that domain. Check the spelling?",
  free_mail_domain:
    "That's an email provider. Enter your company's own domain — the one on your website.",
  too_many_inconclusive:
    "We couldn't complete enough checks to grade this domain fairly. Try again in a minute.",
  rate_limited: "You've run a lot of scans in the last hour. Try again later.",
  not_found: "We couldn't find that scan. It may have expired.",
  internal: 'Something went wrong on our side. Please try again.',
  network: "We couldn't reach the scanner. Check your connection and try again.",
};

export function errorMessage(code, fallback) {
  return ERROR_COPY[code] || fallback || ERROR_COPY.internal;
}
