// Builds public/fonts.json: every free font Washi Type can preview, from three sources.
//
//   Google Fonts          google-font-metadata's data files on jsDelivr, falling back to
//                         data/google-fonts.json
//   Fontshare (ITF)       api.fontshare.com, falling back to data/fontshare.json
//   Open-source foundries Fontsource "other" fonts (Velvetyne, League of Moveable Type,
//                         and more), api.fontsource.org, falling back to data/fontsource-other.json
//
// Every font included is free for personal and commercial use.
// Run: npm run catalog          (snapshots only, works offline)
//      npm run catalog -- --live (refresh every source from the network first)
//      npm run catalog -- --live --save-snapshot (also rewrite data/google-fonts.json)
import { readFileSync, writeFileSync } from 'node:fs';

const LIVE = process.argv.includes('--live');
const SAVE_SNAPSHOT = process.argv.includes('--save-snapshot');
const root = new URL('../', import.meta.url);
const readJSON = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

const familyKey = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
// Licence links come from third-party data: only keep plain web links.
const safeUrl = url => (typeof url === 'string' && /^https?:\/\//i.test(url) ? url : undefined);

// ---------- Google Fonts ----------
// The google-font-metadata project publishes Google's catalog as JSON files. Only the data is
// used (none of the package's code), so it isn't installed: the files are read from jsDelivr,
// pinned to the package's major version, with a trimmed snapshot in data/ as the fallback.
const GF_DATA = 'https://cdn.jsdelivr.net/npm/google-font-metadata@6/data/';

/** The fields this catalog needs, from google-font-metadata's three data files. */
function trimGoogle(fonts, licences, variable) {
  return Object.values(fonts).map(font => ({
    family: font.family,
    id: font.id,
    category: font.category,
    weights: font.weights,
    styles: font.styles,
    subsets: font.subsets,
    lastModified: font.lastModified,
    license: licences[font.id]?.license?.type ?? null,
    axes: Object.entries(variable[font.id]?.axes ?? {}).map(([name, a]) => [name, Number(a.min), Number(a.max)])
  }));
}

async function googleFontsData() {
  if (LIVE) {
    try {
      const [fonts, licences, variable] = await Promise.all(
        ['google-fonts-v1.json', 'licenses.json', 'variable.json'].map(file => fetchJSON(GF_DATA + file))
      );
      const trimmed = trimGoogle(fonts, licences, variable);
      if (trimmed.length > 1500) {
        console.log(`Google Fonts: ${trimmed.length} families from google-font-metadata on jsDelivr`);
        if (SAVE_SNAPSHOT) {
          const snapshot = { about: 'Trimmed from google-font-metadata data files (scripts/build-catalog.mjs).', date: new Date().toISOString().slice(0, 10), fonts: trimmed };
          writeFileSync(new URL('data/google-fonts.json', root), JSON.stringify(snapshot) + '\n');
          console.log('Google Fonts: snapshot saved to data/google-fonts.json');
        }
        return trimmed;
      }
    } catch (err) {
      console.warn(`Google Fonts: live data failed (${err.message}); using the snapshot`);
    }
  }
  return readJSON('data/google-fonts.json').fonts;
}

// google-font-metadata has no licence for ~150 families. The google/fonts repository keeps
// every family in a folder named after its licence (ofl/, apache/, ufl/); use that instead.
const licenceFolders = readJSON('data/google-licence-folders.json').families;
const FOLDER_LICENCE = name => licenceFolders[name.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? null;

const LICENSE = {
  'SIL Open Font License, 1.1': 'OFL',
  'Apache License, Version 2.0': 'Apache',
  'Ubuntu Font License, 1.0': 'UFL',
  'OFL-1.1': 'OFL',
  'Apache-2.0': 'Apache',
  'CC0-1.0': 'CC0',
  Unlicense: 'Unlicense',
  mit: 'MIT',
  MIT: 'MIT'
};
const G_CATEGORY = { 'sans-serif': 's', serif: 'r', display: 'd', handwriting: 'h', monospace: 'm' };
// Scripts worth filtering by. Extended sets (latin-ext, cyrillic-ext ...) are folded into their parent.
const SCRIPTS = new Set([
  'latin', 'cyrillic', 'greek', 'vietnamese', 'arabic', 'hebrew', 'devanagari', 'bengali', 'tamil',
  'telugu', 'kannada', 'malayalam', 'gujarati', 'gurmukhi', 'oriya', 'sinhala', 'thai', 'khmer', 'lao',
  'japanese', 'korean', 'chinese-simplified', 'chinese-traditional', 'ethiopic', 'armenian', 'georgian', 'myanmar'
]);
// Fonts with none of the scripts above still need something to preview in.
const SAMPLE_ONLY = new Set(['emoji', 'lycian']);

const google = (await googleFontsData())
  // Icon fonts are not text faces, so leave them out.
  .filter(font => font?.id && !font.id.startsWith('material-'))
  .map(font => ({
    f: font.family,
    id: font.id,
    src: 'g',
    c: G_CATEGORY[font.category] ?? 'd',
    w: font.weights,
    i: font.styles.includes('italic') ? 1 : 0,
    s: font.subsets.filter(s => SCRIPTS.has(s)),
    x: font.subsets.some(s => SCRIPTS.has(s)) ? undefined : font.subsets.find(s => SAMPLE_ONLY.has(s)),
    u: font.lastModified,
    // Still null for a handful of new families; the app then links to Google Fonts instead.
    l: font.license ? LICENSE[font.license] ?? font.license : FOLDER_LICENCE(font.family),
    a: font.axes.filter(([name]) => name !== 'ital').map(([name, min, max]) => `${name} ${min}-${max}`)
  }));

// ---------- Fontshare ----------
const FS_CATEGORY = { sans: 's', serif: 'r', slab: 'r', display: 'd', script: 'h', handwritten: 'h', blackletter: 'd' };
const fsCategory = (category, name) => {
  if (/\bmono\b/i.test(name)) return 'm';
  const first = String(category || 'Sans').split(',')[0].trim().toLowerCase();
  return FS_CATEGORY[first] ?? 's';
};

async function fontshareFonts() {
  if (LIVE) {
    try {
      const data = await fetchJSON('https://api.fontshare.com/v2/fonts');
      const fonts = data.fonts.map(f => {
        const statics = f.styles.filter(s => !s.is_variable);
        const weights = [...new Set(statics.map(s => s.weight?.weight ?? s.weight?.number).filter(Boolean))].sort((a, b) => a - b);
        return {
          name: f.name,
          slug: f.slug,
          category: f.category,
          weights: weights.length ? weights : [400],
          italic: statics.some(s => s.is_italic),
          script: f.script,
          designers: (f.designers || []).map(d => d.name).filter(Boolean),
          inserted: f.inserted_at?.slice(0, 10) ?? '',
          variable: f.styles.some(s => s.is_variable)
        };
      });
      if (fonts.length > 50) {
        console.log(`Fontshare: ${fonts.length} fonts from the live API`);
        return fonts;
      }
    } catch (err) {
      console.warn(`Fontshare: live API failed (${err.message}); using the snapshot`);
    }
  }
  return readJSON('data/fontshare.json').fonts;
}

// ---------- Fontsource "other" (independent open-source foundries) ----------
async function openSourceFonts() {
  const snapshot = readJSON('data/fontsource-other.json').fonts;
  if (LIVE) {
    try {
      const list = await fetchJSON('https://api.fontsource.org/v1/fonts?type=other');
      const byId = new Map(snapshot.map(f => [f.id, f]));
      const fonts = list.map(f => ({
        ...f,
        license: byId.get(f.id)?.license ?? { type: f.license },
        source: byId.get(f.id)?.source
      }));
      if (fonts.length > 50) {
        console.log(`Fontsource: ${fonts.length} open-source fonts from the live API`);
        return fonts;
      }
    } catch (err) {
      console.warn(`Fontsource: live API failed (${err.message}); using the snapshot`);
    }
  }
  return snapshot;
}

const O_CATEGORY = { 'sans-serif': 's', serif: 'r', display: 'd', handwriting: 'h', monospace: 'm', other: 'd' };

const seen = new Set(google.map(f => familyKey(f.f)));
const ids = new Set(google.map(f => f.id));
const uniqueId = (id, prefix) => (ids.has(id) ? `${prefix}-${id}` : id);

const others = [];
// The language subset each open-source font's files are cut for (one each), for downloads.
const otherSubset = {};
for (const f of await openSourceFonts()) {
  // One malformed entry from a live API must not fail the deploy: skip it.
  if (!f?.family || !f.id || !Array.isArray(f.weights) || !f.weights.length) continue;
  if (seen.has(familyKey(f.family))) continue; // already in Google Fonts
  seen.add(familyKey(f.family));
  const id = uniqueId(f.id, 'os');
  ids.add(id);
  otherSubset[id] = f.subsets?.length === 1 ? f.subsets[0] : null;
  others.push({
    f: f.family,
    id,
    src: 'o',
    pk: f.id, // npm: @fontsource/<pk>
    c: O_CATEGORY[f.category] ?? 'd',
    w: f.weights,
    i: (f.styles || []).includes('italic') ? 1 : 0,
    s: (f.subsets || ['latin']).filter(s => SCRIPTS.has(s)),
    u: f.lastModified ?? '',
    l: LICENSE[f.license?.type] ?? f.license?.type ?? null,
    lu: safeUrl(f.license?.url),
    by: f.license?.attribution,
    a: []
  });
}

const fontshare = [];
for (const f of await fontshareFonts()) {
  if (!f?.name || !f.slug || !Array.isArray(f.weights) || !f.weights.length) continue;
  // Fontshare also hosts some Google fonts (Poppins, Lora ...); keep the Google copy.
  if (seen.has(familyKey(f.name))) continue;
  seen.add(familyKey(f.name));
  const id = uniqueId(f.slug.toLowerCase(), 'fontshare');
  ids.add(id);
  fontshare.push({
    f: f.name,
    id,
    src: 'fs',
    slug: f.slug,
    c: fsCategory(f.category, f.name),
    w: f.weights,
    i: f.italic ? 1 : 0,
    s: [f.script && SCRIPTS.has(f.script) ? f.script : 'latin'],
    u: f.inserted ?? '',
    l: 'ITF',
    by: f.designers?.join(', ') || 'Indian Type Foundry',
    a: f.variable ? ['variable'] : []
  });
}

const rows = [...google, ...others, ...fontshare].sort((a, b) => a.f.localeCompare(b.f));

// Fail the build rather than ship a broken catalog.
const problems = [];
const allIds = new Set();
for (const r of rows) {
  if (allIds.has(r.id)) problems.push(`duplicate id ${r.id}`);
  allIds.add(r.id);
  if (!r.f || !r.id || !['g', 'fs', 'o'].includes(r.src)) problems.push(`bad row ${JSON.stringify(r).slice(0, 80)}`);
  if (!r.w.every(w => Number.isInteger(w) && w >= 1 && w <= 1000)) problems.push(`bad weights for ${r.f}`);
  if (!'srdhm'.includes(r.c) || r.c.length !== 1) problems.push(`bad category for ${r.f}`);
}
if (google.length < 1500) problems.push(`only ${google.length} Google fonts`);
if (problems.length) {
  console.error('Catalog check failed:\n  ' + problems.slice(0, 20).join('\n  '));
  process.exit(1);
}
writeFileSync(new URL('public/fonts.json', root), '[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
console.log(
  `Wrote ${rows.length} fonts: ${google.length} Google Fonts, ${fontshare.length} Fontshare, ${others.length} open-source foundries`
);

// ---------- Downloads ----------
// public/downloads.json, fetched when someone clicks "Download font": where each font's
// desktop files are. Google Fonts: the TTF/OTF files in github.com/google/fonts at the commit
// data/google-files.json was read from. Open-source foundries: Fontsource's TTF per weight and
// style (each of these fonts has a single language subset, so that file is the whole font).
// Fontshare isn't listed: its licence asks for downloads to come from fontshare.com.
const googleFiles = readJSON('data/google-files.json');
const downloads = { google: `https://raw.githubusercontent.com/google/fonts/${googleFiles.commit}/`, g: {}, o: {} };
for (const font of google) {
  const family = googleFiles.families[familyKey(font.f)];
  if (family) downloads.g[font.id] = [`${family.folder}/${familyKey(font.f)}`, family.licence, ...family.fonts];
}
for (const font of others) if (otherSubset[font.id]) downloads.o[font.id] = otherSubset[font.id];
writeFileSync(new URL('public/downloads.json', root), JSON.stringify(downloads) + '\n');
const missing = google.length - Object.keys(downloads.g).length;
console.log(
  `Downloads: ${Object.keys(downloads.g).length} Google families, ${Object.keys(downloads.o).length} open-source fonts` +
    (missing ? ` (${missing} Google families not in the google/fonts snapshot link to Google Fonts)` : '')
);
