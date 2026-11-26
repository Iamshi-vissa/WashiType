"""Writes src/styles.css from styles.template.css, inlining the washi, brush, deckle and seal-ink
textures as SVG data URIs. Run: python3 scripts/build-css.py"""
from pathlib import Path
from urllib.parse import quote

root = Path(__file__).resolve().parent.parent

FIBRES = "".join(
    f"<path d='{d}'/>"
    for d in [
        "M163 202Q149 192 135 208", "M183 211Q178 206 171 211", "M227 285Q221 288 223 295", "M33 291Q39 304 55 298", "M354 347Q353 334 337 332", "M57 5Q61 16 75 13", "M68 87Q64 84 60 89", "M159 303Q160 292 146 288", "M180 238Q171 245 177 256", "M359 358Q367 345 352 333", "M113 83Q116 91 126 89", "M276 144Q260 143 256 162", "M345 305Q342 309 347 313", "M328 169Q310 166 304 187", "M26 227Q14 236 23 252", "M31 120Q45 108 33 91", "M42 89Q45 94 52 92", "M287 64Q276 58 268 71", "M69 263Q70 257 62 255", "M42 151Q36 156 40 164", "M350 289Q358 290 361 280", "M76 142Q78 126 59 121", "M36 356Q30 361 35 369", "M278 118Q281 127 291 125", "M32 210Q31 202 22 202", "M134 163Q120 152 105 166",
    ]
)
WASHI = (
    "<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'>"
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 .42 0 0 0 0 .35 0 0 0 0 .25 0 0 0 .1 0'/></filter>"
    "<rect width='100%' height='100%' filter='url(#n)'/>"
    f"<g fill='none' stroke='#9a8566' stroke-opacity='.16' stroke-width='.6' stroke-linecap='round'>{FIBRES}</g></svg>"
)

# A dry-brush stroke: tapered ends, ragged edges, streaks where the brush ran dry.
BRUSH = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 80' preserveAspectRatio='none'>"
    "<filter id='b' x='-5%' y='-30%' width='110%' height='160%'>"
    "<feTurbulence type='fractalNoise' baseFrequency='.004 .3' numOctaves='3' seed='8' result='n'/>"
    "<feColorMatrix in='n' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -4 0 0 0 3.35' result='s'/>"
    "<feComposite in='SourceGraphic' in2='s' operator='in' result='d'/>"
    "<feTurbulence type='fractalNoise' baseFrequency='.05' numOctaves='2' seed='3' result='w'/>"
    "<feDisplacementMap in='d' in2='w' scale='9' xChannelSelector='R' yChannelSelector='G'/></filter>"
    "<path filter='url(#b)' fill='#000' d='M4 44C40 26 120 20 200 20S350 16 396 30C398 40 392 52 380 56"
    "C300 62 220 58 150 62S50 70 10 62C2 58 0 50 4 44Z'/></svg>"
)

# A sheet with a torn (deckled) edge, used as a mask on the paper cards.
DECKLE = (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500' preserveAspectRatio='none'>"
    "<filter id='e' x='-5%' y='-5%' width='110%' height='110%'>"
    "<feTurbulence type='fractalNoise' baseFrequency='.09' numOctaves='3' seed='5'/>"
    "<feDisplacementMap in='SourceGraphic' scale='7' xChannelSelector='R' yChannelSelector='G'/></filter>"
    "<rect x='5' y='5' width='390' height='490' fill='#000' filter='url(#e)'/></svg>"
)

# Uneven seal ink: mostly solid, with the small gaps a real stamp leaves.
INK = (
    "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>"
    "<filter id='i'><feTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='2' seed='4' stitchTiles='stitch'/>"
    "<feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 2.25'/></filter>"
    "<rect width='100%' height='100%' filter='url(#i)'/></svg>"
)

uri = lambda svg: '"data:image/svg+xml,' + quote(svg, safe="/:=' ") + '"'

css = (root / "styles.template.css").read_text()
for key, svg in {"WASHI": WASHI, "BRUSH": BRUSH, "DECKLE": DECKLE, "INK": INK}.items():
    css = css.replace("{{" + key + "}}", uri(svg))
(root / "src" / "styles.css").write_text(css)
print("Wrote src/styles.css")
