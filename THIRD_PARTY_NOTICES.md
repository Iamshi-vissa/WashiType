# Third-party code and fonts

Washi Type's own code is under the MIT License in [`LICENSE`](LICENSE). These parts come from
other projects and keep their own licences; the MIT License above does not apply to them.

| Part | Where it is | Licence |
|---|---|---|
| ReactBits components: ClickSpark, CountUp, FoldText, RotatingText, Shredder, SquishSwitch, StrokeText, SwipeToast, TearTicket, WarmTooltip | `src/components/reactbits/` | MIT + Commons Clause, Copyright (c) 2026 David Haz. See [`src/components/reactbits/LICENSE.md`](src/components/reactbits/LICENSE.md) |
| PaperCrumple (ReactBits) | `src/components/PaperCrumple/` | Same ReactBits licence. See [`src/components/PaperCrumple/LICENSE.md`](src/components/PaperCrumple/LICENSE.md) |
| Untouched copies of the changed ReactBits files, and the patches against them | `vendor/originals/`, `vendor/patches/` | Same ReactBits licence |
| TV error screen, from Uiverse.io by Praashoo7 (fat-horse-65) | `src/components/TvError/` | MIT, Copyright (c) Praashoo7 (Prashant). See [`src/components/TvError/LICENSE`](src/components/TvError/LICENSE) |
| On/Off switch, from Uiverse.io by m1her (odd-fireant-56) | `src/components/OnOffSwitch/` | MIT, Copyright (c) m1her (Maher Nas). See [`src/components/OnOffSwitch/LICENSE`](src/components/OnOffSwitch/LICENSE) |

The ReactBits licence allows using its components in a website or product, including a
commercial one, but not selling or redistributing the components themselves. If you reuse
this project, the ReactBits files come with that condition.

## Fonts

The fonts aren't part of this repository. The site loads them from Google Fonts, Fontshare and
jsDelivr (Fontsource), and each font is under its own licence, shown on its sheet: mostly the
SIL Open Font License, the Apache License or the ITF Free Font License (Fontshare). The
catalog in `public/fonts.json` only lists names, styles and licence names.

- **Downloads:** "Download font" fetches the font files from github.com/google/fonts (Google
  Fonts) or jsDelivr (Fontsource) in the visitor's browser and zips them there, with the font's
  own licence file (Google Fonts) or a note naming the licence. `data/google-files.json` and
  `public/downloads.json` only list file names.
- **Font detector index:** `public/font-index.bin` holds measurements taken from the font files
  (letter sizes, positions and stroke thickness), not the fonts' outlines or any font data.
- **Test fixture:** `tests/fixtures/arvo-latin-400-normal.woff2` is the Latin subset of Arvo by
  Anton Koovit, under the SIL Open Font License 1.1 (`tests/fixtures/Arvo-OFL.txt`), used only
  by the tests.

npm packages used to build and run the site are under their own licences, listed in
`package-lock.json` and each package's folder in `node_modules/`; the one added for downloads,
fflate (zip files), is MIT. The Google Fonts snapshot in
`data/google-fonts.json` is trimmed from the data files of google-font-metadata (MIT).
