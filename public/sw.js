// Washi Type service worker.
// Network first: online visitors get the newest deploy, never a stale copy. Each successful
// same-origin response is kept, so when the network is gone the site still opens from the
// copy and shows its "no signal" screen instead of the browser's "can't be reached" page.
// On a weak connection, pages and the font list fall back to the copy after 3.5 seconds
// (the network answer still refreshes the copy in the background).
const CACHE = 'washi-type-v3';
const SHELL = ['/', '/fonts.json', '/404.html', '/favicon.svg', '/theme.js'];
const MAX_ENTRIES = 80; // old deploys' code files would otherwise pile up forever
const SLOW_NETWORK_MS = 3500;
// After one timeout, assume the connection stays slow for a while and answer from the copy
// straight away (the network still refreshes it), so a page doesn't wait 3.5 s per request.
let slowUntil = 0;

// Mark answers that came from the saved copy, so the page can say so.
function fromCopy(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Washi-Copy', '1');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function keep(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  const keys = await cache.keys();
  const extra = keys.length - MAX_ENTRIES;
  // Oldest first; never drop the shell.
  for (const key of keys.slice(0, Math.max(0, extra))) {
    if (!SHELL.includes(new URL(key.url).pathname)) await cache.delete(key);
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts from CDNs go straight to the network
  if (url.pathname.startsWith('/api/')) return; // never cache the error-report endpoint

  const navigate = request.mode === 'navigate';
  const network = fetch(request).then(response => {
    if (response.ok && response.type === 'basic') return keep(request, response.clone()).then(() => response);
    return response;
  });
  // Let the network finish (and refresh the copy) even if the copy answered first.
  event.waitUntil(network.catch(() => {}));

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: navigate });
      // Pages and the font list: don't keep a visitor waiting on a weak connection.
      if (cached && (navigate || url.pathname === '/fonts.json')) {
        if (Date.now() < slowUntil) return fromCopy(cached);
        const timeout = new Promise(resolve => setTimeout(() => resolve(null), SLOW_NETWORK_MS));
        const fresh = await Promise.race([network.catch(() => null), timeout]);
        if (!fresh) slowUntil = Date.now() + 20000;
        return fresh || fromCopy(cached);
      }
      try {
        return await network;
      } catch {
        if (cached) return fromCopy(cached);
        // Any page while offline: open the app shell, which shows the no-signal screen.
        if (navigate) {
          const shell = await caches.match('/');
          if (shell) return fromCopy(shell);
        }
        return Response.error();
      }
    })()
  );
});
