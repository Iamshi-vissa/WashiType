import { memo, useEffect, useRef } from 'react';
import { loadPreview, defaultWeight, SOURCES } from '../fontLoader.js';
import { CATEGORY_NAME } from '../data.js';
import Hanko, { SaveMark } from './Hanko.jsx';
import WarmTooltip from './reactbits/WarmTooltip.jsx';

// One shared observer for every card: load a font only once its sheet scrolls near view.
const watchers = new Map();
let observer = null;
function watch(node, onVisible) {
  if (!observer) {
    observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          watchers.get(entry.target)?.();
          watchers.delete(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '400px 0px' }
    );
  }
  watchers.set(node, onVisible);
  observer.observe(node);
  return () => {
    watchers.delete(node);
    observer.unobserve(node);
  };
}

// A small deterministic tilt so the sheets look laid on a desk, not printed on a grid.
const tilt = id => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 9) - 4) * 0.22;
};

function FontCard({ font, text, size, saved, onToggleSave, onOpen }) {
  const ref = useRef(null);
  useEffect(() => watch(ref.current, () => loadPreview(font)), [font]);

  return (
    <article ref={ref} className="sheet" style={{ '--tilt': `${tilt(font.id)}deg` }}>
      <div className="sheet-paper">
      <button type="button" className="sheet-open" onClick={() => onOpen(font)} aria-label={`Open ${font.f}`}>
        <span
          className="sheet-text"
          style={{ fontFamily: `"${font.f}", var(--fallback)`, fontSize: size, fontWeight: defaultWeight(font) }}
        >
          {text}
        </span>
      </button>
      <footer className="sheet-foot">
        <div className="sheet-name">
          <strong>{font.f}</strong>
          <span>
            {CATEGORY_NAME[font.c]} · {font.w.length} {font.w.length === 1 ? 'weight' : 'weights'}
            {font.a.length ? ' · variable' : ''} · {SOURCES[font.src].short}
          </span>
        </div>
        <WarmTooltip
          content={saved ? 'Remove stamp' : 'Stamp to save'}
          side="top"
          size="sm"
          surfaceColor="var(--ink)"
          inkColor="var(--paper)"
        >
          <button
            type="button"
            className="seal-btn"
            aria-pressed={saved}
            aria-label={saved ? `Remove ${font.f} from saved` : `Save ${font.f}`}
            onClick={() => onToggleSave(font.id)}
          >
            <Hanko key={saved ? 'on' : 'off'} on={saved} stamp={saved} size={32}>
              <SaveMark />
            </Hanko>
          </button>
        </WarmTooltip>
      </footer>
      </div>
    </article>
  );
}

export default memo(FontCard);
