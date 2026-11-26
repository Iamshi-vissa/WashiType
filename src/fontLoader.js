// Loads Google Fonts stylesheets on demand. Requests made in the same tick are
// batched into one css2 URL so a screen of cards costs one request, not forty.
const requested = new Set();
let queue = [];
let timer = 0;

const familyParam = (family, weights, italic = false) => {
  const name = `family=${encodeURIComponent(family).replace(/%20/g, '+')}`;
  if (!weights) return name;
  if (!italic) return `${name}:wght@${weights.join(';')}`;
  const tuples = [...weights.map(w => `0,${w}`), ...weights.map(w => `1,${w}`)];
  return `${name}:ital,wght@${tuples.join(';')}`;
};

function flush() {
  timer = 0;
  const batch = queue.splice(0, queue.length);
  // Keep URLs well under browser limits.
  for (let i = 0; i < batch.length; i += 20) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${batch.slice(i, i + 20).join('&')}&display=swap`;
    document.head.appendChild(link);
  }
}

export function defaultWeight(font) {
  return font.w.includes(400) ? 400 : font.w[0];
}

/** Load one weight of a family (the one cards preview in). */
export function loadPreview(font) {
  const key = `${font.f}@preview`;
  if (requested.has(key)) return;
  requested.add(key);
  queue.push(familyParam(font.f, [defaultWeight(font)]));
  if (!timer) timer = setTimeout(flush, 60);
}

/** Load every weight of a family, for the specimen sheet. Resolves when the fonts are usable. */
export async function loadFamily(font) {
  const key = `${font.f}@all`;
  if (!requested.has(key)) {
    requested.add(key);
    queue.push(familyParam(font.f, font.w, !!font.i));
    flush();
  }
  try {
    await Promise.race([
      Promise.all(font.w.map(w => document.fonts.load(`${w} 40px "${font.f}"`))),
      new Promise(resolve => setTimeout(resolve, 4000))
    ]);
  } catch {
    /* the sheet still renders with fallback lettering */
  }
}

export const cssSnippet = font => {
  const href = `https://fonts.googleapis.com/css2?${familyParam(font.f, font.w, !!font.i)}&display=swap`;
  const fallback = { s: 'sans-serif', r: 'serif', d: 'sans-serif', h: 'cursive', m: 'monospace' }[font.c];
  return `<link rel="stylesheet" href="${href}">\n\n/* CSS */\nfont-family: "${font.f}", ${fallback};`;
};

export const googleUrl = font => `https://fonts.google.com/specimen/${encodeURIComponent(font.f).replace(/%20/g, '+')}`;
