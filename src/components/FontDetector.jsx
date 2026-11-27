import { useCallback, useEffect, useRef, useState } from 'react';
import { restoreFocus } from '../focus.js';
import { readLetters } from '../detect/analyze.js';
import { closeness, findFonts } from '../detect/match.js';

// "What font is this?": drop, paste or choose a picture, draw a box around one line of
// lettering, type what it says, and Washi Type finds the closest fonts it has. Everything
// runs on this device (src/detect/); the picture is never uploaded.

const MAX_SIDE = 2000; // pictures are scaled down to this before anything else
const VIEW_W = 640;
const VIEW_H = 340;

async function loadPicture(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('That isn’t a picture. Try a PNG, JPEG or WebP.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; // transparent areas count as paper
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    throw new Error('That picture couldn’t be opened. Try a PNG, JPEG or WebP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const STAGE_TEXT = {
  read: 'Reading the letters…',
  index: 'Comparing with every font…',
  draw: 'Drawing the closest fonts'
};

export default function FontDetector({ fonts, onOpenFont, onClose }) {
  const closeRef = useRef(null);
  const fileRef = useRef(null);
  const viewRef = useRef(null);
  const run = useRef(0);
  const [picture, setPicture] = useState(null); // canvas at working size
  const [crop, setCrop] = useState(null); // { x, y, w, h } in picture pixels, null = all
  const [drag, setDrag] = useState(null);
  const [text, setText] = useState('');
  const [over, setOver] = useState(false);
  const [state, setState] = useState({ step: 'idle' });

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
    const runs = run; // the counter itself, not a DOM node
    return () => {
      runs.current++; // drop any match still running
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      if (app) app.inert = false;
      restoreFocus(previous);
    };
  }, [onClose]);

  const take = useCallback(async file => {
    run.current++;
    setState({ step: 'idle' });
    try {
      const canvas = await loadPicture(file);
      setPicture(canvas);
      setCrop(null);
    } catch (err) {
      setState({ step: 'error', message: err.message });
    }
  }, []);

  // Paste a picture from the clipboard anywhere while the dialog is open.
  useEffect(() => {
    const onPaste = e => {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      take(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [take]);

  // Draw the picture into the view.
  const view = picture ? Math.min(1, VIEW_W / picture.width, VIEW_H / picture.height) : 1;
  useEffect(() => {
    const canvas = viewRef.current;
    if (!canvas || !picture) return;
    canvas.width = Math.round(picture.width * view);
    canvas.height = Math.round(picture.height * view);
    canvas.getContext('2d').drawImage(picture, 0, 0, canvas.width, canvas.height);
  }, [picture, view]);

  // Drawing the box: pointer positions in the view, converted to picture pixels.
  const point = e => {
    const r = viewRef.current.getBoundingClientRect();
    const sx = picture.width / r.width;
    const sy = picture.height / r.height;
    return {
      x: Math.max(0, Math.min(picture.width, (e.clientX - r.left) * sx)),
      y: Math.max(0, Math.min(picture.height, (e.clientY - r.top) * sy))
    };
  };
  const onPointerDown = e => {
    if (!picture) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = point(e);
    setDrag({ from: p, to: p });
  };
  const onPointerMove = e => drag && setDrag(d => ({ ...d, to: point(e) }));
  const onPointerUp = () => {
    if (!drag) return;
    const x = Math.min(drag.from.x, drag.to.x);
    const y = Math.min(drag.from.y, drag.to.y);
    const w = Math.abs(drag.to.x - drag.from.x);
    const h = Math.abs(drag.to.y - drag.from.y);
    setDrag(null);
    // A click (or a tiny box) means "the whole picture".
    setCrop(w > 8 && h > 6 ? { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } : null);
  };
  const shown = drag
    ? {
        x: Math.min(drag.from.x, drag.to.x),
        y: Math.min(drag.from.y, drag.to.y),
        w: Math.abs(drag.to.x - drag.from.x),
        h: Math.abs(drag.to.y - drag.from.y)
      }
    : crop;

  const find = async e => {
    e.preventDefault();
    if (!picture) return setState({ step: 'error', message: 'Add a picture first.' });
    if (!text.trim()) return setState({ step: 'error', message: 'Type what the lettering says, so each letter can be compared.' });
    if (navigator.onLine === false) {
      return setState({ step: 'error', message: 'You’re offline. Comparing needs to download the closest fonts; try again when you’re back online.' });
    }
    const token = ++run.current;
    setState({ step: 'read' });
    // Let the progress line paint before the pixel work starts.
    await new Promise(r => setTimeout(r, 30));
    const area = crop ?? { x: 0, y: 0, w: picture.width, h: picture.height };
    const source = picture.getContext('2d', { willReadFrequently: true }).getImageData(area.x, area.y, area.w, area.h);
    const read = readLetters(source, text.trim());
    if (token !== run.current) return;
    if (read.error) return setState({ step: 'error', message: read.error });
    try {
      const results = await findFonts(read, fonts, {
        onStage: (step, done, total) => token === run.current && setState({ step, done, total })
      });
      if (token !== run.current) return;
      setState(results.length ? { step: 'done', results } : { step: 'error', message: 'No close match. Try a tighter crop around one line of text.' });
    } catch {
      if (token === run.current)
        setState({ step: 'error', message: navigator.onLine === false ? 'You’re offline: comparing needs to download the fonts.' : 'Something went wrong while comparing. Try again.' });
    }
  };

  const busy = ['read', 'index', 'draw'].includes(state.step);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="detect-title" onClick={onClose}>
      <div className="detect" onClick={e => e.stopPropagation()}>
        <button ref={closeRef} type="button" className="close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <h2 id="detect-title" className="hand">
          What font is this?
        </h2>
        <p className="detect-lede">
          Add a picture of some lettering and type what it says. The closest fonts from the catalog come back in a few seconds. Your
          picture stays on this device: nothing is uploaded.
        </p>

        <form onSubmit={find} className="detect-form">
          <div
            className={`detect-drop${over ? ' is-over' : ''}${picture ? ' has-picture' : ''}`}
            onDragOver={e => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={e => {
              e.preventDefault();
              setOver(false);
              take(e.dataTransfer.files?.[0]);
            }}
          >
            {picture ? (
              <div className="detect-view">
                <canvas
                  ref={viewRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={() => setDrag(null)}
                  aria-label="Your picture. Drag a box around one line of lettering."
                />
                {shown && (
                  <div
                    className="detect-box"
                    style={{
                      left: `${(shown.x / picture.width) * 100}%`,
                      top: `${(shown.y / picture.height) * 100}%`,
                      width: `${(shown.w / picture.width) * 100}%`,
                      height: `${(shown.h / picture.height) * 100}%`
                    }}
                  />
                )}
              </div>
            ) : (
              <p className="detect-empty">
                <span className="hand">Drop a picture here</span>
                <span>or paste one, or</span>
              </p>
            )}
            <div className="detect-pick">
              <button type="button" className="ghost small" onClick={() => fileRef.current?.click()}>
                {picture ? 'Use another picture' : 'Choose a picture'}
              </button>
              {picture && (
                <span className="fine">
                  {crop ? (
                    <>
                      Comparing the boxed area.{' '}
                      <button type="button" className="linkish" onClick={() => setCrop(null)}>
                        Use the whole picture
                      </button>
                    </>
                  ) : (
                    'Drag a box around one line of lettering for the best result.'
                  )}
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={e => {
                  take(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          <label className="detect-text">
            <span>What does it say?</span>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type the letters exactly, e.g. Handgloves"
              autoComplete="off"
              spellCheck="false"
              maxLength={60}
            />
          </label>
          <div className="detect-go">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Looking…' : 'Find the font'}
            </button>
            <p className="detect-status" aria-live="polite">
              {busy && (STAGE_TEXT[state.step] ?? '')}
              {state.step === 'draw' && state.total ? ` (${state.done}/${state.total})` : ''}
              {state.step === 'error' && <span className="err">{state.message}</span>}
            </p>
          </div>
        </form>

        {state.step === 'done' && (
          <section className="detect-results" aria-label="Closest fonts">
            <p className="fine">
              Closest first. Latin letters only; italics and very distorted lettering match less well.
            </p>
            <ol>
              {state.results.map((r, i) => (
                <li key={r.font.id}>
                  <div className="detect-head">
                    <span className="detect-rank">{i + 1}</span>
                    <span className="detect-title">
                      <span className="detect-name">
                        {r.font.f}
                        {r.font.w.length > 1 && <span className="fine"> · {r.weight}</span>}
                      </span>
                      <span className="detect-score" title="How closely the letters match">
                        {closeness(r.look)}% match
                      </span>
                    </span>
                    <button type="button" className="ghost small" onClick={() => onOpenFont(r.font)}>
                      Open
                    </button>
                  </div>
                  <p className="detect-sample" style={{ fontFamily: `"${r.font.f}", var(--fallback)`, fontWeight: r.weight }}>
                    {text.trim()}
                  </p>
                  {r.twins.length > 0 && (
                    <p className="fine detect-twins">
                      Same letters in {r.twins.slice(0, 3).map(t => t.f).join(', ')}
                      {r.twins.length > 3 ? ` and ${r.twins.length - 3} more` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
