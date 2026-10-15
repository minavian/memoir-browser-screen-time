// The privacy page: the report's cursor and scrolling, the live clock beside the name, and
// the contents following along (a click glides to its section).

import { initCursor } from './shared/cursor.js';
import { initSmoothScrolling, smoothScrollTo } from './shared/scroll.js';
import { playLogo } from './shared/logo.js';

initSmoothScrolling();
initCursor();
playLogo(document.querySelector('.pv-top .logo'), { delay: 160, live: true });

const page = document.scrollingElement;
const links = [...document.querySelectorAll('.pv-toc a')];
const sections = [...document.querySelectorAll('.pv-sec')];

for (const a of links) {
  a.addEventListener('click', e => {
    const to = document.querySelector(a.getAttribute('href'));
    if (!to) return;
    e.preventDefault();
    smoothScrollTo(page, { top: page.scrollTop + to.getBoundingClientRect().top - 24 });
    window.history.replaceState(null, '', a.getAttribute('href'));
    // marked at once, and kept (near the end the page may not scroll that far) until you scroll
    picked = to;
    follow();
  });
}

// the section in view: the one at the top of the window (at the very bottom, the last one),
// or the one just picked
let picked = null;
for (const type of ['wheel', 'keydown', 'pointerdown', 'touchstart']) addEventListener(type, () => { picked = null; }, { passive: true });
function follow() {
  let at = sections[0];
  for (const s of sections) if (s.getBoundingClientRect().top <= 100) at = s;
  if (page.scrollTop + innerHeight >= page.scrollHeight - 4) at = sections[sections.length - 1];
  if (picked) at = picked;
  for (const a of links) a.setAttribute('aria-current', String(a.getAttribute('href') === `#${at.id}`));
}
addEventListener('scroll', follow, { passive: true });
addEventListener('resize', follow);
follow();
