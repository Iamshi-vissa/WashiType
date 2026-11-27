// Washi Type: apply a saved light/dark choice before the page paints, so it never flashes the
// other theme. Loaded as a plain (blocking) script in <head>; src/theme.js does the rest.
(function () {
  try {
    var theme = localStorage.getItem('washitype:theme');
    if (theme !== 'light' && theme !== 'dark') return;
    document.documentElement.setAttribute('data-theme', theme);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', theme === 'dark' ? '#12110f' : '#ebe5d8');
  } catch {
    /* storage unavailable: follow the device */
  }
})();
