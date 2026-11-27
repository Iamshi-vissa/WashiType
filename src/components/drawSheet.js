// Paints a font specimen onto a sheet of washi (handmade Japanese paper) and returns a PNG data URL.
// PaperCrumple uses the picture as the paper's texture. Pixels outside the torn (deckled)
// edge are transparent, so the crumpled sheet keeps its ragged outline.
import { CATEGORY_NAME } from '../data.js';

const SOURCE_NAME = { g: 'Google Fonts', fs: 'Fontshare', o: 'Fontsource' };

import { SHEET_PAPER } from '../paperSettings.js';

export const SHEET_W = SHEET_PAPER.width;
export const SHEET_H = SHEET_PAPER.height;
const S = 2; // draw at 2x for a crisp texture

const SUMI = '#1a1816';
const SHU = '#c8341f';
const RTL = /[֐-ࣿ]/;
const NO_SPACES = /[\u3000-\u9FFF\uAC00-\uD7AF\u0E00-\u0EFF\u1780-\u17FF]/;

function wrap(ctx, text, maxWidth) {
  const unspaced = NO_SPACES.test(text) && !text.includes(' ');
  const tokens = unspaced ? [...text] : text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const token of tokens) {
    const next = line ? line + (unspaced ? '' : ' ') + token : token;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = token;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function deckle(ctx, W, H, rand) {
  const inset = 10;
  const pts = [];
  const edge = (x0, y0, x1, y1, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const j = (rand() - 0.5) * 9;
      const x = x0 + (x1 - x0) * t + (y0 === y1 ? 0 : j);
      const y = y0 + (y1 - y0) * t + (y0 === y1 ? j : 0);
      pts.push([x, y]);
    }
  };
  edge(inset, inset, W - inset, inset, 90);
  edge(W - inset, inset, W - inset, H - inset, 110);
  edge(W - inset, H - inset, inset, H - inset, 90);
  edge(inset, H - inset, inset, inset, 110);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function seal(ctx, x, y, size, rand) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.fillStyle = SHU;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.12);
  else ctx.rect(-size / 2, -size / 2, size, size);
  ctx.fill();
  ctx.fillStyle = '#fbf6ec';
  ctx.font = `400 ${size * 0.4}px "Zen Antique", "Shippori Mincho", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('W', 0, -size * 0.2);
  ctx.fillText('T', 0, size * 0.22);
  // Uneven ink, as from a real stamp
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 160; i++) {
    ctx.globalAlpha = rand() * 0.5;
    ctx.fillRect((rand() - 0.5) * size, (rand() - 0.5) * size, 2 + rand() * 3, 2 + rand() * 2);
  }
  ctx.restore();
}

/** Draws the sheet and resolves to an object URL of the PNG. */
export function drawSheet(font, text) {
  const W = SHEET_W * S;
  const H = SHEET_H * S;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const family = `"${font.f}", "Instrument Sans", sans-serif`;
  const regular = font.w.includes(400) ? 400 : font.w[0];
  let seed = font.id.length * 977 + 13;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Washi with a torn edge
  deckle(ctx, W, H, rand);
  ctx.fillStyle = '#f7f3ea';
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Paper grain: one small noise tile, drawn once and repeated (was 2,400 separate fills).
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  // Fibres
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 90; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const len = 20 + rand() * 70;
    const a = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(150,128,96,${0.08 + rand() * 0.14})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 1) * len * 0.5, y + Math.sin(a + 1) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  // The centre fold calligraphy paper is creased along
  const fold = ctx.createLinearGradient(W / 2 - 6, 0, W / 2 + 6, 0);
  fold.addColorStop(0, 'rgba(0,0,0,0)');
  fold.addColorStop(0.5, 'rgba(70,50,20,0.06)');
  fold.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fold;
  ctx.fillRect(W / 2 - 6, 0, 12, H);
  ctx.restore();

  const left = 64;
  const right = W - 64;
  const width = right - left;

  // Category note, top right
  ctx.fillStyle = 'rgba(26,24,22,0.6)';
  ctx.font = '500 26px "Shippori Mincho", serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${CATEGORY_NAME[font.c]} · ${font.w.length} ${font.w.length === 1 ? 'weight' : 'weights'}`, right, 58);
  ctx.fillText(SOURCE_NAME[font.src] ?? '', right, 90);
  ctx.textAlign = 'left';

  // Family name
  ctx.fillStyle = SUMI;
  let nameSize = 88;
  ctx.font = `${regular} ${nameSize}px ${family}`;
  while (ctx.measureText(font.f).width > width && nameSize > 40) {
    nameSize -= 4;
    ctx.font = `${regular} ${nameSize}px ${family}`;
  }
  ctx.fillText(font.f, left, 168);

  // The person's text
  const rtl = RTL.test(text);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  let size = 54;
  let lines = [];
  for (; size >= 30; size -= 4) {
    ctx.font = `${regular} ${size}px ${family}`;
    lines = wrap(ctx, text, width);
    if (lines.length <= 4) break;
  }
  const lead = Math.round(size * 1.35);
  let y = 168 + 40 + lead;
  for (const line of lines.slice(0, 4)) {
    ctx.fillText(line, rtl ? right : left, y);
    y += lead;
  }
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';

  // Alphabet, for fonts that cover Latin
  if (font.s.includes('latin')) {
    ctx.fillStyle = 'rgba(26,24,22,0.72)';
    ctx.font = `${regular} 32px ${family}`;
    let ay = y + 18;
    for (const row of ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz', '0123456789 &?!']) {
      if (ay > H - 170) break;
      ctx.fillText(row.split('').join(' '), left, ay);
      ay += 50;
    }
  }

  // Weight strip
  const weights = font.w.slice(0, 9);
  const cell = (width - 120) / Math.max(weights.length, 5);
  weights.forEach((w, i) => {
    ctx.fillStyle = SUMI;
    ctx.font = `${w} 42px ${family}`;
    ctx.fillText('Aa', left + i * cell, H - 82);
    ctx.fillStyle = 'rgba(26,24,22,0.55)';
    ctx.font = '500 19px "Instrument Sans", sans-serif';
    ctx.fillText(String(w), left + i * cell, H - 50);
  });

  // Red seal, bottom right
  seal(ctx, right - 44, H - 92, 88, rand);

  // toBlob encodes the PNG off the main thread (toDataURL blocked it). The caller owns the
  // returned object URL and must revoke it.
  return new Promise((resolve, reject) =>
    canvas.toBlob(blob => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Could not draw the sheet'))), 'image/png')
  );
}

let grain = null;
function grainTile() {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 160;
  const g = grain.getContext('2d');
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(110,90,60,${rand() * 0.05})`;
    g.fillRect(rand() * 160, rand() * 160, 2, 2);
  }
  return grain;
}
