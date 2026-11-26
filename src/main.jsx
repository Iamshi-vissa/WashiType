import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary, { reloadOnce } from './components/ErrorBoundary.jsx';
import './styles.css';

// A code file from an older deploy failed to preload: reload once to get the new ones.
window.addEventListener('vite:preloadError', event => {
  if (reloadOnce()) event.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// The service worker keeps a copy of the site so it still opens, with a clear
// "no signal" message, when the connection drops. Production only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the site works without it */
    });
  });
}
