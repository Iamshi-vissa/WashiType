// Loads font stylesheets on demand from whichever service hosts the font:
//   g  Google Fonts   fonts.googleapis.com (batched: one request per screen of cards)
//   fs Fontshare      api.fontshare.com    (one request per family)
//   o  Fontsource     cdn.jsdelivr.net/npm/@fontsource/<id>@5/<weight>.css (pinned to the major version)
const requested = new Set();
// Fonts whose stylesheet failed to load: waiting for them is pointless.
const failed = new Set();
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
  addStylesheet(googleCss(params), () =>
    params.length > 1 ? params.forEach(p => addGoogleBatch([p])) : failed.add(params[0].split(':')[0])
  );
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
  const fail = () => failed.add(`family=${plus(font.f)}`);
  if (font.src === 'o') {
    for (const w of weights) {
      addStylesheet(fontsourceCss(font, w, false), fail);
      if (italic) addStylesheet(fontsourceCss(font, w, true));
    }
    return;
  }
  if (font.src === 'fs') {
    addStylesheet(`https://api.fontshare.com/v2/css?${fontshareParam(font.slug, weights, italic)}&display=swap`, fail);
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

/** Whether a FontFace weight ("700", or "100 900" for a variable font) includes `weight`. */
const coversWeight = (faceWeight, weight) => {
  const [lo, hi = lo] = String(faceWeight)
    .split(/\s+/)
    .map(w => (w === 'normal' ? 400 : w === 'bold' ? 700 : Number(w)));
  return weight >= lo && weight <= hi;
};

/**
 * Load one weight of a family and wait for it (the font detector draws candidates with it).
 * Resolves true when the font is ready to draw with, false if it didn't arrive in time.
 */
export async function loadWeight(font, weight, timeout = 5000) {
  const key = `${font.id}@${weight}`;
  if (!requested.has(key) && !requested.has(`${font.id}@all`)) {
    requested.add(key);
    request(font, [weight], false);
    flush();
  }
  // fonts.load resolves with the faces it loaded: none means the stylesheet hasn't defined the
  // font (yet), and fonts.check would wrongly say yes to a font it has never heard of.
  const spec = `${weight} 40px "${font.f}"`;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (failed.has(`family=${plus(font.f)}`)) return false;
    try {
      const faces = await Promise.race([document.fonts.load(spec), new Promise(r => setTimeout(() => r(null), 1500))]);
      // The face must be this weight: with only the regular loaded so far, the browser hands
      // back the regular and would fake the bold by thickening it.
      if (faces?.some(face => coversWeight(face.weight, weight))) return true;
    } catch {
      return false;
    }
    await new Promise(r => setTimeout(r, 150)); // the stylesheet may still be on its way
  }
  return false;
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
