// Well-known fonts that aren't free, so they aren't in the catalog, and the free fonts in it
// that come closest. Searching for one of them explains why it's missing and offers these.
//   same       free fonts with the same letter widths (metric-compatible): swap one in and a
//              document keeps its line breaks and page count
//   like       free fonts with a similar look
//   comesWith  where people usually already have it, when it's part of a system or Office
// Every id must be in public/fonts.json (tests check this).

export const COMMERCIAL = [
  { name: 'Times New Roman', aliases: ['Times', 'Times Roman', 'TNR'], comesWith: 'Windows and macOS', same: ['tinos'], like: ['stix-two-text', 'pt-serif', 'libre-baskerville'] },
  { name: 'Arial', comesWith: 'Windows and macOS', same: ['arimo'], like: ['roboto', 'open-sans', 'noto-sans'] },
  { name: 'Helvetica', aliases: ['Helvetica Neue', 'Neue Haas Grotesk'], comesWith: 'Apple devices', same: ['arimo'], like: ['inter', 'work-sans', 'roboto'] },
  { name: 'Courier New', aliases: ['Courier'], comesWith: 'Windows and macOS', same: ['cousine'], like: ['courier-prime', 'ibm-plex-mono'] },
  { name: 'Calibri', comesWith: 'Windows and Microsoft Office', same: ['carlito'], like: ['open-sans', 'lato'] },
  { name: 'Cambria', comesWith: 'Windows and Microsoft Office', same: ['caladea'], like: ['pt-serif', 'noto-serif'] },
  { name: 'Georgia', comesWith: 'Windows and macOS', same: ['gelasio'], like: ['pt-serif', 'domine'] },
  { name: 'Verdana', comesWith: 'Windows and macOS', like: ['pt-sans', 'noto-sans', 'open-sans'] },
  { name: 'Tahoma', comesWith: 'Windows', like: ['pt-sans', 'noto-sans'] },
  { name: 'Trebuchet MS', aliases: ['Trebuchet'], comesWith: 'Windows and macOS', like: ['fira-sans', 'cabin'] },
  { name: 'Segoe UI', aliases: ['Segoe'], comesWith: 'Windows', like: ['open-sans', 'noto-sans', 'inter'] },
  { name: 'Consolas', comesWith: 'Windows and Microsoft Office', like: ['inconsolata', 'jetbrains-mono'] },
  { name: 'Comic Sans MS', aliases: ['Comic Sans'], comesWith: 'Windows and macOS', like: ['comic-neue', 'comic-relief'] },
  { name: 'Impact', comesWith: 'Windows and macOS', like: ['anton', 'oswald', 'bebas-neue'] },
  { name: 'San Francisco', aliases: ['SF Pro', 'SF Pro Display', 'SF Pro Text'], comesWith: 'Apple devices', like: ['inter', 'figtree'] },
  { name: 'Futura', like: ['jost', 'league-spartan', 'outfit'] },
  { name: 'Gotham', like: ['montserrat', 'figtree'] },
  { name: 'Proxima Nova', aliases: ['Proxima'], like: ['montserrat', 'figtree', 'plus-jakarta-sans'] },
  { name: 'Avenir', aliases: ['Avenir Next'], like: ['nunito-sans', 'mulish', 'figtree'] },
  { name: 'Gill Sans', like: ['cabin'] },
  { name: 'Century Gothic', like: ['questrial', 'didact-gothic'] },
  { name: 'Franklin Gothic', aliases: ['ITC Franklin Gothic'], like: ['libre-franklin'] },
  { name: 'Myriad', aliases: ['Myriad Pro'], like: ['pt-sans', 'source-sans-3'] },
  { name: 'DIN', aliases: ['DIN Pro', 'DIN Next', 'DIN 1451'], like: ['barlow', 'barlow-condensed'] },
  { name: 'Garamond', aliases: ['Adobe Garamond', 'ITC Garamond', 'Garamond Premier'], like: ['eb-garamond', 'cormorant-garamond'] },
  { name: 'Baskerville', like: ['libre-baskerville', 'baskervville'] },
  { name: 'Bodoni', like: ['bodoni-moda'] },
  { name: 'Didot', like: ['gfs-didot', 'playfair-display'] },
  { name: 'Rockwell', like: ['arvo', 'roboto-slab', 'zilla-slab'] },
  { name: 'Trajan', aliases: ['Trajan Pro'], like: ['cinzel'] }
];

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The commercial font a search is looking for, or null. Matches the name or an alias in full,
 * the start of one ("times" finds Times New Roman), or a longer search that starts with one
 * ("arial black" finds Arial). A search that names a font in the catalog matches nothing
 * ("Courier Prime" is free).
 */
export function commercialMatch(query, catalogNames = new Set()) {
  const q = norm(query);
  if (q.length < 3 || catalogNames.has(q)) return null;
  for (const entry of COMMERCIAL) {
    for (const name of [entry.name, ...(entry.aliases ?? [])]) {
      const k = norm(name);
      if (q === k || (q.length >= 4 && k.startsWith(q)) || (k.length >= 4 && q.startsWith(k))) return entry;
    }
  }
  return null;
}

export const normalizeName = norm;
