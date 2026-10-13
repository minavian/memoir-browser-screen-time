// The welcome's opening, before the card. On black, with a light drifting in behind,
// WELCOME TO and a big MEMOIR (the trailer's wordmark) arrive letter by letter from left
// to right while the page gets ready behind them (the week drawn, the tour's sample
// weeks made). The O is the card's clock itself, nothing standing in for it: all ring at
// first, heavy and wide in the wordmark's platinum, it thins and rounds off into the
// clock's own ring as the clock sets itself, then flies on into the card as its logo,
// one element on one path. With it the letters fly one after another, left to right,
// onto the card's own MEMOIR and WELCOME TO into its kicker, while the black lifts off.
// Transform and opacity on layers painted once (the O's band is the one repaint, after
// loading). Clicks and keys wait until the card has landed, so nothing unseen is pressed.

import { EASE_OUT } from './shared/fx.js';
import { playLogo } from './shared/logo.js';

// ms: from the start, then from the turn (the word has had its moment and the page is ready)
export const TIMES = {
  light: 250,     // the light behind the word drifts in
  kicker: 300,    // WELCOME TO, letter by letter
  word: 600,      // MEMOIR, the same
  turn: 1825,     // the word has arrived (the R's last ease-out tail aside); later if the page isn't ready
  thin: 0,        // the O thins and rounds off straight away…
  clock: 250,     // …as it takes the clock's own fade and the clock sets itself (done 1660 ms on: shared/logo.js)
  morph: 2510,    // 0.6 s after the clock is set, everything turns into the card…
  step: 75,       // …a letter at a time
  morphMs: 950,
};
const T = TIMES;
const MORPH = 'cubic-bezier(0.5, 0, 0.15, 1)';
const LIFT = 'cubic-bezier(0.4, 0, 0.2, 1)';    // the black lifting off the page
const FONT = '"Memoir Unbounded"';
// Unbounded Black's O, in its size: 0.786 tall and 1.16 times as wide, its middle 0.375
// above the baseline, its counter about 0.42 across (wght 900; its room is in recap.css)
const O_TALL = 0.786, O_WIDE = 1.16, O_MID = 0.375, O_BAND = '42%', RING_BAND = '77.632%';

// where a line of text sits: a zero-size probe on its baseline
function baseline(el) {
  const probe = document.createElement('i');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  el.append(probe);
  const y = probe.getBoundingClientRect().top;
  probe.remove();
  return y;
}

function capHeight(el, ch) {
  const s = getComputedStyle(el);
  const c = document.createElement('canvas').getContext('2d');
  c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  return c.measureText(ch).actualBoundingBoxAscent;
}

// a promise for when an animation-timeline moment comes (it keeps time with the rest)
function at(el, ms) {
  return el.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1, delay: Math.max(0, ms) }).finished.catch(() => {});
}

/**
 * Puts the opening's black up straight away (call before the page draws anything),
 * with its words waiting. play() runs it.
 */
export function createIntro(root) {
  const bg = document.createElement('div');
  bg.className = 'wi-bg';
  bg.setAttribute('aria-hidden', 'true');
  const type = document.createElement('div');
  type.className = 'wi-type';
  type.setAttribute('aria-hidden', 'true');
  const kick = [...'WELCOME TO'].map(ch => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  // the O is only room in the word: the card's clock takes it (play)
  const word = [...'MEMOIR'].map(ch => (ch === 'O' ? '<span class="wi-o"></span>'
    : `<span class="wordmark wm-dark" data-t="${ch}">${ch}</span>`)).join('');
  type.innerHTML = `<p class="wi-kicker">${kick}</p><p class="wi-word">${word}</p>`;
  root.querySelector('.wel-dim').after(bg);
  root.append(type);
  root.classList.add('intro');

  let landed;
  const done = new Promise(r => { landed = r; });

  /**
   * Plays it, turning once `progress.promise` (the page's work) is done, into the card's
   * own MEMOIR, kicker and logo (found at rest). Resolves once it has begun: start the card's own entrance then; the rest of
   * the card waits for `.cascade`, which comes as the letters fly.
   */
  async function play({ card, mark, progress }) {
    await Promise.race([document.fonts.load(`900 100px ${FONT}`), new Promise(r => setTimeout(r, 1500))]).catch(() => {});

    // ---- everything measured at rest, before anything moves
    const word = type.querySelector('.wi-word');
    const kicker = type.querySelector('.wi-kicker');
    const big = [...word.children];                            // M E M, the O's room, I R
    const F = parseFloat(getComputedStyle(word).fontSize);
    const cap = F * 0.75;                                      // Unbounded's cap height
    const wr = word.getBoundingClientRect();
    const base = baseline(word);
    // the platinum runs across the whole word: each letter shows its slice
    for (const L of big) {
      L.style.setProperty('--wm-w', `${wr.width}px`);
      L.style.setProperty('--wm-x', `${wr.left - L.getBoundingClientRect().left}px`);
    }

    // each letter flies onto its own in the card's MEMOIR: the same face, so it lands exactly
    const title = card.querySelector('.wel-title .wordmark');
    const k = parseFloat(getComputedStyle(title).fontSize) / F;
    const tBase = baseline(title.parentElement);
    const range = document.createRange();
    const flights = big.map((L, i) => {
      range.setStart(title.firstChild, i);
      range.setEnd(title.firstChild, i + 1);
      const a = L.getBoundingClientRect(), b = range.getBoundingClientRect();
      L.style.transformOrigin = `50% ${base - a.top}px`;
      return { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: tBase - base };
    });
    const kick = card.querySelector('.wel-kicker');
    const ka = kicker.getBoundingClientRect(), kb = kick.getBoundingClientRect();
    const kaBase = baseline(kicker), kbBase = baseline(kick);
    kicker.style.transformOrigin = `50% ${kaBase - ka.top}px`;
    kick.style.transformOrigin = `50% ${kbBase - kb.top}px`;
    const kk = capHeight(kick, 'W') / (parseFloat(getComputedStyle(kicker).fontSize) * 0.75);
    const kdx = kb.left + kb.width / 2 - (ka.left + ka.width / 2), kdy = kbBase - kaBase;

    // the card's clock is the O: one element, from the word to the card. In the word it's
    // scaled up to the O's height in the O's room, and its ring is the O, heavy (O_BAND) and
    // wide (O_WIDE), in the word's platinum across it, with the letters' glow
    const logo = mark.querySelector('.logo');
    const ring = logo.querySelector('.lg-ring');
    const m = mark.getBoundingClientRect(), o = big[3].getBoundingClientRect(), r = ring.getBoundingClientRect();
    const s = (F * O_TALL) / r.height;
    const ox = o.left + o.width / 2, oy = base - F * O_MID;
    const inWord = (nudge = 0, k = 1) => `translate(${ox + nudge - (m.left + m.width / 2)}px, ${oy - (m.top + m.height / 2)}px) scale(${s * k})`;
    const kx = s * O_WIDE, ky = s, lt = big[0].getBoundingClientRect();
    const left = ox - (r.width * kx) / 2, top = oy - (r.height * ky) / 2;
    ring.classList.add('wm-dark');
    ring.style.setProperty('--wi-ox', `${(wr.left - left) / kx}px`);
    ring.style.setProperty('--wi-oy', `${(lt.top - top) / ky}px`);
    ring.style.setProperty('--wi-ow', `${wr.width / kx}px`);
    ring.style.setProperty('--wi-oh', `${lt.height / ky}px`);
    ring.style.setProperty('--wi-og', `${96 / kx}px ${96 / ky}px`);
    ring.style.setProperty('--lg-band', O_BAND);
    ring.style.scale = `${O_WIDE} 1`;
    const glow = a => `0 0 ${(0.045 * F) / s}px rgba(255, 255, 255, ${0.32 * a}), 0 0 ${(0.16 * F) / s}px rgba(255, 255, 255, ${0.12 * a})`;
    ring.style.boxShadow = glow(1);
    mark.classList.add('as-o');                                // hands and knob wait for the turn

    // the light behind the word drifts in from the left and settles between the M and the O
    const light = document.createElement('div');
    light.className = 'wi-light';
    Object.assign(light.style, {
      left: `${wr.left + wr.width * 0.6 - wr.width * 0.55}px`, top: `${base - cap * 0.92 - cap * 1.1}px`,
      width: `${wr.width * 1.1}px`, height: `${cap * 2.2}px`,
    });
    bg.append(light);

    // ---- the start, all at once
    const go = (el, kf, opts) => el.animate(kf, { fill: 'both', easing: 'linear', ...opts });
    go(light, [{ opacity: 0, transform: `translateX(${-wr.width * 0.5}px)`, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' }, { opacity: 1, offset: 0.35 }, { opacity: 1, transform: 'none' }],
      { duration: 2600, delay: T.light });
    [...kicker.children].forEach((L, i) => go(L, [{ opacity: 0, transform: 'translateX(-0.7em)' }, { opacity: 1, transform: 'none' }],
      { duration: 800, delay: T.kicker + i * 40, easing: EASE_OUT }));
    big.forEach((L, i) => go(i === 3 ? mark : L,
      i === 3 ? [{ opacity: 0, transform: inWord(-0.16 * F, 0.96) }, { opacity: 1, transform: inWord() }]
        : [{ opacity: 0, transform: 'translateX(-0.16em) scale(0.96)' }, { opacity: 1, transform: 'none' }],
      { duration: 1000, delay: T.word + i * 105, easing: EASE_OUT }));

    // ---- the turn: once the word has had its moment and the page's work is done
    const filled = Promise.all([at(word, T.turn), progress.promise]);

    // ---- the O becomes the clock, and it all becomes the card
    filled.then(() => {
      // on Light the card's logo is the one for light backgrounds (shared/logo.css .themed)
      const onLight = getComputedStyle(logo).getPropertyValue('--logo-disc').trim() === 'transparent';

      // the O thins and rounds off into the clock's ring (band and width in one animation,
      // so they keep step), its platinum giving way to the ring's own fade, as the clock sets itself
      go(ring, [{ '--lg-band': O_BAND, scale: `${O_WIDE} 1` }, { '--lg-band': RING_BAND, scale: '1 1' }],
        { duration: 900, delay: T.thin, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' });
      const tint = { duration: 650, delay: T.clock + 60, fill: 'forwards' };
      go(ring, [{ opacity: 1 }, { opacity: 0 }], { ...tint, pseudoElement: '::after' });
      go(ring, [{ opacity: 0 }, { opacity: 1 }], { ...tint, pseudoElement: '::before' });
      go(ring, [{ boxShadow: glow(1) }, { boxShadow: glow(0) }], tint);
      mark.classList.remove('as-o');
      playLogo(logo, { delay: T.clock, face: false, fromO: true });

      // into the card, a letter at a time from the left: the clock goes on in the O's turn,
      // from the word to its own place; when the R has landed, the card's MEMOIR takes over
      const landing = T.morph + 5 * T.step + T.morphMs;
      const flying = [];
      big.forEach((L, i) => {
        const start = T.morph + i * T.step;
        if (i === 3) {
          flying.push(go(mark, [{ opacity: 1, transform: inWord() }, { opacity: 1, transform: 'none' }], { duration: T.morphMs, delay: start, easing: MORPH }));
          // its disc comes in as it flies (on Light it has none: below)
          if (!onLight) go(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: start + 250, pseudoElement: '::before', fill: 'forwards' });
          return;
        }
        const { dx, dy } = flights[i];
        flying.push(go(L, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: T.morphMs, delay: start, easing: MORPH, fill: 'forwards' }));
        go(L, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: landing - 120, fill: 'forwards' });
      });
      flying.push(go(title, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: landing - 160 }));
      // on Light it becomes the logo for light backgrounds as it flies: no disc, and the
      // clock turns from white to ink with the page as the black lifts, a little behind it
      // (white while the page is still dark, ink once it's light), filling the disc's room
      // as it goes (on the disc it's 84% of it). Its knob's middle becomes a hole through to
      // the page first, while the page is still black (unseen: the same black)
      const settle = [];
      if (onLight) {
        at(logo, T.morph).then(() => {
          logo.classList.add('cut');
          logo.style.setProperty('--lg-knob-mid', 'transparent');
        });
        settle.push(
          go(logo, [{ '--lg-ink': '255 255 255' }, { '--lg-ink': getComputedStyle(logo).getPropertyValue('--logo-ink').trim() }],
            { duration: 300, delay: T.morph + 300, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }),
          go(logo.querySelector('.lg-clock'), [{ scale: '1' }, { scale: `${1 / 0.84}` }],
            { duration: T.morphMs, delay: T.morph + 3 * T.step, easing: MORPH, fill: 'forwards' }));
      }
      go(kicker, [{ opacity: 1, transform: 'none' }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 0.7 }, { opacity: 0, transform: `translate(${kdx}px, ${kdy}px) scale(${kk})` }],
        { duration: T.morphMs, delay: T.morph, easing: MORPH, fill: 'forwards' });
      go(kick, [{ opacity: 0, transform: `translate(${-kdx}px, ${-kdy}px) scale(${1 / kk})` }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.8 }, { opacity: 1, transform: 'none' }],
        { duration: T.morphMs, delay: T.morph, easing: MORPH });
      // the black lifts off the page as they fly, and the rest of the card follows them in
      flying.push(go(bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 750, delay: T.morph + 60, easing: LIFT, fill: 'forwards' }));
      at(bg, T.morph).then(() => root.classList.add('cascade'));
      Promise.all(flying.map(a => a.finished)).catch(() => {}).then(() => {
        // from here it's the logo that follows the theme, as everywhere else (the same look)
        logo.classList.add('themed');
        settle.forEach(a => a.cancel());
        logo.style.removeProperty('--lg-knob-mid');
        bg.remove();
        type.remove();
        root.classList.add('landed');
        landed();
      });
    });
  }

  return {
    play,
    landed: done,
    // until the card has landed, a click or a key is for the opening (it does nothing)
    get busy() { return !root.classList.contains('landed'); },
  };
}
