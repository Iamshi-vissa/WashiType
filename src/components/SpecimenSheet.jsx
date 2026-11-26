import { useEffect, useRef, useState } from 'react';
import PaperCrumple from './PaperCrumple/PaperCrumple.jsx';
import { drawSheet, SHEET_W, SHEET_H } from './drawSheet.js';
import { loadFamily, cssSnippet, googleUrl } from '../fontLoader.js';
import { CATEGORY_NAME, SCRIPT_LABEL } from '../data.js';
import Hanko, { SaveMark } from './Hanko.jsx';

const WEIGHT_NAME = {
  100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black'
};
const LICENSE = {
  OFL: { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org' },
  Apache: { name: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  UFL: { name: 'Ubuntu Font Licence 1.0', url: 'https://ubuntu.com/legal/font-licence' }
};

export default function SpecimenSheet({ font, text, saved, onToggleSave, onClose }) {
  const [image, setImage] = useState('');
  const [italic, setItalic] = useState(false);
  const [copied, setCopied] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [paperState, setPaperState] = useState('flat');
  const closeRef = useRef(null);
  const sceneHeight = typeof window !== 'undefined' && window.innerWidth < 600 ? 460 : 540;
  const codeRef = useRef(null);

  // Draw the paper once the family (and the note lettering) has loaded.
  useEffect(() => {
    let live = true;
    setImage('');
    const t = setTimeout(async () => {
      await Promise.all([loadFamily(font), document.fonts.load('400 34px "Zen Antique"', 'WT').catch(() => {}),
        document.fonts.load('500 26px "Shippori Mincho"').catch(() => {})]);
      if (live) setImage(drawSheet(font, text));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [font, text]);

  useEffect(() => {
    const previous = document.activeElement;
    // Keep keyboard and screen-reader focus inside the sheet while it is open.
    const app = document.getElementById('root');
    if (app) app.inert = true;
    closeRef.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape' && !e.target.closest?.('.paper-crumple')) onClose();
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

  const snippet = cssSnippet(font);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied('Copied');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      setCopied('Selected: press Ctrl+C or ⌘C');
    }
    setTimeout(() => setCopied(''), 2400);
  };

  // A few fonts have no license record in the catalog; point to Google Fonts instead of guessing.
  const license = LICENSE[font.l] ?? { name: 'Open-source license (see Google Fonts)', url: googleUrl(font) };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="spec-title" onClick={onClose}>
      <div className="spec" onClick={e => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <section className="spec-paper">
          {image ? (
            <PaperCrumple
              key={font.id}
              src={image}
              alt={`Specimen sheet for ${font.f}`}
              width={SHEET_W}
              height={SHEET_H}
              sceneHeight={sceneHeight}
              releaseBehavior="creased"
              crumpleAmount={0.9}
              creaseStrength={0.22}
              foldCount={7}
              seed={font.id.length * 7 + 3}
              shadowOpacity={0.12}
              resetKey={resetKey}
              onStateChange={setPaperState}
            />
          ) : (
            <div className="spec-loading" style={{ height: sceneHeight }}>
              <span>Grinding the ink for {font.f}…</span>
            </div>
          )}
          <p className="note">
            {paperState === 'flat'
              ? 'Press and hold the sheet to crumple it, then drag it around'
              : paperState === 'holding'
                ? 'Now let go…'
                : 'It keeps its creases. Smooth it out below'}
          </p>
          <button
            type="button"
            className="ghost"
            onClick={() => setResetKey(k => k + 1)}
            disabled={paperState === 'flat'}
          >
            Smooth the sheet
          </button>
        </section>

        <section className="spec-info">
          <p className="kicker">
            {CATEGORY_NAME[font.c]}
          </p>
          <h2 id="spec-title" style={{ fontFamily: `"${font.f}", var(--fallback)` }}>
            {font.f}
          </h2>

          <div className="actions">
            <a className="btn" href={googleUrl(font)} target="_blank" rel="noreferrer">
              Get it on Google Fonts
            </a>
            <button type="button" className="ghost seal-label" aria-pressed={saved} onClick={() => onToggleSave(font.id)}>
              <Hanko key={saved ? 'on' : 'off'} on={saved} stamp={saved} size={26}>
                <SaveMark />
              </Hanko>
              {saved ? 'Stamped and saved' : 'Stamp to save'}
            </button>
          </div>

          <dl className="facts">
            <div>
              <dt>License</dt>
              <dd>
                <a href={license.url} target="_blank" rel="noreferrer">
                  {license.name}
                </a>
                <span className="ok">Free for personal and commercial use</span>
              </dd>
            </div>
            <div>
              <dt>Scripts</dt>
              <dd>{font.s.map(s => SCRIPT_LABEL[s] ?? s).join(', ') || 'Latin'}</dd>
            </div>
            <div>
              <dt>Styles</dt>
              <dd>
                {font.w.length} {font.w.length === 1 ? 'weight' : 'weights'}
                {font.i ? ', with italics' : ''}
              </dd>
            </div>
            {font.a.length > 0 && (
              <div>
                <dt>Variable axes</dt>
                <dd>{font.a.join(', ')}</dd>
              </div>
            )}
            <div>
              <dt>Last updated</dt>
              <dd>{new Date(font.u).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
            </div>
          </dl>

          <div className="waterfall-head">
            <h3>Every weight</h3>
            {font.i ? (
              <label className="toggle">
                <input type="checkbox" checked={italic} onChange={e => setItalic(e.target.checked)} />
                <span>Italic</span>
              </label>
            ) : null}
          </div>
          <ul className="waterfall">
            {font.w.map(w => (
              <li key={w}>
                <span className="w-label">
                  {w} {WEIGHT_NAME[w] ?? ''}
                </span>
                <span
                  className="w-text"
                  style={{ fontFamily: `"${font.f}", var(--fallback)`, fontWeight: w, fontStyle: italic ? 'italic' : 'normal' }}
                >
                  {text}
                </span>
              </li>
            ))}
          </ul>

          <div className="waterfall-head">
            <h3>Use it on your site</h3>
            <button type="button" className="ghost small" onClick={copy}>
              {copied || 'Copy code'}
            </button>
          </div>
          <pre className="code">
            <code ref={codeRef}>{snippet}</code>
          </pre>
        </section>
      </div>
    </div>
  );
}
