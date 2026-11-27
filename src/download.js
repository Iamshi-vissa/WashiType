// "Download font": fetches a font's desktop files and saves them as one .zip, with the
// licence, so it can be installed and used anywhere (Word, Figma, Photoshop, Canva...).
//   Google Fonts      the TTF/OTF files in github.com/google/fonts (pinned commit)
//   other foundries   Fontsource's TTF for each weight and style
//   Fontshare         not here: its licence asks for downloads to come from fontshare.com
// public/downloads.json (written by scripts/build-catalog.mjs) says where each font's files are.

let manifest = null;
async function getManifest() {
  if (!manifest) {
    manifest = fetch('/downloads.json').then(res => {
      if (!res.ok) throw new Error(`downloads.json: ${res.status}`);
      return res.json();
    });
    manifest.catch(() => (manifest = null)); // let a later click try again
  }
  return manifest;
}

const LICENCE_TEXT = {
  OFL: 'SIL Open Font License 1.1 — https://openfontlicense.org',
  Apache: 'Apache License 2.0 — https://www.apache.org/licenses/LICENSE-2.0',
  UFL: 'Ubuntu Font Licence 1.0 — https://ubuntu.com/legal/font-licence',
  MIT: 'MIT License — https://opensource.org/license/mit',
  Unlicense: 'The Unlicense (public domain) — https://unlicense.org'
};

/** Whether this font can be downloaded from Washi Type (Fontshare fonts link to Fontshare). */
export const canDownload = font => font.src === 'g' || font.src === 'o';

/** The files to fetch: [{ url, name }]. Null when the font isn't in downloads.json. */
async function fileList(font) {
  const m = await getManifest();
  if (font.src === 'g') {
    const entry = m.g[font.id];
    if (!entry) return null;
    const [folder, licence, ...fonts] = entry;
    const base = m.google + folder + '/';
    return [...fonts, licence]
      .filter(Boolean)
      .map(name => ({ url: base + name.split('/').map(encodeURIComponent).join('/'), name }));
  }
  if (font.src === 'o') {
    const subset = m.o[font.id];
    if (!subset) return null;
    const styles = font.i ? ['normal', 'italic'] : ['normal'];
    const stem = font.f.replace(/[^A-Za-z0-9]+/g, '');
    return font.w.flatMap(w =>
      styles.map(style => ({
        url: `https://cdn.jsdelivr.net/fontsource/fonts/${font.pk}@latest/${subset}-${w}-${style}.ttf`,
        name: `${stem}-${w}${style === 'italic' ? 'Italic' : ''}.ttf`
      }))
    );
  }
  return null;
}

async function fetchFile({ url, name }, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onBytes(buf.length);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) (out.set(chunk, at), (at += chunk.length));
  return out;
}

function readme(font) {
  const licence = LICENCE_TEXT[font.l] ?? font.l ?? 'Open-source licence';
  return [
    font.f,
    '',
    `Licence: ${licence}${font.lu ? `\nLicence text: ${font.lu}` : ''}`,
    font.by ? `By: ${font.by}` : null,
    'Free for personal and commercial use under that licence.',
    '',
    'Install',
    '  Mac:     double-click a font file, then Install Font.',
    '  Windows: right-click a font file, then Install (or Install for all users).',
    '  Linux:   copy the files to ~/.local/share/fonts and run fc-cache -f.',
    '',
    'Files with [wght] (or other axes) in the name are variable fonts: one file holds every',
    'weight. Most current apps show each weight by name; a few older ones show only one.',
    '',
    `Found on Washi Type: https://washi-type.vercel.app/fonts/${font.id}`
  ]
    .filter(line => line !== null)
    .join('\n');
}

/**
 * Download every desktop file of a font as "<Family>.zip".
 * @param onProgress called with a number from 0 to 1 while the files arrive
 * @returns false when the font has no files listed (link to its source instead)
 */
export async function downloadFont(font, onProgress = () => {}) {
  const files = await fileList(font);
  if (!files?.length) return false;
  onProgress(0);
  // Sizes aren't known up front; count finished files, and bytes within the current ones.
  let done = 0;
  let bytes = 0;
  const report = () => onProgress(Math.min(0.99, (done + Math.min(0.9, bytes / 400000)) / files.length));
  const contents = await Promise.all(
    files.map(file =>
      fetchFile(file, n => ((bytes += n), report())).then(data => {
        done += 1;
        bytes = 0;
        report();
        return data;
      })
    )
  );
  const { zip } = await import('fflate');
  const entries = { 'READ ME.txt': [new TextEncoder().encode(readme(font)), { level: 6 }] };
  files.forEach((file, i) => (entries[`${font.f}/${file.name}`] = [contents[i], { level: 6 }]));
  const archive = await new Promise((resolve, reject) =>
    zip(entries, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)))
  );
  const href = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
  const link = Object.assign(document.createElement('a'), { href, download: `${font.f}.zip` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
  onProgress(1);
  return true;
}
