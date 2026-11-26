import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import BlurText from './components/reactbits/BlurText.jsx';
import RotatingText from './components/reactbits/RotatingText.jsx';
import ClickSpark from './components/reactbits/ClickSpark.jsx';
import CountUp from './components/reactbits/CountUp.jsx';
import FontCard from './components/FontCard.jsx';
import HeroScroll from './components/HeroScroll.jsx';
import Hanko, { SaveMark } from './components/Hanko.jsx';
// The specimen sheet pulls in three.js, so it loads only when a sheet is opened.
const SpecimenSheet = lazy(() => import('./components/SpecimenSheet.jsx'));
import { CATEGORIES, SCRIPTS, SORTS, FEATURED, SIZES, sampleFor } from './data.js';

const PAGE = 48;
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
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [text, setText] = useState(() => store.get('typesheet:text', ''));
  const [size, setSize] = useState(() => store.get('typesheet:size', 36));
  const [category, setCategory] = useState('all');
  const [script, setScript] = useState('all');
  const [sort, setSort] = useState('featured');
  const [variableOnly, setVariableOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState(() => new Set(store.get('typesheet:saved', [])));
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState(null);
  const heroRef = useRef(null);
  const moreRef = useRef(null);

  useEffect(() => {
    fetch('./fonts.json')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setFonts)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => store.set('typesheet:text', text), [text]);
  useEffect(() => store.set('typesheet:size', size), [size]);
  useEffect(() => store.set('typesheet:saved', [...saved]), [saved]);

  // #font-id opens that font's sheet, so a sheet can be bookmarked or sent.
  useEffect(() => {
    if (!fonts.length) return;
    const sync = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      setOpen(fonts.find(f => f.id === id) ?? null);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [fonts]);

  const openFont = useCallback(font => {
    location.hash = font.id;
  }, []);
  const closeFont = useCallback(() => {
    setOpen(null);
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      location.hash = '';
    }
  }, []);

  const toggleSave = useCallback(id => {
    setSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const q = useDeferredValue(query.trim().toLowerCase());
  const results = useMemo(() => {
    const list = fonts.filter(
      f =>
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
  }, [fonts, category, script, variableOnly, savedOnly, saved, q, sort]);

  useEffect(() => setLimit(PAGE), [category, script, variableOnly, savedOnly, q, sort]);

  // Keep adding sheets as the reader reaches the bottom of the pile.
  useEffect(() => {
    const node = moreRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit(l => l + PAGE), { rootMargin: '800px' });
    io.observe(node);
    return () => io.disconnect();
  }, [results.length, limit]);

  const preview = text.trim() || sampleFor(script === 'all' ? 'latin' : script);
  const shown = results.slice(0, limit);
  const filtered = category !== 'all' || script !== 'all' || variableOnly || savedOnly || q;

  const clearFilters = () => {
    setQuery('');
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
        <a className="mark" href="#" onClick={e => (e.preventDefault(), closeFont(), clearFilters())}>
          <Hanko text="WT" size={34} />
          <span>Washi Type</span>
        </a>
        <button
          type="button"
          className={`ghost small${savedOnly ? ' is-on' : ''}`}
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly(v => !v)}
        >
          <Hanko on={savedOnly} size={22}>
            <SaveMark />
          </Hanko>
          Stamped · {saved.size}
        </button>
      </header>

      <section className="hero band" ref={heroRef}>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1>
              <BlurText text="Find the right font" animateBy="words" direction="top" delay={120} blur={14} distance={20} className="title" />
              <span className="for">
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
              </span>
            </h1>
            <p className="lede">
              <CountUp to={fonts.length || 1900} separator="," duration={1.6} /> free fonts, each written out on a
              sheet of washi in your own words. Every one is free to use in personal and commercial work.
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
          <label>
            <span>Script</span>
            <select value={script} onChange={e => setScript(e.target.value)}>
              <option value="all">Any script</option>
              {SCRIPTS.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              {SORTS.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={variableOnly} onChange={e => setVariableOnly(e.target.checked)} />
            <span>Variable only</span>
          </label>
        </div>
      </nav>

      <main className="band desk">
        <p className="count" aria-live="polite">
          {fonts.length ? `${results.length.toLocaleString()} ${results.length === 1 ? 'font' : 'fonts'}` : 'Laying out the sheets…'}
          {filtered && fonts.length > 0 && (
            <button type="button" className="link" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </p>

        {loadError && <p className="empty">The font list didn't load. Refresh the page to try again.</p>}

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

        <div className="grid">
          {shown.map(font => (
            <FontCard
              key={font.id}
              font={font}
              text={preview}
              size={size}
              saved={saved.has(font.id)}
              onToggleSave={toggleSave}
              onOpen={openFont}
            />
          ))}
        </div>
        {limit < results.length && (
          <div ref={moreRef} className="more">
            <button type="button" className="ghost" onClick={() => setLimit(l => l + PAGE)}>
              Show more fonts
            </button>
          </div>
        )}
      </main>

      <footer className="foot band">
        <p>
          <Hanko text="WT" size={26} /> Fonts and metadata from <a href="https://fonts.google.com">Google Fonts</a>,
          served under open licences. Stamped fonts stay in this browser.
        </p>
      </footer>

      {open && (
        <Suspense fallback={<div className="overlay" />}>
        <SpecimenSheet
          font={open}
          text={text.trim() || sampleFor(open.s.includes(script) ? script : open.s.includes('latin') ? 'latin' : open.s[0])}
          saved={saved.has(open.id)}
          onToggleSave={toggleSave}
          onClose={closeFont}
        />
        </Suspense>
      )}
    </ClickSpark>
  );
}
