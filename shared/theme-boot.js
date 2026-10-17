// Runs before first paint so a saved Light/Dark choice never flashes the wrong theme.
(() => {
  try {
    let pref = localStorage.getItem('bst-theme');
    // Pink, then Pride, were themes once: back to System (the Rainbow clock stays off unless chosen)
    if (pref === 'pink' || pref === 'pride') {
      localStorage.removeItem('bst-theme');
      pref = null;
    }
    if (pref === 'light' || pref === 'dark') document.documentElement.dataset.theme = pref;
    if (localStorage.getItem('bst-rainbow') === 'on') {
      document.documentElement.dataset.rainbow = 'on';
      const icon = document.querySelector('link[rel="icon"]');
      if (icon) icon.href = 'icons/rainbow32.png';
    }
    document.documentElement.dataset.cursor = localStorage.getItem('bst-cursor') === 'off' ? 'off' : 'on';
  } catch { /* storage unavailable: follow the system */ }
})();
