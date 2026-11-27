// Reading letters out of a picture, on the visitor's device. Given the pixels of a crop
// that holds one line of text and the text it says, find each letter, where the baseline is,
// how tall the lowercase and capitals are, and how thick the strokes are. Everything is plain
// arithmetic on pixel arrays, so it runs anywhere and nothing leaves the device.
import { X_LETTERS, CAP_LETTERS, STEM_LOWER, STEM_CAPS, STEM_LOWER_AT, STEM_CAP_AT, median } from './fontIndex.js';

/** Brightness 0..1 for each pixel of an ImageData-like { width, height, data }. */
export function toGray({ width, height, data }) {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const alpha = data[p + 3] / 255;
    // Transparent pixels count as white paper.
    gray[i] = ((0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255) * alpha + (1 - alpha);
  }
  return gray;
}

/** Otsu's threshold: the brightness that best splits the pixels into two groups. */
export function otsu(gray) {
  const bins = new Float64Array(256);
  for (const v of gray) bins[Math.min(255, (v * 255) | 0)]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * bins[i];
  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    weightB += bins[i];
    if (!weightB) continue;
    const weightF = total - weightB;
    if (!weightF) break;
    sumB += i * bins[i];
    const between = weightB * weightF * (sumB / weightB - (sum - sumB) / weightF) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return (threshold + 0.5) / 255;
}

/**
 * Ink mask: 1 where there's lettering. Dark-on-light and light-on-dark both work: the
 * lettering is whichever side of the threshold has fewer pixels.
 */
export function inkMask(image) {
  const gray = toGray(image);
  const t = otsu(gray);
  let dark = 0;
  for (const v of gray) if (v < t) dark++;
  const darkIsInk = dark <= gray.length / 2;
  const ink = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) ink[i] = darkIsInk ? (gray[i] < t ? 1 : 0) : gray[i] >= t ? 1 : 0;
  return { width: image.width, height: image.height, ink, lightText: !darkIsInk };
}

/** Connected blobs of ink (8-connected), each with its bounding box and pixel count. */
export function blobs({ width, height, ink }) {
  const labels = new Int32Array(width * height).fill(-1);
  const found = [];
  const stack = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || labels[start] !== -1) continue;
    const id = found.length;
    const blob = { x0: width, y0: height, x1: -1, y1: -1, area: 0, id };
    labels[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop();
      const x = p % width;
      const y = (p - x) / width;
      blob.area++;
      if (x < blob.x0) blob.x0 = x;
      if (x > blob.x1) blob.x1 = x;
      if (y < blob.y0) blob.y0 = y;
      if (y > blob.y1) blob.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const q = ny * width + nx;
          if (ink[q] && labels[q] === -1) {
            labels[q] = id;
            stack.push(q);
          }
        }
      }
    }
    found.push(blob);
  }
  return { blobs: found, labels };
}

const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;

/** The line of text in the crop: the horizontal band with the most ink, if there are several. */
function mainBand(mask, list) {
  const rows = new Float64Array(mask.height);
  for (const b of list) for (let y = b.y0; y <= b.y1; y++) rows[y] += b.x1 - b.x0 + 1;
  const bands = [];
  let start = -1;
  for (let y = 0; y <= mask.height; y++) {
    const on = y < mask.height && rows[y] > 0;
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      bands.push({ y0: start, y1: y - 1, ink: rows.slice(start, y).reduce((a, b) => a + b, 0) });
      start = -1;
    }
  }
  if (bands.length <= 1) return list;
  // Bands can be split by gaps between a letter body and its accent or dot; join bands closer
  // than a third of the tallest band's height.
  const tallest = Math.max(...bands.map(b => b.y1 - b.y0 + 1));
  const joined = [bands[0]];
  for (const b of bands.slice(1)) {
    const last = joined[joined.length - 1];
    if (b.y0 - last.y1 < tallest / 3) Object.assign(last, { y1: b.y1, ink: last.ink + b.ink });
    else joined.push(b);
  }
  const best = joined.reduce((a, b) => (b.ink > a.ink ? b : a));
  return list.filter(b => b.y0 >= best.y0 && b.y1 <= best.y1);
}

/**
 * Group blobs into letters, left to right. A blob sitting over another (the dot of an i, an
 * accent, a broken stroke) joins it. Specks far smaller than a typical letter are dropped.
 */
function groupLetters(list) {
  const heights = list.map(b => b.y1 - b.y0 + 1);
  const typical = median(heights) || 1;
  const sorted = [...list].sort((a, b) => a.x0 - b.x0);
  const groups = [];
  for (const b of sorted) {
    const w = b.x1 - b.x0 + 1;
    const g = groups.find(g => overlap(g, b) >= 0.5 * Math.min(w, g.x1 - g.x0 + 1));
    if (g) {
      Object.assign(g, { x0: Math.min(g.x0, b.x0), x1: Math.max(g.x1, b.x1), y0: Math.min(g.y0, b.y0), y1: Math.max(g.y1, b.y1) });
      g.area += b.area;
      g.ids.push(b.id);
    } else groups.push({ ...b, ids: [b.id] });
  }
  const areas = groups.map(g => g.area);
  const typicalArea = median(areas) || 1;
  return groups.filter(g => g.area >= typicalArea * 0.04 && g.y1 - g.y0 + 1 >= typical * 0.12).sort((a, b) => a.x0 - b.x0);
}

/** Ink count per column within a box, for splitting letters that touch. */
function columnInk(mask, box) {
  const cols = new Float64Array(box.x1 - box.x0 + 1);
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) cols[x - box.x0] += mask.ink[y * mask.width + x];
  return cols;
}

/** Make the number of letters found match the number typed: join breaks, split touches. */
function reconcile(mask, groups, expected) {
  const out = groups.map(g => ({ ...g }));
  while (out.length > expected && out.length > 1) {
    let best = 0;
    for (let i = 1; i < out.length - 1; i++) if (out[i + 1].x0 - out[i].x1 < out[best + 1].x0 - out[best].x1) best = i;
    const [a, b] = [out[best], out[best + 1]];
    out.splice(best, 2, { x0: a.x0, x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), area: a.area + b.area, ids: [...a.ids, ...b.ids] });
  }
  let guard = 0;
  while (out.length < expected && guard++ < expected) {
    // Split the widest letter (relative to its height) at its thinnest column.
    let widest = 0;
    out.forEach((g, i) => {
      const r = (g.x1 - g.x0 + 1) / (g.y1 - g.y0 + 1);
      const best = out[widest];
      if (r > (best.x1 - best.x0 + 1) / (best.y1 - best.y0 + 1)) widest = i;
    });
    const g = out[widest];
    const cols = columnInk(mask, g);
    const from = Math.floor(cols.length * 0.25);
    const to = Math.ceil(cols.length * 0.75);
    let cut = from;
    for (let i = from; i < to; i++) if (cols[i] < cols[cut]) cut = i;
    if (cols.length < 4) break;
    const left = { ...g, x1: g.x0 + cut - 1 };
    const right = { ...g, x0: g.x0 + cut };
    out.splice(widest, 1, tightBox(mask, left), tightBox(mask, right));
  }
  return out;
}

/** Shrink a box to the ink inside it. */
function tightBox(mask, box) {
  let { x0, y0, x1, y1 } = { x0: box.x1, y0: box.y1, x1: box.x0, y1: box.y0 };
  let area = 0;
  for (let y = box.y0; y <= box.y1; y++)
    for (let x = box.x0; x <= box.x1; x++)
      if (mask.ink[y * mask.width + x]) {
        area++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return area ? { ...box, x0, y0, x1, y1, area } : { ...box, area: 0 };
}

/** Lengths of ink runs along row y between columns x0 and x1. */
function rowRuns(mask, y, x0, x1) {
  const runs = [];
  let run = 0;
  for (let x = x0; x <= x1 + 1; x++) {
    const on = x <= x1 && mask.ink[y * mask.width + x];
    if (on) run++;
    else if (run) (runs.push(run), (run = 0));
  }
  return runs;
}

/**
 * Find and measure the letters of `text` in the picture.
 * Returns { letters: [{ ch, x0, x1, top, bottom, word }], baseline, xHeight, capHeight,
 * unit, unitKind, stemLower, stemCap, lightText } in pixels, or { error } with a reason
 * a person can act on.
 */
export function readLetters(image, text) {
  const chars = [...text].filter(ch => /\S/.test(ch));
  // Which word each character is in (pitch is only compared within a word).
  const words = [];
  let word = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) word++;
    else words.push(word);
  }
  if (chars.length < 2) return { error: 'Type at least two letters from the picture.' };
  const mask = inkMask(image);
  const { blobs: all } = blobs(mask);
  if (!all.length) return { error: 'No lettering found in that area. Try a clearer picture or a tighter crop.' };
  const line = mainBand(mask, all);
  const groups = groupLetters(line);
  if (!groups.length) return { error: 'No lettering found in that area.' };
  // Joined-up scripts, dotted and stencil lettering don't split into one blob per letter;
  // those are matched as whole words instead (readWord).
  if (Math.abs(groups.length - chars.length) > Math.max(2, chars.length * 0.4)) return readWord(mask, line, text);
  const boxes = reconcile(mask, groups, chars.length).map(b => tightBox(mask, b));
  if (boxes.length !== chars.length || boxes.some(b => !b.area)) return readWord(mask, line, text);

  const letters = boxes.map((b, i) => ({ ch: chars[i], x0: b.x0, x1: b.x1, top: b.y0, bottom: b.y1, word: words[i] }));
  // Baseline: the bottom of letters that sit on it (no descenders, no round overshoot bias).
  const sitters = letters.filter(l => X_LETTERS.includes(l.ch) || CAP_LETTERS.includes(l.ch) || 'bdfhikltA'.includes(l.ch));
  const baseline = median((sitters.length ? sitters : letters).map(l => l.bottom + 1));
  const xLetters = letters.filter(l => X_LETTERS.includes(l.ch));
  const capLetters = letters.filter(l => CAP_LETTERS.includes(l.ch));
  const xHeight = xLetters.length ? median(xLetters.map(l => baseline - l.top)) : null;
  const capHeight = capLetters.length ? median(capLetters.map(l => baseline - l.top)) : null;
  const unitKind = xHeight ? 'x' : capHeight ? 'cap' : null;
  const unit = xHeight || capHeight;
  if (!unit || unit < 6) {
    return { error: 'The letters are too small to measure. Use a bigger or sharper picture, or zoom in before cropping.' };
  }

  const stem = (set, height, at) => {
    if (!height) return null;
    const y = Math.round(baseline - height * at);
    const runs = letters.filter(l => set.includes(l.ch)).flatMap(l => (y >= 0 && y < mask.height ? rowRuns(mask, y, l.x0, l.x1) : []));
    return median(runs);
  };

  return {
    mode: 'letters',
    letters,
    mask,
    baseline,
    xHeight,
    capHeight,
    unit,
    unitKind,
    stemLower: stem(STEM_LOWER, xHeight, STEM_LOWER_AT),
    stemCap: stem(STEM_CAPS, capHeight, STEM_CAP_AT),
    lightText: mask.lightText
  };
}

/**
 * Whole-word reading, for lettering that doesn't come apart into letters. Measures the line
 * as a whole: where the baseline and x-height are (the band where most of the ink is), how
 * far ascenders and descenders reach, how wide the text is, and how thick the strokes are.
 */
function readWord(mask, line, text) {
  const box = line.reduce(
    (b, l) => ({ x0: Math.min(b.x0, l.x0), x1: Math.max(b.x1, l.x1), y0: Math.min(b.y0, l.y0), y1: Math.max(b.y1, l.y1) }),
    { x0: Infinity, x1: -1, y0: Infinity, y1: -1 }
  );
  const ids = new Set(line.map(b => b.id));
  // Ink per row, only from this line's blobs (the mask may hold other lines).
  const rows = new Float64Array(box.y1 - box.y0 + 1);
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) rows[y - box.y0] += mask.ink[y * mask.width + x];
  // Dotted and segmented lettering leaves gaps between rows of dots; smooth over them.
  const charCount = [...text].filter(ch => /\S/.test(ch)).length;
  if (line.length > charCount * 2) {
    const reach = Math.max(1, Math.round(median(line.map(b => b.y1 - b.y0 + 1)) || 1));
    const copy = rows.slice();
    for (let i = 0; i < rows.length; i++) {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, i - reach); j <= Math.min(rows.length - 1, i + reach); j++) (sum += copy[j]), n++;
      rows[i] = sum / n;
    }
  }
  const peak = Math.max(...rows);
  // The x-height band: the rows carrying at least 45% of the busiest row's ink, around it.
  const at = rows.indexOf(peak);
  let top = at;
  let bottom = at;
  while (top > 0 && rows[top - 1] >= peak * 0.45) top--;
  while (bottom < rows.length - 1 && rows[bottom + 1] >= peak * 0.45) bottom++;
  const baseline = box.y0 + bottom + 1;
  const xHeight = bottom - top + 1;
  if (!ids.size || xHeight < 5) {
    return { error: 'The letters are too small or faint to measure. Try a bigger, sharper picture.' };
  }
  const midRow = Math.round(baseline - xHeight / 2);
  return {
    mode: 'word',
    text: text.trim().replace(/\s+/g, ' '),
    mask,
    box,
    baseline,
    unit: xHeight,
    unitKind: 'x',
    ascent: baseline - box.y0,
    descent: box.y1 + 1 - baseline,
    width: box.x1 - box.x0 + 1,
    stem: median(rowRuns(mask, midRow, box.x0, box.x1)),
    lightText: mask.lightText
  };
}
