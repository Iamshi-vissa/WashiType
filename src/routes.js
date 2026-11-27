// Every font has a real address: /fonts/<id>. Older #<id> links are moved there.
export const fontPath = id => `/fonts/${encodeURIComponent(id)}`;

/**
 * The font id in the current address.
 * Returns { id } for /fonts/<id>, { garbled: true } for an undecodable address, or null.
 */
export function readFontRoute(loc = window.location) {
  const match = loc.pathname.match(/^\/fonts\/([^/]+)\/?$/);
  const raw = match ? match[1] : null;
  if (!raw) return null;
  try {
    return { id: decodeURIComponent(raw) };
  } catch {
    return { garbled: true };
  }
}

/** Move an old #<id> link to /fonts/<id> without adding a history entry. Returns true if it did. */
export function upgradeHashLink(loc = window.location) {
  const raw = loc.hash.slice(1);
  if (!raw || loc.pathname !== '/') return false;
  let path;
  try {
    path = `/fonts/${encodeURIComponent(decodeURIComponent(raw))}`;
  } catch {
    path = `/fonts/${raw}`; // undecodable: keep it as is, it shows as a font that isn't found
  }
  history.replaceState(null, '', path);
  return true;
}

/** A font id turned back into words to search for: "comic-sans-pro" → "comic sans pro". */
export const searchTerm = id =>
  String(id ?? '')
    .replace(/[-_]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
    .slice(0, 40);

/** The address of the front page with a search filled in. */
export const searchPath = term => `/?q=${encodeURIComponent(term)}`;

/** The ?q= search in the address, if any. */
export const readSearchParam = (loc = window.location) => (new URLSearchParams(loc.search).get('q') ?? '').slice(0, 80);

/** Remove ?q= from the address once it has been read, so a reload doesn't bring it back. */
export function clearSearchParam(loc = window.location) {
  const params = new URLSearchParams(loc.search);
  if (!params.has('q')) return;
  params.delete('q');
  const rest = params.toString();
  history.replaceState(history.state, '', loc.pathname + (rest ? `?${rest}` : '') + loc.hash);
}
