// The privacy page: the report's cursor and scrolling, the live clock beside the name, and
// the line drawings in the margins traced in as they come into view.

import { initCursor } from './shared/cursor.js';
import { initSmoothScrolling } from './shared/scroll.js';
import { playLogo } from './shared/logo.js';

initSmoothScrolling();
initCursor();
playLogo(document.querySelector('.pv-brand .logo'), { delay: 160, live: true });

const pv = document.querySelector('.pv');
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  // each line of a drawing measured as 1, so it can be traced from 0 to 1, in turn
  for (const art of pv.querySelectorAll('.pv-art')) {
    [...art.children].forEach((line, i) => {
      if (!line.hasAttribute('stroke-dasharray')) line.setAttribute('pathLength', '1');
      line.style.setProperty('--d', `${i * 110}ms`);
    });
  }
  pv.classList.add('draw');
  const seen = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('on'); seen.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const art of pv.querySelectorAll('.pv-art')) seen.observe(art);
}
