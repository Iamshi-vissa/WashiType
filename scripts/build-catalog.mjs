// Builds public/fonts.json from the google-font-metadata package.
// Run: npm run catalog
import { readFileSync, writeFileSync } from 'node:fs';

const dataDir = new URL('../node_modules/google-font-metadata/data/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, dataDir), 'utf8'));

const fonts = read('google-fonts-v1.json');
const licenses = read('licenses.json');
const variable = read('variable.json');

const LICENSE = {
  'SIL Open Font License, 1.1': 'OFL',
  'Apache License, Version 2.0': 'Apache',
  'Ubuntu Font License, 1.0': 'UFL'
};
const CATEGORY = { 'sans-serif': 's', serif: 'r', display: 'd', handwriting: 'h', monospace: 'm' };
// Scripts worth filtering by. Extended sets (latin-ext, cyrillic-ext ...) are folded into their parent.
const SCRIPTS = new Set([
  'latin', 'cyrillic', 'greek', 'vietnamese', 'arabic', 'hebrew', 'devanagari', 'bengali', 'tamil',
  'telugu', 'kannada', 'malayalam', 'gujarati', 'gurmukhi', 'oriya', 'sinhala', 'thai', 'khmer', 'lao',
  'japanese', 'korean', 'chinese-simplified', 'chinese-traditional', 'ethiopic', 'armenian', 'georgian'
]);

// Icon fonts are not text faces, so leave them out.
const rows = Object.values(fonts)
  .filter(font => !font.id.startsWith('material-'))
  .map(font => {
  const lic = licenses[font.id]?.license;
  const axes = variable[font.id]?.axes;
  const axisText = axes
    ? Object.entries(axes)
        .filter(([name]) => name !== 'ital')
        .map(([name, a]) => `${name} ${Number(a.min)}-${Number(a.max)}`)
    : [];
  return {
    f: font.family,
    id: font.id,
    c: CATEGORY[font.category] ?? 'd',
    w: font.weights,
    i: font.styles.includes('italic') ? 1 : 0,
    s: font.subsets.filter(s => SCRIPTS.has(s)),
    u: font.lastModified,
    l: lic ? LICENSE[lic.type] ?? lic.type : 'OFL',
    a: axisText
  };
});

rows.sort((a, b) => a.f.localeCompare(b.f));
writeFileSync('public/fonts.json', '[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
console.log(`Wrote ${rows.length} fonts to public/fonts.json`);
