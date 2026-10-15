// The privacy page: the report's cursor and scrolling, the live clock beside the name, and
// the text popping on.

import { initCursor } from './shared/cursor.js';
import { initSmoothScrolling } from './shared/scroll.js';
import { playLogo } from './shared/logo.js';

initSmoothScrolling();
initCursor();
playLogo(document.querySelector('.brand .logo'), { delay: 160, live: true });

// The text pops on: the headline word by word, then each heading, paragraph and point as
// it comes into view; those that come into view together go one after another
// (the page starts hidden for it: <html class="pop">)
if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
  document.documentElement.classList.remove('pop');
} else {
  // (from here the script reveals each part: the fallback that shows everything is off)
  document.documentElement.classList.add('armed');
  const h1 = document.querySelector('h1');
  h1.innerHTML = h1.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
  h1.classList.add('split');
  const parts = [...document.querySelectorAll('.brand, .kicker, h1 .w, .lead, .when, h2, main > p, li')];
  const seen = new IntersectionObserver(entries => {
    const now = entries.filter(e => e.isIntersecting).map(e => e.target).sort((a, b) => parts.indexOf(a) - parts.indexOf(b));
    now.forEach((el, i) => {
      el.style.setProperty('--d', `${Math.min(i, 14) * 55}ms`);
      el.classList.add('on');
      seen.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const el of parts) seen.observe(el);
}
