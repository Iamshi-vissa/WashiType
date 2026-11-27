// The font shape index: for every font (regular, and bold when it has one), the size and
// position of each letter and digit, and how thick its strokes are. Built ahead of time by
// scripts/font-index.mjs from the font files; read in the browser by the font detector,
// which uses it to narrow 2,000 fonts to a few dozen before drawing and comparing them.
//
// File (public/font-index.bin): uint32 header length, a JSON header
//   { v, chars, fonts: [[id, weight, weight?], ...] }, then one record per font style in
//   header order. A record is, for each of CHARS, five bytes (see below), then two bytes of
//   stroke thickness. All sizes are fractions of the em, so fonts of any units compare.

export const VERSION = 1;
export const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/** Lowercase letters with a flat top at the x-height (no ascender, no descender). */
export const X_LETTERS = 'acemnorsuvwxz';
/** Capitals and digits that sit on the baseline and reach the cap height. */
export const CAP_LETTERS = 'ABCDEFGHIKLMNPRSTUVWXYZ';
/** Letters with straight upright stems, for stroke thickness. Measured across the letter at
 *  half the x-height (lowercase) or 30% of the cap height (capitals, below any crossbar). */
export const STEM_LOWER = 'mnu';
export const STEM_CAPS = 'HILNTU';
export const STEM_LOWER_AT = 0.5;
export const STEM_CAP_AT = 0.3;
export const GLYPH_BYTES = 5;
export const RECORD_BYTES = CHARS.length * GLYPH_BYTES + 2;

const MISSING = 255;
const clampByte = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));

/**
 * Pack one font style. glyphs[i] is { adv, x0, x1, y0, y1 } in em (pen at 0, baseline at 0,
 * y up) or null when the font has no such character; stemLower/stemCap are in em.
 */
export function encodeRecord({ glyphs, stemLower, stemCap }) {
  const out = new Uint8Array(RECORD_BYTES);
  const s8 = new Int8Array(out.buffer);
  glyphs.forEach((g, i) => {
    const at = i * GLYPH_BYTES;
    if (!g) {
      out[at] = MISSING;
      return;
    }
    out[at] = clampByte(g.adv * 150, 0, 254); // advance width, 1/150 em, up to 1.69 em
    s8[at + 1] = clampByte(g.x0 * 150, -128, 127); // ink left edge from the pen
    out[at + 2] = clampByte(g.x1 * 150, 0, 255); // ink right edge from the pen
    s8[at + 3] = clampByte(g.y0 * 100, -128, 127); // ink bottom, 1/100 em (negative: descender)
    s8[at + 4] = clampByte(g.y1 * 100, -128, 127); // ink top
  });
  out[RECORD_BYTES - 2] = clampByte((stemLower ?? 0) * 1000, 0, 255);
  out[RECORD_BYTES - 1] = clampByte((stemCap ?? 0) * 1000, 0, 255);
  return out;
}

/** Unpack a record from bytes (a Uint8Array view starting at the record). */
export function decodeRecord(bytes, offset = 0) {
  const s8 = new Int8Array(bytes.buffer, bytes.byteOffset + offset, RECORD_BYTES);
  const u8 = bytes.subarray(offset, offset + RECORD_BYTES);
  const glyphs = {};
  for (let i = 0; i < CHARS.length; i++) {
    const at = i * GLYPH_BYTES;
    if (u8[at] === MISSING) continue;
    glyphs[CHARS[i]] = {
      adv: u8[at] / 150,
      x0: s8[at + 1] / 150,
      x1: u8[at + 2] / 150,
      y0: s8[at + 3] / 100,
      y1: s8[at + 4] / 100
    };
  }
  const xHeight = glyphs.x?.y1 || glyphs.z?.y1 || glyphs.o?.y1 || null;
  const capHeight = glyphs.H?.y1 || glyphs.I?.y1 || glyphs.E?.y1 || null;
  return {
    glyphs,
    xHeight,
    capHeight,
    stemLower: u8[RECORD_BYTES - 2] / 1000 || null,
    stemCap: u8[RECORD_BYTES - 1] / 1000 || null
  };
}

/** A record's values with the signed bytes read as signed, for measuring differences. */
function recordValues(record) {
  const s8 = new Int8Array(record.buffer, record.byteOffset, RECORD_BYTES);
  const out = new Int16Array(RECORD_BYTES);
  for (let i = 0; i < RECORD_BYTES; i++) {
    const field = i < CHARS.length * GLYPH_BYTES ? i % GLYPH_BYTES : -1;
    out[i] = field === 1 || field === 3 || field === 4 ? s8[i] : record[i];
  }
  return out;
}

/**
 * Groups of fonts whose Latin letters are the same or all but the same (within `tolerance`,
 * summed over every stored number), by their first (regular) style. Many families share
 * their Latin letters with another (Noto Sans Carian has Noto Sans's); the detector shows
 * one of them and lists the rest.
 */
export function twinGroups(entries, tolerance = 24) {
  const values = entries.map(e => recordValues(e.styles[0].record));
  const parent = entries.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let a = 0; a < entries.length; a++) {
    for (let b = a + 1; b < entries.length; b++) {
      const va = values[a];
      const vb = values[b];
      let sum = 0;
      for (let i = 0; i < RECORD_BYTES && sum <= tolerance; i++) sum += Math.abs(va[i] - vb[i]);
      if (sum <= tolerance) parent[find(b)] = find(a);
    }
  }
  const groups = new Map();
  entries.forEach((e, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(e.id);
  });
  return [...groups.values()].filter(g => g.length > 1);
}

/** Write the whole index file. entries: [{ id, styles: [{ weight, record }] }]. */
export function packIndex(entries, twins = []) {
  const header = new TextEncoder().encode(
    JSON.stringify({ v: VERSION, chars: CHARS, fonts: entries.map(e => [e.id, ...e.styles.map(s => s.weight)]), twins })
  );
  const records = entries.flatMap(e => e.styles.map(s => s.record));
  const out = new Uint8Array(4 + header.length + records.length * RECORD_BYTES);
  new DataView(out.buffer).setUint32(0, header.length, true);
  out.set(header, 4);
  records.forEach((r, i) => out.set(r, 4 + header.length + i * RECORD_BYTES));
  return out;
}

/** Read the index file. Returns [{ id, weight, ...decodeRecord }], one per font style. */
export function unpackIndex(buffer) {
  const bytes = new Uint8Array(buffer);
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + length)));
  if (header.v !== VERSION || header.chars !== CHARS) throw new Error('font index: unknown version');
  const styles = [];
  // twin: which group of look-alike fonts this one is in (see twinGroups), or null.
  const twinOf = new Map();
  (header.twins || []).forEach((group, i) => group.forEach(id => twinOf.set(id, i)));
  let at = 4 + length;
  for (const [id, ...weights] of header.fonts) {
    weights.forEach((weight, n) => {
      // Regular and bold of a group are matched separately; the bold slot is "n".
      const twin = twinOf.has(id) ? `${twinOf.get(id)}:${n}` : null;
      styles.push({ id, weight, twin, ...decodeRecord(bytes, at) });
      at += RECORD_BYTES;
    });
  }
  return styles;
}

/** The ids and weights in an index file, without decoding the records (for the build script). */
export function readIndexEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + length)));
  if (header.v !== VERSION || header.chars !== CHARS) return [];
  let at = 4 + length;
  return header.fonts.map(([id, ...weights]) => {
    const styles = weights.map(weight => {
      const record = bytes.slice(at, at + RECORD_BYTES);
      at += RECORD_BYTES;
      return { weight, record };
    });
    return { id, styles };
  });
}

/**
 * Lengths of the ink runs a horizontal line at height y crosses, from polygon outlines
 * (non-zero winding, as fonts are filled). polygons: [[[x, y], ...], ...].
 */
export function runsAt(polygons, y) {
  const crossings = [];
  for (const poly of polygons) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      if (y1 === y2) continue;
      if ((y >= Math.min(y1, y2)) && (y < Math.max(y1, y2))) {
        crossings.push({ x: x1 + ((y - y1) / (y2 - y1)) * (x2 - x1), dir: y2 > y1 ? 1 : -1 });
      }
    }
  }
  crossings.sort((a, b) => a.x - b.x);
  const runs = [];
  let winding = 0;
  let start = 0;
  for (const c of crossings) {
    const before = winding;
    winding += c.dir;
    if (before === 0 && winding !== 0) start = c.x;
    else if (before !== 0 && winding === 0) runs.push(c.x - start);
  }
  return runs;
}

export const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
