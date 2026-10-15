// The privacy page: the report's cursor and scrolling, and the live clock beside the name.

import { initCursor } from './shared/cursor.js';
import { initSmoothScrolling } from './shared/scroll.js';
import { playLogo } from './shared/logo.js';

initSmoothScrolling();
initCursor();
playLogo(document.querySelector('.brand .logo'), { delay: 160, live: true });
