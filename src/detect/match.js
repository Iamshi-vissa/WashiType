// Matching the letters read from a picture against every font, on the visitor's device.
//   1. Shape index: compare each letter's proportions, position on the baseline, spacing
//      and stroke thickness with what every font in public/font-index.bin would give.
//      Cheap arithmetic; narrows ~2,000 fonts to the closest few dozen.
//   2. Drawing: draw the same letters in each of those fonts at the same size and compare
//      them with the picture pixel by pixel (blurred, so a pixel's slip doesn't count).
import { unpackIndex, median, X_LETTERS } from './fontIndex.js';
import { loadWeight } from '../fontLoader.js';

let indexPromise = null;
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('/font-index.bin')
      .then(res => {
        if (!res.ok) throw new Error(`font-index.bin: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(unpackIndex);
    indexPromise.catch(() => (indexPromise = null));
  }
  return indexPromise;
}

/**
 * Step 1: score one font style against the letters (lower is closer). The font's size in
 * the picture (pixels per em) and its baseline are fitted from all the letters at once, so
 * a pixel of blur on round letters doesn't skew every comparison.
 */
function shapeScore(style, read) {
  const { letters } = read;
  const unit = read.unitKind === 'x' ? style.xHeight : style.capHeight;
  if (!unit) return null;
  const pairs = [];
  let missing = 0;
  for (const l of letters) {
    const g = style.glyphs[l.ch];
    if (g) pairs.push([l, g]);
    else missing++;
  }
  if (missing > letters.length / 3 || pairs.length < 2) return null;
  const k = median(pairs.filter(([, g]) => g.y1 - g.y0 > unit * 0.3).map(([l, g]) => (l.bottom + 1 - l.top) / (g.y1 - g.y0)));
  if (!k) return null;
  const base = median(pairs.map(([l, g]) => l.bottom + 1 + g.y0 * k));
  const scale = k * unit; // the font's x-height (or cap height) in pixels
  let cost = 0;
  for (const [l, g] of pairs) {
    cost += Math.abs((l.x1 - l.x0 + 1) - (g.x1 - g.x0) * k) * 1.2;
    cost += Math.abs(l.top - (base - g.y1 * k));
    cost += Math.abs(l.bottom + 1 - (base - g.y0 * k)) * 0.7;
  }
  // Spacing: left edge to left edge of neighbours in a word. Fonts are often set tighter or
  // looser than designed, so one tracking offset for the whole line is allowed.
  const residuals = [];
  for (let i = 0; i + 1 < letters.length; i++) {
    const [a, b] = [letters[i], letters[i + 1]];
    const ga = style.glyphs[a.ch];
    const gb = style.glyphs[b.ch];
    if (a.word !== b.word || !ga || !gb) continue;
    residuals.push(b.x0 - a.x0 - (ga.adv - ga.x0 + gb.x0) * k);
  }
  let spacing = 0;
  if (residuals.length) {
    const tracking = median(residuals);
    spacing = residuals.reduce((sum, r) => sum + Math.abs(r - tracking), 0) * 0.8 + Math.abs(tracking) * 0.3;
  }
  let score = (cost + spacing) / scale / pairs.length + missing * 0.6;
  // Stroke thickness tells light from heavy families. Any thickness the family's weights
  // span counts as a match (a medium falls between the regular and bold measured).
  const stem = read.unitKind === 'x' ? read.stemLower : read.stemCap;
  const range = read.unitKind === 'x' ? style.stemRangeLower : style.stemRangeCap;
  if (stem && range) score += (Math.max(0, range[0] * k - stem, stem - range[1] * k) / scale) * 5;
  return { score, k, base };
}

/**
 * The stroke thickness (in em) a family can have across all its weights, from the styles the
 * index measured: between them by interpolation, beyond them at about 0.2% per weight unit.
 */
function stemRange(styles, weights, which) {
  const known = styles.filter(st => st[which]).sort((a, b) => a.weight - b.weight);
  if (!known.length) return null;
  const at = w => {
    if (known.length >= 2) {
      const [a, b] = [known[0], known.at(-1)];
      const slope = (b[which] - a[which]) / (b.weight - a.weight || 1);
      return a[which] + (w - a.weight) * slope;
    }
    return known[0][which] * (1 + 0.002 * (w - known[0].weight));
  };
  const lo = Math.min(...weights);
  const hi = Math.max(...weights);
  // A little slack either side for measuring by eye-sized pixels.
  return [Math.max(0, at(lo)) * 0.92, at(hi) * 1.08];
}

const SPACE = 0.26; // a typical word space, in em (the index has no space character)

/** Step 1 for whole-word reading: the line's proportions instead of each letter's. */
function wordScore(style, read) {
  const xh = style.xHeight;
  if (!xh) return null;
  let pen = 0;
  let left = Infinity;
  let right = -Infinity;
  let ascent = 0;
  let descent = 0;
  let missing = 0;
  let count = 0;
  for (const ch of read.text) {
    if (ch === ' ') {
      pen += SPACE;
      continue;
    }
    count++;
    const g = style.glyphs[ch];
    if (!g) {
      missing++;
      pen += 0.5;
      continue;
    }
    left = Math.min(left, pen + g.x0);
    right = Math.max(right, pen + g.x1);
    ascent = Math.max(ascent, g.y1);
    descent = Math.max(descent, -g.y0);
    pen += g.adv;
  }
  if (missing > count / 3 || !Number.isFinite(left)) return null;
  // Size from the full height of the ink, which is measured exactly; then compare the rest.
  const k = (read.ascent + read.descent) / (ascent + descent);
  let score = Math.abs(Math.log(((right - left) * k) / read.width)) * 2;
  score += (Math.abs(xh * k - read.unit) / read.unit) * 1.5;
  score += Math.abs(ascent * k - read.ascent) / (read.ascent + read.descent);
  const range = style.stemRangeLower;
  if (read.stem && range) score += (Math.max(0, range[0] * k - read.stem, read.stem - range[1] * k) / (xh * k)) * 5;
  return { score: score + missing * 0.3, k, base: read.baseline };
}

/**
 * Which of a group of fonts with identical Latin letters to show: the most general family
 * (Noto Sans over Noto Sans Carian), else the shortest name.
 */
function representative(ids, fontsById) {
  const names = ids.map(id => fontsById.get(id).f);
  return ids
    .map((id, i) => ({ id, name: names[i], general: names.filter(n => n !== names[i] && n.startsWith(names[i] + ' ')).length }))
    .sort((a, b) => b.general - a.general || a.name.length - b.name.length || a.name.localeCompare(b.name))[0].id;
}

/**
 * Step 1 for every font in the index. Returns styles sorted closest first. Fonts whose
 * Latin letters are the same (many Noto fonts share Noto Sans's; the index groups them)
 * become one entry, with the others listed in `twins`.
 */
export function rankByShape(index, read, fontsById) {
  const byId = new Map();
  for (const st of index) (byId.get(st.id) ?? byId.set(st.id, []).get(st.id)).push(st);
  for (const [id, styles] of byId) {
    const weights = fontsById.get(id)?.w ?? styles.map(st => st.weight);
    const lower = stemRange(styles, weights, 'stemLower');
    const cap = stemRange(styles, weights, 'stemCap');
    for (const st of styles) Object.assign(st, { stemRangeLower: lower, stemRangeCap: cap });
  }
  const groups = new Map();
  for (const style of index) {
    if (!fontsById.has(style.id)) continue;
    const key = style.twin ?? `${style.id}:${style.weight}`;
    const group = groups.get(key);
    if (group) group.twins.push(style.id);
    else groups.set(key, { style, twins: [style.id] });
  }
  const scored = [];
  const score = read.mode === 'word' ? wordScore : shapeScore;
  for (const { style, twins } of groups.values()) {
    const fit = score(style, read);
    if (!fit) continue;
    const id = twins.length > 1 ? representative(twins, fontsById) : style.id;
    scored.push({ ...style, id, twins: twins.filter(t => t !== id), shape: fit.score, k: fit.k, base: fit.base });
  }
  return scored.sort((a, b) => a.shape - b.shape);
}

// ---------- Step 2: drawing and comparing ----------

const SIZE = 40; // the unit (x-height or cap height) in pixels when comparing
const WORD_SIZE = 24; // the x-height in pixels when comparing whole lines
const NEAR_TIE = 0.002; // scores this close count as a tie
const TWINS_DRAWN = 5; // look-alikes drawn per finalist
const SAME_LOOK = 0.004; // twins drawing within this of the best are listed as the same letters
const PAD = 6;

/** A letter as a blurred grey image in a frame anchored at its left ink edge and the baseline. */
function frame(width, top, bottom) {
  return { w: width + PAD * 2, h: top + bottom + PAD * 2, top, data: null };
}

function blur(data, w, h) {
  // Two passes of a 3-wide box blur each way, close to a small Gaussian.
  const tmp = new Float32Array(data.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        tmp[i] = (data[i] * 2 + (x > 0 ? data[i - 1] : 0) + (x < w - 1 ? data[i + 1] : 0)) / 4;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        data[i] = (tmp[i] * 2 + (y > 0 ? tmp[i - w] : 0) + (y < h - 1 ? tmp[i + w] : 0)) / 4;
      }
  }
  return data;
}

/**
 * Sample part of the picture into a comparison frame: columns x0..x1, rows from `above`
 * pixels over the baseline to `below` under it, scaled by `scale`.
 */
function pictureRegion(mask, x0, x1, baseline, above, below, scale) {
  const width = Math.max(1, Math.round((x1 - x0 + 1) * scale));
  const top = Math.max(1, Math.round(above * scale));
  const bottom = Math.max(0, Math.round(below * scale));
  const f = frame(width, top, bottom);
  f.data = new Float32Array(f.w * f.h);
  // Average the mask over each target pixel's footprint (area sampling).
  const step = 1 / scale;
  const sub = Math.max(1, Math.ceil(step));
  for (let ty = 0; ty < top + bottom; ty++) {
    const sy0 = baseline - top * step + ty * step;
    for (let tx = 0; tx < width; tx++) {
      const sx0 = x0 + tx * step;
      let sum = 0;
      for (let j = 0; j < sub; j++)
        for (let i = 0; i < sub; i++) {
          const sx = Math.floor(sx0 + ((i + 0.5) * step) / sub);
          const sy = Math.floor(sy0 + ((j + 0.5) * step) / sub);
          if (sx >= 0 && sy >= 0 && sx < mask.width && sy < mask.height) sum += mask.ink[sy * mask.width + sx];
        }
      f.data[(ty + PAD) * f.w + tx + PAD] = sum / (sub * sub);
    }
  }
  blur(f.data, f.w, f.h);
  return f;
}

const pictureLetter = (read, l) =>
  pictureRegion(read.mask, l.x0, l.x1, read.baseline, read.baseline - l.top, l.bottom + 1 - read.baseline, SIZE / read.unit);

let canvas = null;
function context(w, h) {
  if (!canvas) canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  if (canvas.width < w) canvas.width = w;
  if (canvas.height < h) canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

/** Draw text (a letter, or a whole line) in a font and frame it like pictureRegion. */
function drawnLetter(family, weight, fontSize, text) {
  const font = `${weight} ${fontSize}px "${family}"`;
  const probe = context(1, 1);
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width + fontSize * 1.4);
  const h = Math.ceil(fontSize * 2.4);
  const ctx = context(w, h);
  ctx.font = font;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  const baseline = Math.round(fontSize * 1.6);
  ctx.fillText(text, Math.round(fontSize * 0.5), baseline);
  const { data } = ctx.getImageData(0, 0, w, h);
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 127) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const width = x1 - x0 + 1;
  const top = baseline - y0;
  const bottom = Math.max(0, y1 + 1 - baseline);
  const f = frame(width, top, bottom);
  f.data = new Float32Array(f.w * f.h);
  for (let ty = 0; ty < top + bottom; ty++)
    for (let tx = 0; tx < width; tx++) f.data[(ty + PAD) * f.w + tx + PAD] = data[((baseline - top + ty) * w + x0 + tx) * 4 + 3] / 255;
  blur(f.data, f.w, f.h);
  return f;
}

/** Stretch a frame's ink horizontally to `width` columns (linear resampling). */
function stretch(f, width) {
  const inner = f.w - PAD * 2;
  const out = frame(width, f.top, f.h - PAD * 2 - f.top);
  out.data = new Float32Array(out.w * out.h);
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < width; x++) {
      const sx = (x + 0.5) * (inner / width) - 0.5;
      const a = Math.max(0, Math.min(inner - 1, Math.floor(sx)));
      const b = Math.min(inner - 1, a + 1);
      const t = Math.max(0, Math.min(1, sx - a));
      out.data[y * out.w + x + PAD] = f.data[y * f.w + a + PAD] * (1 - t) + f.data[y * f.w + b + PAD] * t;
    }
  return out;
}

/** Similarity of two framed letters with b shifted by (dx, dy) pixels. */
function correlation(a, b, dx, dy) {
  const w = Math.max(a.w, b.w + Math.abs(dx));
  const above = Math.max(a.top, b.top + Math.abs(dy)) + PAD;
  const below = Math.max(a.h - a.top, b.h - b.top + Math.abs(dy));
  let both = 0;
  let sa = 0;
  let sb = 0;
  for (let y = -above; y < below; y++) {
    const ya = y + a.top + PAD;
    const yb = y - dy + b.top + PAD;
    for (let x = 0; x < w; x++) {
      const xb = x - dx;
      const va = ya >= 0 && ya < a.h && x < a.w ? a.data[ya * a.w + x] : 0;
      const vb = yb >= 0 && yb < b.h && xb >= 0 && xb < b.w ? b.data[yb * b.w + xb] : 0;
      both += va * vb;
      sa += va * va;
      sb += vb * vb;
    }
  }
  return sa && sb ? both / Math.sqrt(sa * sb) : 0;
}

/**
 * How different two framed letters are: 0 the same, up to 1. The frames align at the
 * baseline and the left edge of the ink; a nudge of a pixel either way is allowed, since
 * the picture's baseline and edges are only known to about a pixel.
 */
function difference(a, b, reach = 1) {
  let best = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -reach; dx <= reach; dx++) best = Math.max(best, correlation(a, b, dx, dy));
  return 1 - best;
}

/**
 * The weight to draw a candidate in. The index measures a font's regular and bold; a
 * picture in medium or semibold (or light) falls between, so estimate the weight from the
 * stroke thickness and use the nearest weight the font has.
 */
function weightToDraw(c, read, font, own) {
  const stem = read.mode === 'word' ? read.stem : read.unitKind === 'x' ? read.stemLower : read.stemCap;
  if (!stem || font.w.length < 2 || !own?.length) return c.weight;
  const of = st => (read.mode === 'word' || read.unitKind === 'x' ? st.stemLower : st.stemCap);
  const known = own.filter(of).sort((a, b) => a.weight - b.weight);
  if (!known.length) return c.weight;
  const px = st => of(st) * c.k;
  let estimate;
  if (known.length >= 2 && px(known.at(-1)) > px(known[0])) {
    const [a, b] = [known[0], known.at(-1)];
    estimate = a.weight + ((stem - px(a)) / (px(b) - px(a))) * (b.weight - a.weight);
  } else {
    // One weight measured: strokes grow about 60% from regular to bold (400 to 700).
    estimate = known[0].weight + ((stem / px(known[0]) - 1) / 0.002);
  }
  return font.w.reduce((best, w) => (Math.abs(w - estimate) < Math.abs(best - estimate) ? w : best), c.weight);
}

/** Draw the picture's text in a candidate and compare: 0 is identical, up to 1. */
function drawAndCompare(c, font, read, picture, scale) {
  // Draw at the size step 1 fitted for this font, in the comparison's scale.
  const fontSize = c.k * scale;
  if (read.mode === 'word') {
    const drawn = drawnLetter(font.f, c.weight, fontSize, read.text);
    if (!drawn) return null;
    // Letter spacing in a logo is often adjusted, so match the width, at a small cost.
    const ratio = (picture[0].w - PAD * 2) / (drawn.w - PAD * 2);
    const fitted = Math.abs(ratio - 1) > 0.01 ? stretch(drawn, picture[0].w - PAD * 2) : drawn;
    return difference(picture[0], fitted, 2) + Math.abs(Math.log(ratio)) * 0.15;
  }
  let total = 0;
  read.letters.forEach((l, i) => {
    const drawn = drawnLetter(font.f, c.weight, fontSize, l.ch);
    total += drawn ? difference(picture[i], drawn) : 1;
  });
  return total / read.letters.length;
}

/**
 * Step 2 for the closest candidates: load each font, draw the letters, compare.
 * onProgress(done, total). Returns candidates with .look (0 best) and .score, best first.
 */
export async function compareDrawn(candidates, read, fontsById, onProgress = () => {}, stylesById = new Map()) {
  // Word mode compares the whole line at a smaller scale (lines are long).
  const scale = (read.mode === 'word' ? WORD_SIZE : SIZE) / read.unit;
  const picture =
    read.mode === 'word'
      ? [pictureRegion(read.mask, read.box.x0, read.box.x1, read.baseline, read.ascent, read.descent, scale)]
      : read.letters.map(l => pictureLetter(read, l));
  let done = 0;
  const results = [];
  const queue = [...candidates];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const shortlisted = queue.shift();
        const font = fontsById.get(shortlisted.id);
        // The weight step 1 matched, and the weight the strokes suggest when that differs
        // (on small text the stroke estimate is a pixel or two, so both are drawn).
        const weights = [...new Set([shortlisted.weight, weightToDraw(shortlisted, read, font, stylesById.get(shortlisted.id))])];
        let best = null;
        for (const weight of weights) {
          const c = { ...shortlisted, weight };
          if (!(await loadWeight(font, weight))) continue;
          const look = drawAndCompare(c, font, read, picture, scale);
          if (look !== null && (!best || look < best.look)) best = { ...c, look };
        }
        done++;
        onProgress(done, candidates.length);
        if (best) results.push(best);
      }
    })
  );
  // Mostly how the letters look; proportions and spacing break near-ties.
  for (const r of results) r.score = r.look + r.shape * 0.04;
  return results.sort((a, b) => a.score - b.score);
}

/** The whole match: returns up to `limit` fonts, best first, one entry per family. */
export async function findFonts(read, fonts, { shortlist = 60, limit = 8, onStage = () => {} } = {}) {
  onStage('index');
  const index = await loadIndex();
  const fontsById = new Map(fonts.map(f => [f.id, f]));
  const ranked = rankByShape(index, read, fontsById);
  const stylesById = new Map();
  for (const st of index) (stylesById.get(st.id) ?? stylesById.set(st.id, []).get(st.id)).push(st);
  // The shortlist: the closest styles, no more than two per family.
  const perFamily = new Map();
  const short = [];
  for (const r of ranked) {
    const n = perFamily.get(r.id) ?? 0;
    if (n >= 2) continue;
    perFamily.set(r.id, n + 1);
    short.push(r);
    if (short.length >= shortlist) break;
  }
  onStage('draw', 0, short.length);
  const compared = await compareDrawn(short, read, fontsById, (d, t) => onStage('draw', d, t), stylesById);
  const best = [];
  const seen = new Set();
  for (const c of compared) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    best.push(c);
    if (best.length >= limit) break;
  }
  // Look-alike groups share letter sizes, not always drawings (Allerta and Allerta Stencil),
  // so draw a few of each finalist's twins too and keep whichever matches best. Twins that
  // draw the same stay listed with it.
  const twinDraws = best.flatMap(c =>
    [...c.twins]
      .sort((a, b) => fontsById.get(a).f.length - fontsById.get(b).f.length)
      .slice(0, TWINS_DRAWN)
      .map(id => ({ ...c, id, twins: [], of: c.id }))
  );
  const drawnTwins = twinDraws.length ? await compareDrawn(twinDraws, read, fontsById, undefined, stylesById) : [];
  const out = best.map(c => {
    const members = [c, ...drawnTwins.filter(t => t.of === c.id)].sort((a, b) => a.look - b.look);
    const top = members[0];
    const same = members.slice(1).filter(m => m.look - top.look < SAME_LOOK).map(m => m.id);
    const undrawn = c.twins.filter(id => !members.some(m => m.id === id));
    return {
      font: fontsById.get(top.id),
      weight: top.weight,
      look: top.look,
      score: top.look + c.shape * 0.04,
      twins: [...same, ...undrawn].map(id => fontsById.get(id))
    };
  });
  // Near-ties (fonts drawing the same letters) list the plainer family first: Noto Sans
  // before Noto Sans Duployan.
  const sameFamily = (a, b) => b.font.f.startsWith(a.font.f + ' ') || a.font.f.startsWith(b.font.f + ' ');
  return out.sort(
    (a, b) =>
      (Math.abs(a.score - b.score) < NEAR_TIE && sameFamily(a, b) ? a.font.f.length - b.font.f.length : 0) ||
      a.score - b.score
  );
}

/** A rough "how close" for people: 100 for a perfect match, falling with difference. */
export const closeness = look => Math.max(0, Math.min(100, Math.round(100 - look * 220)));

export const hasXLetters = text => [...text].some(ch => X_LETTERS.includes(ch));
