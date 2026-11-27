// Sends errors from visitors' browsers to /api/report, where they land in the Vercel logs.
// Production only, at most 10 different errors per page view, never the same one twice.
const sent = new Set();

export function reportError(kind, error) {
  if (!import.meta.env.PROD) return;
  const message = String(error?.message || error || 'Unknown error').slice(0, 500);
  const key = `${kind}:${message}`;
  if (sent.has(key) || sent.size >= 10) return;
  sent.add(key);
  const payload = JSON.stringify({
    kind,
    message,
    stack: String(error?.stack || '').slice(0, 2000),
    page: location.pathname,
    release: __RELEASE__
  });
  try {
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/report', blob)) return;
  } catch {
    /* fall through to fetch */
  }
  fetch('/api/report', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(
    () => {}
  );
}

/** Report anything that slips past the error boundaries. */
export function watchForErrors() {
  window.addEventListener('error', event => reportError('uncaught', event.error || event.message));
  window.addEventListener('unhandledrejection', event => reportError('unhandled-promise', event.reason));
}
