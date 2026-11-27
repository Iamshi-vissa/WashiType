// The page Vercel serves, with a real 404 status, for any address that doesn't exist.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorScreen from './components/ErrorScreen.jsx';
import Hanko from './components/Hanko.jsx';
import { readFontRoute, searchTerm, searchPath } from './routes.js';
import './styles.css';

function NotFoundPage() {
  // A link to a font that isn't in the catalog: offer to search for it, like the app does.
  const route = readFontRoute();
  const term = route?.id ? searchTerm(route.id) : '';
  return (
    <>
      <header className="top">
        <a className="mark" href="/">
          <Hanko text="WT" size={34} />
          <span>Washi Type</span>
        </a>
      </header>
      <main className="band">
        {term ? (
          <ErrorScreen
            page
            headingLevel={1}
            kind="noFont"
            title={`No font called “${term}”`}
            actions={[
              { label: `Search for “${term}”`, href: searchPath(term), primary: true },
              { label: 'Back to all fonts', href: '/' }
            ]}
          />
        ) : (
          <ErrorScreen
            page
            headingLevel={1}
            kind="notFound"
            message={`There’s nothing at ${location.pathname}. The link may be mistyped, or the page has moved. Every font is still on the front page.`}
            actions={[{ label: 'Back to all fonts', href: '/', primary: true }]}
          />
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotFoundPage />
  </StrictMode>
);
