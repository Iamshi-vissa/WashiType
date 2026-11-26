# Washi Type

A font finder dressed as a calligrapher's desk, with every free font from Google Fonts, Fontshare and independent open-source foundries in one place. Every font is brushed onto its own sheet of washi (handmade Japanese paper) in your own words. Stamp the fonts you like with a red seal (hanko), open a sheet to see every weight and copy the embed code, or press and hold the sheet to crumple it.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Theme

- **Language:** the look is Japanese, but every word in the interface is English.
- **Colours:** washi off-white paper, sumi black ink, and one vermilion red (shu) from calligraphy seals. Dark mode is the same desk at night.
- **Lettering:** Shippori Mincho for headings, Yuji Boku for the brushed name in the hero, Yuji Syuku for handwritten notes, Zen Antique inside the seals. All come from Google Fonts.
- **Textures:** washi fibres, the dry-brush stroke, the torn paper edge and the uneven seal ink are SVGs inlined by `scripts/build-css.py`. Edit `styles.template.css`, then run `python3 scripts/build-css.py` to regenerate `src/styles.css`.

## What's inside

- `public/fonts.json`: the merged catalog, built by `scripts/build-catalog.mjs` from three sources. Every font is free for personal and commercial use:
  - **Google Fonts** (1,907 families) from the `google-font-metadata` package.
  - **Fontshare** by the Indian Type Foundry (65 families not already on Google Fonts), under the ITF Free Font License. Fonts load from Fontshare's CSS API; downloads link to fontshare.com, because the licence doesn't allow redistributing the files.
  - **Independent open-source foundries** collected by Fontsource (119 families: Velvetyne, The League of Moveable Type, GNOME and more), loaded from jsDelivr.
  - `npm run build` refreshes Fontshare and Fontsource from their live APIs and falls back to the snapshots in `data/` if they can't be reached. `npm run catalog` rebuilds from the snapshots only.
- `src/App.jsx`: search, preview text, size, category and script filters, sorting, stamped fonts (kept in localStorage), and `#font-id` links that open a sheet directly.
- `src/components/HeroScroll.jsx`: the hanging sheet where "Washi Type" is brushed stroke by stroke, then stamped.
- `src/components/Hanko.jsx`: the red seal used for saving fonts and in the logo.
- `src/components/FontCard.jsx`: one washi sheet in the grid. Fonts load only as their sheet scrolls into view, batched into one Google Fonts request.
- `src/components/SpecimenSheet.jsx` and `drawSheet.js`: the detail view. `drawSheet` paints the specimen on washi with a torn edge and a seal, and `PaperCrumple` turns it into paper you can crumple. three.js loads only when a sheet is opened.
- `src/components/reactbits/`: ReactBits components:
  - **FoldText**: the title folds in like paper.
  - **StrokeText**: brushes the hero lettering.
  - **TearTicket**: the embed code is a ticket; tear off the stub to copy it.
  - **Shredder**: the Stamped drawer; drag a font slip into the shredder to remove its stamp.
  - **SwipeToast**: notes for stamping, copying and shredding (with Undo).
  - **SquishSwitch**: the "Variable only" switch.
  - **WarmTooltip**: tooltips on the stamp buttons.
  - **RotatingText**, **CountUp** and **ClickSpark** (ink splatter on click).
- `src/components/StampDrawer.jsx`: the Stamped drawer built around Shredder.
- `src/components/Select.jsx`: the Script and Sort dropdowns, which always open downwards.

## Next steps

- More sources (Fontshare, Font Squirrel) with their own license filter.
- Font pairing suggestions on each sheet.
- Identify a font from a screenshot.
