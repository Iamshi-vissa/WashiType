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
