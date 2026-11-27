// Light or dark. With no choice saved the site follows the device; flipping the switch saves
// a choice in this browser. public/theme.js applies a saved choice before the page paints.
import { useCallback, useEffect, useState } from 'react';
import useMedia from './useMedia.js';

const KEY = 'washitype:theme';
// The browser bar colour for each theme (matches --bg in styles.css).
const BAR = { light: '#ebe5d8', dark: '#12110f' };

function readChoice() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function apply(choice) {
  const root = document.documentElement;
  if (choice) root.dataset.theme = choice;
  else delete root.dataset.theme;
  // Two theme-color tags, one per device setting; a saved choice sets both.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const forDark = /dark/.test(meta.getAttribute('media') || '');
    meta.setAttribute('content', BAR[choice ?? (forDark ? 'dark' : 'light')]);
  }
}

/** Returns ['light' | 'dark', setTheme]. */
export function useTheme() {
  const deviceDark = useMedia('(prefers-color-scheme: dark)');
  const [choice, setChoice] = useState(readChoice);

  // Another tab flipped the switch: follow it.
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== KEY) return;
      const next = readChoice();
      setChoice(next);
      apply(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback(theme => {
    setChoice(theme);
    apply(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  }, []);

  return [choice ?? (deviceDark ? 'dark' : 'light'), setTheme];
}
