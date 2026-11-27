import { useEffect } from 'react';
import { loadPreview } from '../fontLoader.js';

// Shown when a search names a well-known commercial font (Times New Roman, Arial...): why it
// isn't here, where people usually already have it, and the closest free fonts (see
// src/commercialFonts.js). Each suggestion is shown in its own font and opens its sheet.
export default function CommercialNote({ entry, fontsById, onOpen }) {
  const pick = ids => (ids ?? []).map(id => fontsById.get(id)).filter(Boolean);
  const same = pick(entry.same);
  const like = pick(entry.like);
  useEffect(() => {
    [...same, ...like].forEach(loadPreview);
    // same/like are derived from entry; reload only when the entry changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, fontsById]);

  const chips = fonts => (
    <span className="commercial-fonts">
      {fonts.map(font => (
        <button
          key={font.id}
          type="button"
          className="commercial-font"
          style={{ fontFamily: `"${font.f}", var(--fallback)` }}
          onClick={() => onOpen(font)}
        >
          {font.f}
        </button>
      ))}
    </span>
  );

  return (
    <aside className="commercial" aria-label={`About ${entry.name}`}>
      <p className="commercial-why">
        <strong>{entry.name}</strong> isn’t a free font, so it isn’t on Washi Type.{' '}
        {entry.comesWith
          ? `It comes with ${entry.comesWith}, so you may already have it.`
          : 'It’s sold by the foundry that makes it.'}
      </p>
      {same.length > 0 && (
        <p className="commercial-row">
          <span>
            Free, with the <em>same letter widths</em> (swap it in and a document keeps its line breaks and page count):
          </span>
          {chips(same)}
        </p>
      )}
      {like.length > 0 && (
        <p className="commercial-row">
          <span>{same.length ? 'Free, with a similar look:' : 'Free fonts with a similar look:'}</span>
          {chips(like)}
        </p>
      )}
    </aside>
  );
}
