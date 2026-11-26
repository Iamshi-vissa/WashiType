# Washi Type

A font finder dressed as a calligrapher's desk. More than 2,000 free fonts from Google Fonts, Fontshare and independent open-source foundries, each written out on its own sheet of washi (handmade Japanese paper) in your own words. Stamp the fonts you like with a red seal, open a sheet to see every weight, tear off the ticket to copy the embed code, or press and hold the sheet to crumple it.

**Live:** https://washi-type.vercel.app

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # refreshes the font catalog, then builds dist/
npm run preview    # serves the production build on http://localhost:4173
npm run lint       # ESLint
npm test           # browser tests against the production build (run npm run build first)
```

`npm test` uses Playwright. The first time, install its browser with `npx playwright install chromium`, or point it at a Chrome you already have: `PW_CHROME=/path/to/chrome npm test`.

## Features

- **Write something:** every sheet shows your text in its font. With no text, each font shows a sample in a script it actually has, so a Khmer-only font isn't previewed in English.
- **Filters:** source, category, script (27 scripts, including Devanagari, Tamil, Bengali, Japanese and Arabic), variable fonts only, and four sort orders.
- **Font sheets:** every weight (with an italic toggle), licence, source, designer, a crumplable specimen, and the embed code on a ticket you tear to copy. Each sheet has its own link, such as `/#inter`.
- **Stamped fonts:** press the seal on any sheet to keep it. The Stamped drawer lists them as paper slips; drag one into the shredder (or press Delete) to remove it, with Undo. Stamps stay in this browser.
- **Errors you can read:** a retro TV shows what went wrong instead of a blank page (see below).
- **Works offline after the first visit:** a service worker keeps a copy of the site.

## Where the fonts come from

`scripts/build-catalog.mjs` builds `public/fonts.json` from three sources. Every font in it is free for personal and commercial use.

| Source | Fonts | Licence | Loaded from |
|---|---|---|---|
| Google Fonts | 1,907 | Mostly SIL Open Font License | fonts.googleapis.com |
| Fontshare (Indian Type Foundry) | 65 not already on Google Fonts | ITF Free Font License | api.fontshare.com |
| Independent foundries via Fontsource | 119 | OFL, Apache, MIT, CC0, Unlicense | cdn.jsdelivr.net (pinned to `@fontsource/*@5`) |

- `npm run build` refreshes Fontshare and Fontsource from their live APIs and falls back to the snapshots in `data/` if they can't be reached. `npm run catalog` rebuilds from the snapshots only.
- The build checks the catalog (unique ids, valid weights and categories, enough Google fonts) and fails rather than ship a broken one. A single malformed entry from a live API is skipped, not fatal.
- Fontshare's licence doesn't allow redistributing the files, so Washi Type only displays them through Fontshare's servers and links to fontshare.com for downloads.

## Error screens

| What happened | What you see |
|---|---|
| An address that doesn't exist (e.g. `/fonts/inter`) | Vercel serves `404.html` with a real 404 status: the TV shows **NOT FOUND 404** |
| A link to a font that isn't in the catalog, or a garbled link | The TV in a dialog, with a button to search for the name |
| The font list can't be loaded | Retries twice, then the TV shows **NO SIGNAL 503** with Try again |
| You're offline | **NO SIGNAL OFF**; it retries by itself when the connection returns. If the site was visited before, it opens from the offline copy with a "you're offline" bar |
| A code file from an older deploy is gone, or anything crashes | Reloads once to pick up the new deploy; if that doesn't fix it, the TV shows **ERROR ERR** with Reload. A crash inside a font sheet only replaces that sheet |

The TV is `src/components/TvError/`, adapted from [Uiverse.io by Praashoo7](https://uiverse.io/Praashoo7/fat-horse-65) (MIT License, Copyright (c) Praashoo7 (Prashant)). Its classes are prefixed `tv404-` so they can't collide with the site's styles. `src/components/ErrorScreen.jsx` puts the words and buttons around it.

## Project structure

```
index.html, 404.html          two entry pages (the app and the 404 page)
public/
  fonts.json                  the merged catalog (generated)
  sw.js                       service worker: network first, offline copy as fallback
  favicon.svg, og.jpg         tab icon and link preview image
data/                         snapshots of the Fontshare and Fontsource catalogs
scripts/
  build-catalog.mjs           builds and checks public/fonts.json
  build-css.py                writes src/styles.css from styles.template.css
src/
  App.jsx                     page, filters, catalog loading, links, dialogs
  main.jsx, notfound.jsx      entry points (error boundary, service worker)
  data.js                     categories, scripts and samples, sorts, featured fonts
  fontLoader.js               loads each font from its own source; embed code; source links
  focus.js, useMedia.js       focus return after dialogs; media-query hook
  components/
    FontCard.jsx              one sheet in the grid (font loads when it scrolls into view)
    SpecimenSheet.jsx         the font sheet (lazy-loaded with three.js)
    drawSheet.js              paints the specimen on washi for the crumple
    StampDrawer.jsx           Stamped drawer with the shredder (lazy-loaded)
    Select.jsx                dropdowns that always open downwards
    HeroScroll.jsx, Hanko.jsx hero sheet and the red seal
    ErrorBoundary.jsx, ErrorScreen.jsx, TvError/   error handling and the TV
    PaperCrumple/             crumplable paper; the fold simulation runs in a Web Worker
    reactbits/                ReactBits components (see below)
tests/app.spec.js             Playwright tests for the main flows and every error path
vercel.json                   security headers (CSP and others) and caching
.github/workflows/ci.yml      lint, build and tests on every push
```

## Styles

`styles.template.css` is the stylesheet you edit. The washi fibres, dry-brush stroke, torn paper edge and seal ink are SVG textures inlined by `scripts/build-css.py`, which writes `src/styles.css`. After changing the template, run `npm run css`. Don't edit `src/styles.css` directly.

Colours: washi off-white, sumi black and one vermilion red (shu). Dark mode is the same desk at night. Lettering: Shippori Mincho for headings, Yuji Boku and Yuji Syuku for brush lettering, Zen Antique in the seals, Instrument Sans for the interface.

## ReactBits components

Copied into `src/components/reactbits/` from [ReactBits](https://reactbits.dev): FoldText, StrokeText, RotatingText, CountUp, ClickSpark, TearTicket, Shredder, SwipeToast, SquishSwitch and WarmTooltip.

Local changes to keep when updating them:

- **TearTicket:** `onTear` fires the moment the stub is let go (inside the pointer-up handler), not after it finishes falling. Browsers such as Safari only allow copying to the clipboard during a user gesture.
- **PaperCrumple:** the fold simulation was moved to `paperPath.js` and runs in `paperPath.worker.js`, cached by its settings. Opening a sheet no longer freezes the page.

## Security and performance

- `vercel.json` sets a Content-Security-Policy that only allows the site itself plus the three font services, along with `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`. Built code files are cached for a year; `sw.js` is never cached.
- Licence links from third-party data are kept only if they're plain `http(s)` links.
- The three.js font sheet and the Stamped drawer load only when opened. Sheets far off screen skip layout and paint (`content-visibility`), and typing updates the sheets in the background, so the input stays responsive with hundreds of sheets on the page.

## Deploying

Vercel builds every push to `main` with `npm run build` and serves `dist/`. Unknown addresses get `404.html` automatically.
