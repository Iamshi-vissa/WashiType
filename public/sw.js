// Washi Type service worker.
// Network first, always: online visitors get the newest deploy, never a stale copy.
// Each successful same-origin response is kept, so when the network is gone the site
// still opens from the copy and shows its "no signal" screen instead of the browser's
// "can't be reached" page.
const CACHE = 'washi-type-v1';
const SHELL = ['/', '/fonts.json', '/404.html', '/favicon.svg'];
const MAX_ENTRIES = 80; // old deploys' code files would otherwise pile up forever

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

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.type === 'basic') event.waitUntil(keep(request, response.clone()));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
        if (cached) return cached;
        // Any page while offline: open the app shell, which shows the no-signal screen.
        if (request.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
