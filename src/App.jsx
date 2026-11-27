import { createPortal } from 'react-dom';
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ClickSpark from './components/reactbits/ClickSpark.jsx';
import { FoldText, SwipeToast, SquishSwitch, RotatingText, CountUp, HeroScroll } from './deferred.jsx';
import FontCard from './components/FontCard.jsx';
import VirtualGrid from './components/VirtualGrid.jsx';
import Select from './components/Select.jsx';
import Hanko, { SaveMark } from './components/Hanko.jsx';
// The specimen sheet pulls in three.js, so it loads only when a sheet is opened.
const SpecimenSheet = lazy(() => import('./components/SpecimenSheet.jsx'));
// The drawer (with the Shredder) only loads when it's opened.
const StampDrawer = lazy(() => import('./components/StampDrawer.jsx'));
import ErrorScreen from './components/ErrorScreen.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { CATEGORIES, SCRIPTS, SORTS, FEATURED, SIZES, sampleFor, previewText } from './data.js';
import { fontPath, readFontRoute, upgradeHashLink } from './routes.js';

const SCRIPT_OPTIONS = [{ value: 'all', label: 'Any script' }, ...SCRIPTS.map(s => ({ value: s.id, label: s.label }))];
const SORT_OPTIONS = SORTS.map(s => ({ value: s.id, label: s.label }));
const SOURCE_LABELS = { all: 'All sources', g: 'Google Fonts', fs: 'Fontshare (Indian Type Foundry)', o: 'Open-source foundries' };
const FEATURED_RANK = new Map(FEATURED.map((name, i) => [name, i]));

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: saving lasts for this visit only */
    }
  }
};

export default function App() {
  const [fonts, setFonts] = useState([]);
  // 'loading' | 'ready' | 'offline' | 'unreachable'
  const [catalog, setCatalog] = useState('loading');
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [missing, setMissing] = useState(null); // a link to a font that doesn't exist
  const [savedCopy, setSavedCopy] = useState(false); // the font list came from the offline copy
  const [query, setQuery] = useState('');
  const [text, setText] = useState(() => store.get('washitype:text', store.get('typesheet:text', '')));
  const [size, setSize] = useState(() => store.get('washitype:size', store.get('typesheet:size', 36)));
  const [category, setCategory] = useState('all');
  const [script, setScript] = useState('all');
  const [sort, setSort] = useState('featured');
  const [source, setSource] = useState('all');
  const [variableOnly, setVariableOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState(() => new Set(store.get('washitype:saved', store.get('typesheet:saved', []))));
  const [open, setOpen] = useState(null);
  const heroRef = useRef(null);

  // Load the catalog, retrying twice with a short pause before showing the error TV.
  const loadCatalog = useCallback(async () => {
    setCatalog('loading');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await fetch('/fonts.json', { cache: attempt ? 'reload' : 'default' });
        if (!res.ok) throw new Error(`fonts.json answered ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) throw new Error('fonts.json is empty');
        setSavedCopy(res.headers.get('X-Washi-Copy') === '1');
        setFonts(data);
        setCatalog('ready');
        return;
      } catch {
        if (navigator.onLine === false || attempt === 2) break;
        await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
    setCatalog(navigator.onLine === false ? 'offline' : 'unreachable');
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Track the connection. Only the moment it comes back triggers a retry of a failed
  // catalog (retrying on every failure would loop forever against a server that's down).
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);
  useEffect(() => {
    const up = () => {
      setOnline(true);
      if (catalogRef.current === 'offline' || catalogRef.current === 'unreachable') loadCatalog();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, [loadCatalog]);

  useEffect(() => store.set('washitype:text', text), [text]);
  useEffect(() => store.set('washitype:size', size), [size]);
  useEffect(() => store.set('washitype:saved', [...saved]), [saved]);

  // /fonts/<id> opens that font's sheet; the address can be bookmarked, shared and indexed.
  useEffect(() => {
    if (!fonts.length) return;
    upgradeHashLink();
    const sync = () => {
      const route = readFontRoute();
      const font = route?.id ? fonts.find(f => f.id === route.id) : null;
      setOpen(font ?? null);
      setMissing(route && !font ? { term: route.garbled ? '' : route.id } : null);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [fonts]);

  // The tab title follows the open sheet.
  useEffect(() => {
    const base = 'Washi Type font finder';
    document.title = open ? `${open.f} · Washi Type` : base;
  }, [open]);

  const openFont = useCallback(font => {
    // Remember that this sheet was opened from inside the app, so closing can go Back.
    history.pushState({ washiSheet: true }, '', fontPath(font.id));
    setMissing(null);
    setOpen(font);
  }, []);
  const closeFont = useCallback(() => {
    setOpen(null);
    setMissing(null);
    if (history.state?.washiSheet) history.back();
    else history.replaceState(null, '', '/' + location.search);
  }, []);

  // One toast at a time; a new one replaces the old.
  const [toast, setToast] = useState(null);
  const notify = useCallback((title, extra = {}) => setToast({ id: `${Date.now()}-${Math.random()}`, title, ...extra }), []);

  const fontById = useMemo(() => new Map(fonts.map(f => [f.id, f])), [fonts]);

  // Forget stamps for fonts that have left the catalog, so the count is honest.
  useEffect(() => {
    if (catalog !== 'ready') return;
    setSaved(prev => {
      const kept = [...prev].filter(id => fontById.has(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [catalog, fontById]);
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  const setStamp = useCallback((id, on) => {
    setSaved(prev => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSave = useCallback(
    id => {
      const had = savedRef.current.has(id);
      setStamp(id, !had);
      const name = fontById.get(id)?.f ?? 'Font';
      notify(had ? `Removed the stamp from ${name}` : `Stamped ${name}`, {
        description: had ? '' : 'Find it under Stamped at the top of the page.'
      });
    },
    [fontById, notify, setStamp]
  );

  const shred = useCallback(
    id => {
      setStamp(id, false);
      const name = fontById.get(id)?.f ?? 'Font';
      notify(`Shredded ${name}`, { actionLabel: 'Undo', onAction: () => setStamp(id, true) });
    },
    [fontById, notify, setStamp]
  );

  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  const q = useDeferredValue(query.trim().toLowerCase());
  const results = useMemo(() => {
    const list = fonts.filter(
      f =>
        (source === 'all' || f.src === source) &&
        (category === 'all' || f.c === category) &&
        (script === 'all' || f.s.includes(script)) &&
        (!variableOnly || f.a.length > 0) &&
        (!savedOnly || saved.has(f.id)) &&
        (!q || f.f.toLowerCase().includes(q))
    );
    const byName = (a, b) => a.f.localeCompare(b.f);
    const sorters = {
      az: byName,
      new: (a, b) => b.u.localeCompare(a.u) || byName(a, b),
      weights: (a, b) => b.w.length - a.w.length || byName(a, b),
      featured: (a, b) => (FEATURED_RANK.get(a.f) ?? 1e4) - (FEATURED_RANK.get(b.f) ?? 1e4) || byName(a, b)
    };
    return list.sort(sorters[sort]);
  }, [fonts, source, category, script, variableOnly, savedOnly, saved, q, sort]);


  // Source options show how many fonts each source brings.
  const sourceOptions = useMemo(() => {
    const counts = { all: fonts.length, g: 0, fs: 0, o: 0 };
    for (const f of fonts) counts[f.src] += 1;
    return Object.entries(SOURCE_LABELS).map(([value, label]) => ({
      value,
      label: fonts.length ? `${label} (${counts[value].toLocaleString()})` : label
    }));
  }, [fonts]);

  // Typing re-renders every sheet; deferring keeps the input responsive while they catch up.
  const userText = useDeferredValue(text.trim());
  const catalogFailed = catalog === 'offline' || catalog === 'unreachable';
  const filtered = source !== 'all' || category !== 'all' || script !== 'all' || variableOnly || savedOnly || q;

  const clearFilters = () => {
    setQuery('');
    setSource('all');
    setCategory('all');
    setScript('all');
    setVariableOnly(false);
    setSavedOnly(false);
  };

  return (
    <ClickSpark
      sparkColor={['#1a1816', '#1a1816', '#c8341f']}
      shape="dot"
      sparkSize={6}
      sparkRadius={22}
      sparkCount={9}
      randomness={0.6}
      duration={480}
      style={{ height: 'auto' }}
    >
      <header className="top">
        <a className="mark" href="/" onClick={e => (e.preventDefault(), open || missing ? closeFont() : null, clearFilters())}>
          <Hanko text="WT" size={34} />
          <span>Washi Type</span>
        </a>
        <button
          type="button"
          className={`ghost small${savedOnly ? ' is-on' : ''}`}
          data-focus-home
          aria-haspopup="dialog"
          disabled={catalog !== 'ready'}
          onClick={() => setDrawer(true)}
        >
          <Hanko on={saved.size > 0} size={22}>
            <SaveMark />
          </Hanko>
          Stamped · {saved.size}
        </button>
      </header>
      {(!online || savedCopy) && catalog === 'ready' && (
        <div className="offline-bar" role="status">
          <strong>NO SIGNAL</strong>
          {online
            ? 'Washi Type couldn’t be reached, so this is the copy saved on your device. Reload to try again.'
            : 'You’re offline. Fonts that haven’t loaded yet show a stand-in until you reconnect.'}
        </div>
      )}

      {catalogFailed ? (
        // The catalog couldn't be reached: the TV takes the whole page, not a corner below the fold.
        <main className="band">
          <ErrorScreen
            page
            headingLevel={1}
            kind={catalog}
            actions={[{ label: 'Try again', primary: true, onClick: loadCatalog }]}
          />
        </main>
      ) : (
        <>
      <section className="hero band" ref={heroRef}>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 className="title">
              <FoldText
                text="Find the right font"
                splitBy="char"
                foldStyle="paper"
                hinge="top"
                fontSize="clamp(40px, 6.4vw, 80px)"
                fontWeight={800}
                duration={0.7}
                stagger={0.035}
                creaseShading={0.45}
              />
            </h1>
            <p className="for">
                for{' '}
                <span className="brush">
                  <RotatingText
                    texts={['a wedding card', 'your startup', 'a Hindi menu', 'a tea shop', 'your résumé', 'a poster']}
                    mainClassName="rotator"
                    splitBy="characters"
                    staggerDuration={0.02}
                    rotationInterval={2800}
                  />
                </span>
            </p>
            <p className="lede">
              {fonts.length ? <CountUp to={fonts.length} separator="," duration={1.6} /> : <span>2,000+</span>} free fonts from Google Fonts, Fontshare and independent open-source foundries, each written out
              on a sheet of washi in your own words. Every one is free to use in personal and commercial work.
            </p>
          </div>
          <HeroScroll />
        </div>

        <div className="notepad">
          <label htmlFor="preview" className="hand">
            Write something
          </label>
          <input
            id="preview"
            className="write"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={sampleFor(script === 'all' ? 'latin' : script)}
            autoComplete="off"
            spellCheck="false"
          />
          <div className="notepad-row">
            <label className="search">
              <span className="sr">Search fonts by name</span>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name"
                autoComplete="off"
              />
            </label>
            <div className="sizes" role="group" aria-label="Preview size">
              {SIZES.map(s => (
                <button key={s} type="button" className={s === size ? 'is-on' : ''} aria-pressed={s === size} onClick={() => setSize(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <nav className="filters band" aria-label="Filters">
        <div className="chips" role="group" aria-label="Category">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={`chip${category === c.id ? ' is-on' : ''}`}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="selects">
          <Select label="Source" value={source} options={sourceOptions} onChange={setSource} />
          <Select label="Script" value={script} options={SCRIPT_OPTIONS} onChange={setScript} />
          <Select label="Sort" value={sort} options={SORT_OPTIONS} onChange={setSort} />
          <SquishSwitch
            checked={variableOnly}
            onChange={setVariableOnly}
            label="Variable only"
            width={48}
            height={28}
            trackColor="color-mix(in srgb, var(--ink) 16%, var(--paper))"
            trackOnColor="var(--shu)"
            thumbColor="var(--paper)"
            thumbOnColor="var(--paper)"
            className="squish"
          />
        </div>
      </nav>

      <main className="band desk">
        <p className="count" aria-live="polite">
          {fonts.length
            ? `${results.length.toLocaleString()} ${results.length === 1 ? 'font' : 'fonts'}`
            : catalog === 'loading'
              ? 'Laying out the sheets…'
              : ''}
          {filtered && fonts.length > 0 && (
            <button type="button" className="link" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </p>


        {fonts.length > 0 && results.length === 0 && (
          <div className="empty">
            <p className="hand">The desk is empty.</p>
            <p>
              {savedOnly && saved.size === 0
                ? 'You haven’t stamped any fonts yet. Press the seal on a sheet to keep it here.'
                : 'No font matches all of these filters. Try a different name or fewer filters.'}
            </p>
          </div>
        )}

        <VirtualGrid
          items={results}
          getKey={font => font.id}
          estimateRowHeight={size > 48 ? 330 : 260}
          renderItem={font => (
            <FontCard
              font={font}
              text={previewText(font, userText, script)}
              size={size}
              saved={saved.has(font.id)}
              onToggleSave={toggleSave}
              onOpen={openFont}
            />
          )}
        />
      </main>

        </>
      )}

      <footer className="foot band">
        <p>
          <Hanko text="WT" size={26} /> Fonts from <a href="https://fonts.google.com">Google Fonts</a>,{' '}
          <a href="https://www.fontshare.com">Fontshare</a> by the Indian Type Foundry, and the open-source foundries
          collected by <a href="https://fontsource.org">Fontsource</a>. Each font keeps its own licence; all are free for
          commercial use. Stamped fonts stay in this browser.
        </p>
      </footer>

      {/* The sheet renders outside the app root so the page behind it can be made inert. */}
      {open &&
        createPortal(
          <ErrorBoundary
            key={open.id}
            fallback={() => (
              <div className="overlay" role="dialog" aria-modal="true" aria-label="This font couldn’t open" onClick={closeFont}>
                <div className="spec spec--error" onClick={e => e.stopPropagation()}>
                  <ErrorScreen
                    kind={online ? 'crash' : 'offline'}
                    title={`${open.f} couldn’t open`}
                    message={online ? 'Part of this sheet failed to load. Reloading usually fixes it.' : 'You’re offline, and this sheet needs a connection the first time it opens.'}
                    actions={[
                      { label: 'Reload the page', primary: true, onClick: () => location.reload() },
                      { label: 'Back to all fonts', onClick: closeFont }
                    ]}
                  />
                </div>
              </div>
            )}
          >
            <Suspense fallback={<div className="overlay" />}>
              <SpecimenSheet
                font={open}
                text={previewText(open, text.trim(), script)}
                saved={saved.has(open.id)}
                onToggleSave={toggleSave}
                onNotify={notify}
                onClose={closeFont}
              />
            </Suspense>
          </ErrorBoundary>,
          document.body
        )}
      {missing &&
        createPortal(
          <MissingFont id={missing.term} onSearch={term => { closeFont(); setQuery(term); }} onClose={closeFont} />,
          document.body
        )}
      {drawer &&
        createPortal(
          <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
          <StampDrawer
            fonts={[...saved].map(id => fontById.get(id)).filter(Boolean)}
            savedOnly={savedOnly}
            onShowOnDesk={() => setSavedOnly(v => !v)}
            onShred={shred}
            onOpenFont={font => {
              setDrawer(false);
              openFont(font);
            }}
            onClose={closeDrawer}
          />
          </Suspense>
          </ErrorBoundary>,
          document.body
        )}

      {toast &&
        createPortal(
          <SwipeToast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
            onClose={() => setToast(t => (t?.id === toast.id ? null : t))}
            background="var(--ink)"
            color="var(--paper)"
            fuseColor="var(--shu)"
            width={340}
            radius={6}
            duration={3600}
            className="toast"
          />,
          document.body
        )}
    </ClickSpark>
  );
}

// Shown for a #link to a font that isn't in the catalog (or a garbled link).
function MissingFont({ id, onSearch, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const app = document.getElementById('root');
    if (app) app.inert = true;
    closeRef.current?.querySelector('button')?.focus();
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (app) app.inert = false;
    };
  }, [onClose]);
  const term = id.replace(/[-_]+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 40);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Font not found" onClick={onClose}>
      <div className="spec spec--error" ref={closeRef} onClick={e => e.stopPropagation()}>
        <ErrorScreen
          kind="noFont"
          title={term ? `No font called “${term}”` : undefined}
          actions={[
            ...(term ? [{ label: `Search for “${term}”`, primary: true, onClick: () => onSearch(term) }] : []),
            { label: 'Back to all fonts', primary: !term, onClick: onClose }
          ]}
        />
      </div>
    </div>
  );
}
