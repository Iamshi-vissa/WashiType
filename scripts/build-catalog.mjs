// Builds public/fonts.json: every free font Washi Type can preview, from three sources.
//
//   Google Fonts          google-font-metadata package (npm)
//   Fontshare (ITF)       api.fontshare.com, falling back to data/fontshare.json
//   Open-source foundries Fontsource "other" fonts (Velvetyne, League of Moveable Type,
//                         and more), api.fontsource.org, falling back to data/fontsource-other.json
//
// Every font included is free for personal and commercial use.
// Run: npm run catalog          (snapshots only, works offline)
//      npm run catalog -- --live (refresh Fontshare and Fontsource from their APIs first)
import { readFileSync, writeFileSync } from 'node:fs';

const LIVE = process.argv.includes('--live');
const root = new URL('../', import.meta.url);
const readJSON = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

const familyKey = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- Google Fonts ----------
const gfData = 'node_modules/google-font-metadata/data/';
const gFonts = readJSON(gfData + 'google-fonts-v1.json');
const gLicenses = readJSON(gfData + 'licenses.json');
const gVariable = readJSON(gfData + 'variable.json');

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
  'japanese', 'korean', 'chinese-simplified', 'chinese-traditional', 'ethiopic', 'armenian', 'georgian'
]);

const google = Object.values(gFonts)
  // Icon fonts are not text faces, so leave them out.
  .filter(font => !font.id.startsWith('material-'))
  .map(font => {
    const lic = gLicenses[font.id]?.license;
    const axes = gVariable[font.id]?.axes;
    return {
      f: font.family,
      id: font.id,
      src: 'g',
      c: G_CATEGORY[font.category] ?? 'd',
      w: font.weights,
      i: font.styles.includes('italic') ? 1 : 0,
      s: font.subsets.filter(s => SCRIPTS.has(s)),
      u: font.lastModified,
      // null when Google Fonts has no license record for the family; the app links to Google instead.
      l: lic ? LICENSE[lic.type] ?? lic.type : null,
      a: axes
        ? Object.entries(axes)
            .filter(([name]) => name !== 'ital')
            .map(([name, a]) => `${name} ${Number(a.min)}-${Number(a.max)}`)
        : []
    };
  });

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
for (const f of await openSourceFonts()) {
  if (seen.has(familyKey(f.family))) continue; // already in Google Fonts
  seen.add(familyKey(f.family));
  const id = uniqueId(f.id, 'os');
  ids.add(id);
  others.push({
    f: f.family,
    id,
    src: 'o',
    pk: f.id, // npm: @fontsource/<pk>
    c: O_CATEGORY[f.category] ?? 'd',
    w: f.weights,
    i: f.styles.includes('italic') ? 1 : 0,
    s: f.subsets.filter(s => SCRIPTS.has(s)),
    u: f.lastModified ?? '',
    l: LICENSE[f.license?.type] ?? f.license?.type ?? null,
    lu: f.license?.url,
    by: f.license?.attribution,
    a: []
  });
}

const fontshare = [];
for (const f of await fontshareFonts()) {
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
writeFileSync(new URL('public/fonts.json', root), '[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
console.log(
  `Wrote ${rows.length} fonts: ${google.length} Google Fonts, ${fontshare.length} Fontshare, ${others.length} open-source foundries`
);
