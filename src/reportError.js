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
  // fetch with keepalive survives the page closing, like sendBeacon, and works the same in
  // every browser; sendBeacon is the fallback for browsers that refuse it.
  fetch('/api/report', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(
    () => {
      try {
        navigator.sendBeacon?.('/api/report', new Blob([payload], { type: 'application/json' }));
      } catch {
        /* nothing else to try */
      }
    }
  );
}

/** Report anything that slips past the error boundaries. */
export function watchForErrors() {
  window.addEventListener('error', event => reportError('uncaught', event.error || event.message));
  window.addEventListener('unhandledrejection', event => reportError('unhandled-promise', event.reason));
}
