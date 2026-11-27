// Loads font stylesheets on demand from whichever service hosts the font:
//   g  Google Fonts   fonts.googleapis.com (batched: one request per screen of cards)
//   fs Fontshare      api.fontshare.com    (one request per family)
//   o  Fontsource     cdn.jsdelivr.net/npm/@fontsource/<id>@5/<weight>.css (pinned to the major version)
const requested = new Set();
const queues = { g: [] };
let timer = 0;

const plus = name => encodeURIComponent(name).replace(/%20/g, '+');

const googleParam = (family, weights, italic = false) => {
  const name = `family=${plus(family)}`;
  if (!weights) return name;
  if (!italic) return `${name}:wght@${weights.join(';')}`;
  const tuples = [...weights.map(w => `0,${w}`), ...weights.map(w => `1,${w}`)];
  return `${name}:ital,wght@${tuples.join(';')}`;
};

// Fontshare numbers italics as weight + 1 (400 regular, 401 italic).
const fontshareParam = (slug, weights, italic = false) =>
  `f[]=${encodeURIComponent(slug)}@${[...weights, ...(italic ? weights.map(w => w + 1) : [])].join(',')}`;

const addStylesheet = (href, onError) => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  if (onError) link.onerror = () => (link.remove(), onError());
  document.head.appendChild(link);
};

const googleCss = params => `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;

// Google answers 400 for the whole request if any one family in it is unknown, so a failed
// batch is retried one family at a time: one bad entry can't blank twenty cards.
function addGoogleBatch(params) {
  addStylesheet(googleCss(params), params.length > 1 ? () => params.forEach(p => addGoogleBatch([p])) : undefined);
}

function flush() {
  timer = 0;
  // Keep URLs well under browser limits.
  const g = queues.g.splice(0);
  for (let i = 0; i < g.length; i += 20) addGoogleBatch(g.slice(i, i + 20));
}

const fontsourceCss = (font, weight, italic) =>
  `https://cdn.jsdelivr.net/npm/@fontsource/${font.pk}@5/${weight}${italic ? '-italic' : ''}.css`;

function request(font, weights, italic) {
  if (font.src === 'o') {
    for (const w of weights) {
      addStylesheet(fontsourceCss(font, w, false));
      if (italic) addStylesheet(fontsourceCss(font, w, true));
    }
    return;
  }
  if (font.src === 'fs') {
    addStylesheet(`https://api.fontshare.com/v2/css?${fontshareParam(font.slug, weights, italic)}&display=swap`);
    return;
  }
  queues.g.push(googleParam(font.f, weights, italic));
}

export function defaultWeight(font) {
  return font.w.includes(400) ? 400 : font.w[0];
}

/** Load one weight of a family (the one cards preview in). */
export function loadPreview(font) {
  const key = `${font.id}@preview`;
  if (requested.has(key)) return;
  requested.add(key);
  request(font, [defaultWeight(font)], false);
  if (!timer) timer = setTimeout(flush, 60);
}

/** Load every weight of a family, for the specimen sheet. Resolves when the fonts are usable. */
export async function loadFamily(font) {
  const key = `${font.id}@all`;
  if (!requested.has(key)) {
    requested.add(key);
    request(font, font.w, !!font.i);
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

const FALLBACK = { s: 'sans-serif', r: 'serif', d: 'sans-serif', h: 'cursive', m: 'monospace' };

export const cssSnippet = font => {
  const family = `font-family: "${font.f}", ${FALLBACK[font.c]};`;
  if (font.src === 'o') {
    return `/* Install */\nnpm install @fontsource/${font.pk}\n\n/* JavaScript */\nimport '@fontsource/${font.pk}';\n\n/* CSS */\n${family}`;
  }
  const href =
    font.src === 'fs'
      ? `https://api.fontshare.com/v2/css?${fontshareParam(font.slug, font.w, !!font.i)}&display=swap`
      : `https://fonts.googleapis.com/css2?${googleParam(font.f, font.w, !!font.i)}&display=swap`;
  return `<link rel="stylesheet" href="${href}">\n\n/* CSS */\n${family}`;
};

export const SOURCES = {
  g: { name: 'Google Fonts', short: 'Google Fonts' },
  fs: { name: 'Fontshare', short: 'Fontshare' },
  o: { name: 'Fontsource', short: 'Open source' }
};

/** The font's page on the service it comes from, where it can be downloaded. */
export const sourceUrl = font => {
  if (font.src === 'fs') return `https://www.fontshare.com/fonts/${encodeURIComponent(font.slug)}`;
  if (font.src === 'o') return `https://fontsource.org/fonts/${encodeURIComponent(font.pk)}`;
  return `https://fonts.google.com/specimen/${plus(font.f)}`;
};
