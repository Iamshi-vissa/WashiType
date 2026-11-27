// Builds public/font-index.bin, the font detector's shape index: for each font in
// public/fonts.json, its regular (and bold) letters measured from the font file itself.
// See src/detect/fontIndex.js for what is stored.
//
// Run: npm run font-index             add fonts missing from the index (fast when few are)
//      npm run font-index -- --rebuild  measure every font again
//
// Font files (the Latin subset is enough: the detector reads Latin letters):
//   Google Fonts, other foundries   Fontsource's files on GitHub, then jsDelivr
//   Fontshare                       its CSS API, which links the WOFF2 files
// A font that can't be fetched is left out and tried again next run; the build carries on.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as fontkit from 'fontkit';
import {
  CHARS,
  STEM_CAPS,
  STEM_CAP_AT,
  STEM_LOWER,
  STEM_LOWER_AT,
  encodeRecord,
  median,
  packIndex,
  readIndexEntries,
  runsAt,
  twinGroups
} from '../src/detect/fontIndex.js';

const root = new URL('../', import.meta.url);
const OUT = new URL('public/font-index.bin', root);
const REBUILD = process.argv.includes('--rebuild');
const QUIET = process.argv.includes('--quiet');
const CONCURRENCY = 24;

const fonts = JSON.parse(readFileSync(new URL('public/fonts.json', root), 'utf8'));
const downloads = JSON.parse(readFileSync(new URL('public/downloads.json', root), 'utf8'));

/** Regular: the weight nearest 400. Bold: 700, or the nearest from 600 up, if different. */
function pickWeights(weights) {
  const regular = [...weights].sort((a, b) => Math.abs(a - 400) - Math.abs(b - 400) || a - b)[0];
  const heavy = weights.filter(w => w >= 600 && w !== regular);
  const bold = heavy.length ? heavy.sort((a, b) => Math.abs(a - 700) - Math.abs(b - 700))[0] : null;
  return bold ? [regular, bold] : [regular];
}

const FONT_FILES = 'https://raw.githubusercontent.com/fontsource/font-files/main/fonts';
function urlsFor(font, weight) {
  if (font.src === 'g') {
    if (!font.s.includes('latin')) return [];
    // A few families (Molle) exist only in italic.
    return ['normal', 'italic'].flatMap(style => [
      `${FONT_FILES}/google/${font.id}/files/${font.id}-latin-${weight}-${style}.woff2`,
      `https://cdn.jsdelivr.net/fontsource/fonts/${font.id}@latest/latin-${weight}-${style}.woff2`
    ]);
  }
  if (font.src === 'o') {
    const subset = downloads.o[font.id];
    if (!subset) return [];
    return ['normal', 'italic'].flatMap(style => [
      `${FONT_FILES}/other/${font.pk}/files/${font.pk}-${subset}-${weight}-${style}.woff2`,
      `https://cdn.jsdelivr.net/fontsource/fonts/${font.pk}@latest/${subset}-${weight}-${style}.woff2`
    ]);
  }
  if (font.src === 'fs') return [{ fontshare: `https://api.fontshare.com/v2/css?f[]=${font.slug}@${weight}&display=swap` }];
  return [];
}

async function fetchBytes(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchFont(font, weight) {
  for (const source of urlsFor(font, weight)) {
    try {
      if (typeof source === 'string') return await fetchBytes(source);
      // Fontshare: the CSS names the font files; take the WOFF2.
      const css = await (await fetch(source.fontshare, { signal: AbortSignal.timeout(20000) })).text();
      const match = css.match(/url\(['"]?((?:https?:)?\/\/[^'")]+\.woff2)['"]?\)/);
      if (match) return await fetchBytes(match[1].startsWith('//') ? `https:${match[1]}` : match[1]);
    } catch {
      /* try the next source */
    }
  }
  return null;
}

/** A glyph's outline as polygons in em, curves flattened. */
function polygons(glyph, upm) {
  const out = [];
  let poly = null;
  let x = 0;
  let y = 0;
  const add = (px, py) => poly.push([px / upm, py / upm]);
  const STEPS = 8;
  for (const { command, args } of glyph.path.commands) {
    if (command === 'moveTo') {
      if (poly?.length > 2) out.push(poly);
      poly = [];
      [x, y] = args;
      add(x, y);
    } else if (command === 'lineTo') {
      [x, y] = args;
      add(x, y);
    } else if (command === 'quadraticCurveTo') {
      const [cx, cy, ex, ey] = args;
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        const u = 1 - t;
        add(u * u * x + 2 * u * t * cx + t * t * ex, u * u * y + 2 * u * t * cy + t * t * ey);
      }
      [x, y] = [ex, ey];
    } else if (command === 'bezierCurveTo') {
      const [c1x, c1y, c2x, c2y, ex, ey] = args;
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        const u = 1 - t;
        add(
          u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
          u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey
        );
      }
      [x, y] = [ex, ey];
    }
  }
  if (poly?.length > 2) out.push(poly);
  return out;
}

function measure(bytes) {
  const font = fontkit.create(Buffer.from(bytes));
  const upm = font.unitsPerEm;
  const outlines = {};
  const glyphs = [...CHARS].map(ch => {
    const glyph = font.glyphForCodePoint(ch.codePointAt(0));
    if (!glyph || glyph.id === 0 || !glyph.path.commands.length) return null;
    const { minX, minY, maxX, maxY } = glyph.bbox;
    outlines[ch] = glyph;
    return { adv: glyph.advanceWidth / upm, x0: minX / upm, x1: maxX / upm, y0: minY / upm, y1: maxY / upm };
  });
  const byChar = Object.fromEntries([...CHARS].map((ch, i) => [ch, glyphs[i]]));
  const xHeight = byChar.x?.y1 || byChar.z?.y1 || byChar.o?.y1;
  const capHeight = byChar.H?.y1 || byChar.I?.y1 || byChar.E?.y1;
  const stem = (letters, height) =>
    height
      ? median(
          [...letters].filter(ch => outlines[ch]).flatMap(ch => runsAt(polygons(outlines[ch], upm), height))
        )
      : null;
  return {
    glyphs,
    stemLower: stem(STEM_LOWER, xHeight * STEM_LOWER_AT),
    stemCap: stem(STEM_CAPS, capHeight * STEM_CAP_AT)
  };
}

// Keep what's already measured, unless rebuilding.
const known = new Map();
if (!REBUILD && existsSync(OUT)) for (const e of readIndexEntries(readFileSync(OUT))) known.set(e.id, e);

const jobs = [];
for (const font of fonts) {
  const weights = pickWeights(font.w);
  const have = known.get(font.id);
  if (have && weights.every(w => have.styles.some(s => s.weight === w))) continue;
  if (!urlsFor(font, weights[0]).length) continue; // no Latin letters to compare
  jobs.push({ font, weights });
}

let done = 0;
let failed = 0;
const started = Date.now();
async function run(job) {
  const styles = [];
  for (const weight of job.weights) {
    const bytes = await fetchFont(job.font, weight);
    if (!bytes) continue;
    try {
      styles.push({ weight, record: encodeRecord(measure(bytes)) });
    } catch (err) {
      if (!QUIET) console.warn(`  ${job.font.f} ${weight}: ${err.message}`);
    }
  }
  if (styles.length) known.set(job.font.id, { id: job.font.id, styles });
  else failed += 1;
  done += 1;
  if (!QUIET && done % 100 === 0) console.log(`  ${done}/${jobs.length} measured (${Math.round((Date.now() - started) / 1000)}s)`);
}
const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await run(queue.shift());
  })
);

// Only fonts still in the catalog, in catalog order.
const entries = fonts.map(f => known.get(f.id)).filter(Boolean);
const twins = twinGroups(entries);
writeFileSync(OUT, packIndex(entries, twins));
const styleCount = entries.reduce((n, e) => n + e.styles.length, 0);
console.log(
  `Font index: ${entries.length} fonts (${styleCount} styles, ${twins.length} groups of look-alikes), ${jobs.length - failed} newly measured` +
    (failed ? `, ${failed} couldn't be fetched` : '')
);
