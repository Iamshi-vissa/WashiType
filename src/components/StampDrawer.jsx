import { useEffect, useRef, useState } from 'react';
import Shredder from './reactbits/Shredder.jsx';
import Hanko from './Hanko.jsx';
import { CATEGORY_NAME } from '../data.js';

const SLIP = 58; // height of one paper slip
const GAP = 10;
const INSET = 14;
const FALL = 150;

// Side drawer with every stamped font as a paper slip. Drag a slip into the
// shredder (or focus it and press Delete) to remove its stamp.
export default function StampDrawer({ fonts, savedOnly, onShowOnDesk, onShred, onOpenFont, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const app = document.getElementById('root');
    if (app) app.inert = true;
    closeRef.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      if (app) app.inert = false;
      previous?.focus?.();
    };
  }, [onClose]);

  const items = fonts.map(font => ({ id: font.id, font }));
  // Keep the shredder's height while slips are being shredded, so the falling strips aren't cut off.
  const [rows, setRows] = useState(Math.max(1, items.length));
  if (items.length > rows) setRows(items.length);
  const height = INSET + rows * (SLIP + GAP) + 4 + FALL;

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="drawer-head">
          <h2 id="drawer-title">
            <Hanko text="WT" size={28} /> Stamped fonts
          </h2>
          <button ref={closeRef} type="button" className="close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {items.length === 0 ? (
          <div className="drawer-empty">
            <p className="hand">Nothing stamped yet.</p>
            <p>Press the seal on any sheet to keep a font here.</p>
          </div>
        ) : (
          <>
            <p className="drawer-hint">
              Drag a slip down into the shredder to remove its stamp. With the keyboard, focus a slip and press
              Delete.
            </p>
            <div className="drawer-actions">
              <button type="button" className={`ghost small${savedOnly ? ' is-on' : ''}`} aria-pressed={savedOnly} onClick={onShowOnDesk}>
                {savedOnly ? 'Showing only these on the desk' : 'Show only these on the desk'}
              </button>
            </div>
            <Shredder
              items={items}
              width={340}
              height={height}
              inset={INSET}
              gap={GAP}
              fallHeight={FALL}
              slitColor="var(--ink)"
              color="var(--ink)"
              onShred={item => onShred(item.id)}
              renderItem={({ font }) => (
                <div className="slip" style={{ height: SLIP }}>
                  <span className="slip-name" style={{ fontFamily: `"${font.f}", var(--fallback)` }}>
                    {font.f}
                  </span>
                  <span className="slip-meta">{CATEGORY_NAME[font.c]}</span>
                </div>
              )}
            />
            <ul className="drawer-links">
              {fonts.map(font => (
                <li key={font.id}>
                  <button type="button" className="link" onClick={() => onOpenFont(font)}>
                    Open {font.f}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
