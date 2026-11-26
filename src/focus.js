// Return focus after a dialog closes. If the element that opened it is gone (for
// example a link inside a drawer that has since closed), fall back to a stable control
// so keyboard users don't land at the top of the page.
export function restoreFocus(previous) {
  if (previous?.isConnected && typeof previous.focus === 'function') {
    previous.focus({ preventScroll: true });
    return;
  }
  document.querySelector('[data-focus-home]')?.focus({ preventScroll: true });
}
