# Washi Type

A font finder dressed as a calligrapher's desk. Every font is brushed onto its own sheet of washi (handmade Japanese paper) in your own words. Stamp the fonts you like with a red seal (hanko), open a sheet to see every weight and copy the embed code, or press and hold the sheet to crumple it.

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

- `public/fonts.json`: 1,907 Google Fonts families with category, weights, italics, scripts, variable axes and license. Refresh it with `npm update google-font-metadata && npm run catalog`.
- `src/App.jsx`: search, preview text, size, category and script filters, sorting, stamped fonts (kept in localStorage), and `#font-id` links that open a sheet directly.
- `src/components/HeroScroll.jsx`: the hanging sheet where "Washi Type" is brushed stroke by stroke, then stamped.
- `src/components/Hanko.jsx`: the red seal used for saving fonts and in the logo.
- `src/components/FontCard.jsx`: one washi sheet in the grid. Fonts load only as their sheet scrolls into view, batched into one Google Fonts request.
- `src/components/SpecimenSheet.jsx` and `drawSheet.js`: the detail view. `drawSheet` paints the specimen on washi with a torn edge and a seal, and `PaperCrumple` turns it into paper you can crumple. three.js loads only when a sheet is opened.
- `src/components/reactbits/`: ReactBits components: StrokeText (brushed hero lettering), BlurText (title), RotatingText, CountUp and ClickSpark (ink splatter on click).

## Next steps

- More sources (Fontshare, Font Squirrel) with their own license filter.
- Font pairing suggestions on each sheet.
- Identify a font from a screenshot.
