// The page Vercel serves, with a real 404 status, for any address that doesn't exist.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorScreen from './components/ErrorScreen.jsx';
import Hanko from './components/Hanko.jsx';
import './styles.css';

function NotFoundPage() {
  return (
    <>
      <header className="top">
        <a className="mark" href="/">
          <Hanko text="WT" size={34} />
          <span>Washi Type</span>
        </a>
      </header>
      <main className="band">
        <ErrorScreen
          page
          headingLevel={1}
          kind="notFound"
          message={`There’s nothing at ${location.pathname}. The link may be mistyped, or the page has moved. Every font is still on the front page.`}
          actions={[{ label: 'Back to all fonts', href: '/', primary: true }]}
        />
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotFoundPage />
  </StrictMode>
);
