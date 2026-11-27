// Runs after `vite build`. Writes a real HTML page for every font (dist/fonts/<id>/index.html)
// with its own title, description, canonical link and readable content, plus sitemap.xml
// and robots.txt, so search engines can find all of them. The app takes over in the browser.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SITE = (process.env.SITE_URL || 'https://washi-type.vercel.app').replace(/\/$/, '');
const dist = new URL('../dist/', import.meta.url);
const shell = readFileSync(new URL('index.html', dist), 'utf8');
const fonts = JSON.parse(readFileSync(new URL('fonts.json', dist), 'utf8'));

const esc = value =>
  String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CATEGORY = { s: 'sans serif', r: 'serif', d: 'display', h: 'handwriting', m: 'monospace' };
const SOURCE = { g: 'Google Fonts', fs: 'Fontshare', o: 'Fontsource' };
const LICENCE = {
  OFL: 'SIL Open Font License', Apache: 'Apache License 2.0', UFL: 'Ubuntu Font Licence',
  CC0: 'CC0 (public domain)', Unlicense: 'The Unlicense', MIT: 'MIT License', ITF: 'ITF Free Font License'
};
const sourceUrl = f =>
  f.src === 'fs'
    ? `https://www.fontshare.com/fonts/${encodeURIComponent(f.slug)}`
    : f.src === 'o'
      ? `https://fontsource.org/fonts/${encodeURIComponent(f.pk)}`
      : `https://fonts.google.com/specimen/${encodeURIComponent(f.f).replace(/%20/g, '+')}`;
const pagePath = f => `/fonts/${encodeURIComponent(f.id)}`;

// Swap one tag's content attribute in the shell's <head>.
const setMeta = (html, pattern, replacement) => {
  if (!pattern.test(html)) throw new Error(`prerender: ${pattern} not found in index.html`);
  return html.replace(pattern, replacement);
};

// A few fonts in the same category, for internal links between pages.
const byCategory = new Map();
for (const f of fonts) byCategory.set(f.c, [...(byCategory.get(f.c) || []), f]);

let pages = 0;
for (const f of fonts) {
  const category = CATEGORY[f.c] ?? 'display';
  const weights = `${f.w.length} ${f.w.length === 1 ? 'weight' : 'weights'}`;
  const title = `${f.f}: free ${category} font · Washi Type`;
  const description = `${f.f} is a free ${category} font from ${SOURCE[f.src]} with ${weights}${f.i ? ' and italics' : ''}. Preview it in your own words, see every weight and copy the embed code.`;
  const url = SITE + pagePath(f);
  const siblings = byCategory.get(f.c);
  const at = siblings.indexOf(f);
  const related = [1, 2, 3, 4, 5, 6].map(n => siblings[(at + n * 7) % siblings.length]).filter(r => r !== f);

  let html = shell;
  html = setMeta(html, /<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = setMeta(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`);
  html = setMeta(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${esc(url)}" />`);
  html = setMeta(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)}" />`);
  html = setMeta(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(description)}" />`);
  html = setMeta(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(url)}" />`);
  const facts = [
    ['Category', category],
    ['Styles', `${weights}${f.i ? ', with italics' : ''}`],
    ['Source', SOURCE[f.src]],
    ['Licence', LICENCE[f.l] ?? 'Open-source licence'],
    f.by ? ['Designer', f.by] : null
  ].filter(Boolean);
  const body = `<main class="band prerender">
      <p><a href="/">Washi Type</a> · free fonts</p>
      <h1>${esc(f.f)}</h1>
      <p>${esc(description)}</p>
      <dl>${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <p><a href="${esc(sourceUrl(f))}">Get ${esc(f.f)} on ${esc(SOURCE[f.src])}</a></p>
      <h2>More ${esc(category)} fonts</h2>
      <ul>${related.map(r => `<li><a href="${esc(pagePath(r))}">${esc(r.f)}</a></li>`).join('')}</ul>
    </main>`;
  html = setMeta(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  const dir = new URL(`fonts/${f.id}/`, dist);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('index.html', dir), html);
  pages += 1;
}

const today = new Date().toISOString().slice(0, 10);
const urls = [
  `  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>`,
  ...fonts.map(f => `  <url><loc>${esc(SITE + pagePath(f))}</loc>${f.u ? `<lastmod>${esc(f.u)}</lastmod>` : ''}</url>`)
];
writeFileSync(
  new URL('sitemap.xml', dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
);
writeFileSync(new URL('robots.txt', dist), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Prerendered ${pages} font pages, sitemap.xml (${urls.length} URLs) and robots.txt`);
