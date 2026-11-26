import TvError from './TvError/TvError.jsx';

// What each kind of failure shows on the TV, and its words.
export const ERROR_KINDS = {
  notFound: {
    screen: 'NOT FOUND',
    digits: '404',
    title: 'This page isn’t on the desk',
    message: 'The link may be mistyped, or the page has moved. Every font is still on the front page.'
  },
  noFont: {
    screen: 'NOT FOUND',
    digits: '404',
    title: 'No font by that name',
    message: 'The link points to a font that isn’t in the catalog, or the link got cut short.'
  },
  offline: {
    screen: 'NO SIGNAL',
    digits: 'OFF',
    title: 'Can’t reach Washi Type',
    message: 'You seem to be offline. Check your connection; the page will try again as soon as you’re back.'
  },
  unreachable: {
    screen: 'NO SIGNAL',
    digits: '503',
    title: 'The font list didn’t arrive',
    message: 'The server didn’t answer in time. It’s usually a hiccup: try again in a moment.'
  },
  crash: {
    screen: 'ERROR',
    digits: 'ERR',
    title: 'Something broke',
    message: 'Part of the page failed to load. Reloading usually fixes it.'
  }
};

/**
 * A full error message with the TV above it.
 * actions: [{ label, onClick?, href?, primary? }]
 */
export default function ErrorScreen({ kind = 'crash', title, message, actions = [], page = false, headingLevel = 2 }) {
  const k = ERROR_KINDS[kind] ?? ERROR_KINDS.crash;
  const Heading = `h${headingLevel}`;
  return (
    <section className={`err${page ? ' err--page' : ''}`} role="alert" aria-live="assertive">
      <div className="err-tv">
        <TvError screenText={k.screen} digits={k.digits} />
      </div>
      <Heading className="err-title">{title ?? k.title}</Heading>
      <p className="err-message">{message ?? k.message}</p>
      {actions.length > 0 && (
        <div className="err-actions">
          {actions.map(a =>
            a.href ? (
              <a key={a.label} className={a.primary ? 'btn' : 'ghost'} href={a.href}>
                {a.label}
              </a>
            ) : (
              <button key={a.label} type="button" className={a.primary ? 'btn' : 'ghost'} onClick={a.onClick}>
                {a.label}
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
}
