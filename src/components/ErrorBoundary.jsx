import { Component } from 'react';
import ErrorScreen from './ErrorScreen.jsx';
import { reportError } from '../reportError.js';

// After a new deploy, a tab opened earlier asks for code files that no longer exist.
// Those show up as these errors; a single reload fetches the new files.
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|is not a valid JavaScript MIME type|ChunkLoadError/i;

export const isChunkError = error => CHUNK_ERROR.test(String(error?.message || error));

/** Reload once to pick up a new deploy. Returns false if we already tried in the last minute. */
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem('washitype:reloaded') || 0);
    if (Date.now() - last < 60000) return false;
    sessionStorage.setItem('washitype:reloaded', String(Date.now()));
  } catch {
    /* no storage: reload anyway, a loop is impossible without it ever succeeding */
  }
  location.reload();
  return true;
}

/**
 * Catches render errors below it and shows the TV instead of a blank page.
 * `fallback(error, reset)` can replace the default full-page screen.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    reportError(isChunkError(error) ? 'chunk-load' : 'render', error);
    if (isChunkError(error) && navigator.onLine !== false) reloadOnce();
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    const offline = navigator.onLine === false;
    return (
      <ErrorScreen
        page
        headingLevel={1}
        kind={offline ? 'offline' : 'crash'}
        actions={[
          { label: 'Reload the page', primary: true, onClick: () => location.reload() },
          { label: 'Back to all fonts', href: '/' }
        ]}
      />
    );
  }
}
