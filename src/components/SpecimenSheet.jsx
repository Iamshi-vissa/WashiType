import { useEffect, useRef, useState } from 'react';
import PaperCrumple from './PaperCrumple/PaperCrumple.jsx';
import TearTicket from './reactbits/TearTicket.jsx';
import { drawSheet, SHEET_W, SHEET_H } from './drawSheet.js';
import { loadFamily, cssSnippet, sourceUrl, SOURCES } from '../fontLoader.js';
import { CATEGORY_NAME, SCRIPT_LABEL } from '../data.js';
import Hanko, { SaveMark } from './Hanko.jsx';
import { restoreFocus } from '../focus.js';
import useMedia from '../useMedia.js';

const WEIGHT_NAME = {
  100: 'Thin', 200: 'Extra light', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black'
};
const LICENSE = {
  OFL: { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org' },
  Apache: { name: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  UFL: { name: 'Ubuntu Font Licence 1.0', url: 'https://ubuntu.com/legal/font-licence' },
  CC0: { name: 'CC0 1.0 (public domain)', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  Unlicense: { name: 'The Unlicense (public domain)', url: 'https://unlicense.org' },
  MIT: { name: 'MIT License', url: 'https://opensource.org/license/mit' },
  // Fontshare's own licence; the font's Fontshare page links the full text.
  ITF: { name: 'ITF Free Font License', url: null }
};

export default function SpecimenSheet({ font, text, saved, onToggleSave, onNotify, onClose }) {
  const [image, setImage] = useState('');
  const [italic, setItalic] = useState(false);
  const [copied, setCopied] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [paperState, setPaperState] = useState('flat');
  const closeRef = useRef(null);
  // Follows rotation and resizing while the sheet is open.
  const narrow = useMedia('(max-width: 599px)');
  const sceneHeight = narrow ? 460 : 540;
  const codeRef = useRef(null);

  // Draw the paper once the family (and the note lettering) has loaded.
  useEffect(() => {
    let live = true;
    let url = '';
    setImage('');
    const t = setTimeout(async () => {
      await Promise.all([
        loadFamily(font),
        document.fonts.load('400 34px "Zen Antique"', 'WT').catch(() => {}),
        document.fonts.load('500 26px "Shippori Mincho"').catch(() => {})
      ]);
      if (!live) return;
      const next = await drawSheet(font, text).catch(() => '');
      if (!live) return URL.revokeObjectURL(next);
      url = next;
      setImage(next);
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
      // Free the previous sheet's picture once PaperCrumple has its own texture copy.
      if (url) setTimeout(() => URL.revokeObjectURL(url), 2000);
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
      restoreFocus(previous);
    };
  }, [onClose]);

  const snippet = cssSnippet(font);
  const [ticket, setTicket] = useState(0);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied('Copied');
      onNotify?.('Embed code copied', { description: `Paste it into your page to use ${font.f}.` });
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
  // Tearing the stub copies the code; a fresh ticket prints a moment later.
  const onTear = () => {
    copy();
    setTimeout(() => setTicket(t => t + 1), 2800);
  };
  // Size the ticket to the code so long weight lists still fit.
  // On phones the ticket stands upright with the stub at the bottom, so the code stays readable.
  const perLine = narrow ? 38 : 50;
  const codeLines = snippet.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
  const codeHeight = Math.max(narrow ? 150 : 176, 44 + codeLines * 19);
  const stubSize = narrow ? 84 : 112;

  // A few fonts have no license record in the catalog; point to Google Fonts instead of guessing.
  // A few fonts have no license record in the catalog; point to their source instead of guessing.
  const known = LICENSE[font.l];
  const license = {
    name: known?.name ?? `Open-source license (see ${SOURCES[font.src].name})`,
    url: (/^https?:\/\//i.test(font.lu || '') && font.lu) || known?.url || sourceUrl(font)
  };

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
            <a className="btn" href={sourceUrl(font)} target="_blank" rel="noreferrer">
              Get it on {SOURCES[font.src].name}
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
                {font.src === 'fs' && <span className="fine">Download it from Fontshare; the licence doesn’t allow sharing the files.</span>}
              </dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>
                {SOURCES[font.src].name}
                {font.by && <span className="fine">{font.by}</span>}
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
            {font.u && (
              <div>
                <dt>{font.src === 'fs' ? 'Added' : 'Last updated'}</dt>
                <dd>{new Date(font.u).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
              </div>
            )}
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
          <TearTicket
            key={ticket}
            orientation={narrow ? 'vertical' : 'horizontal'}
            width={narrow ? 340 : 540}
            height={narrow ? codeHeight + stubSize : codeHeight}
            stubSize={stubSize}
            radius={8}
            holes={Math.max(6, Math.round((narrow ? 340 : codeHeight) / 22))}
            holeSize={5}
            notch={4}
            roughness={1.2}
            rotate={3}
            tiltMax={4}
            parallax={2}
            background="var(--paper)"
            color="var(--ink)"
            borderColor="var(--line)"
            stubBackground="var(--ink)"
            onTear={onTear}
            ariaLabel="Tear off the stub to copy the embed code"
            className="ticket"
            stub={
              <div className="ticket-stub">
                <span className="ticket-seal">WT</span>
                <span>Tear to copy</span>
              </div>
            }
          >
            <pre className="ticket-code">
              <code ref={codeRef}>{snippet}</code>
            </pre>
          </TearTicket>
        </section>
      </div>
    </div>
  );
}
