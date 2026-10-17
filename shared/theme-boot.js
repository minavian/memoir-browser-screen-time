// Runs before first paint so a saved Light/Dark choice never flashes the wrong theme.
(() => {
  try {
    const saved = localStorage.getItem('bst-theme');
    const pref = saved === 'pink' ? 'pride' : saved; // Pride took Pink's place
    if (pref === 'light' || pref === 'dark' || pref === 'pride') document.documentElement.dataset.theme = pref;
    document.documentElement.dataset.cursor = localStorage.getItem('bst-cursor') === 'off' ? 'off' : 'on';
  } catch { /* storage unavailable: follow the system */ }
})();
