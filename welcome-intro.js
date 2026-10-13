// The welcome's opening, before the card. On black, with a light drifting in behind,
// WELCOME TO and a big MEMOIR (the trailer's wordmark) arrive letter by letter from left
// to right while the page gets ready behind them (the week drawn, the tour's sample
// weeks made); then the O thins and rounds off into the clock's ring, the clock fades in
// over it and sets itself, and it all becomes the welcome card: the letters fly one
// after another, left to right (the clock in the O's turn), onto the card's own MEMOIR,
// WELCOME TO into its kicker and the clock into its logo, while the black lifts off.
// Transform and opacity on layers painted once (the O's weight is the one repaint, after
// loading). Clicks and keys wait until the card has landed, so nothing unseen is pressed.

import { EASE_OUT } from './shared/fx.js';
import { playLogo } from './shared/logo.js';

// ms: from the start, then from the turn (the word has had its moment and the page is ready)
export const TIMES = {
  light: 250,     // the light behind the word drifts in
  kicker: 300,    // WELCOME TO, letter by letter
  word: 600,      // MEMOIR, the same
  turn: 2300,     // the earliest the O can turn (later if the page isn't ready)
  thin: 400,      // the O thins out…
  clock: 650,     // …as the clock fades in in its place and sets itself (shared/logo.js)
  morph: 2050,    // everything turns into the card…
  step: 75,       // …a letter at a time
  morphMs: 950,
};
const T = TIMES;
const MORPH = 'cubic-bezier(0.5, 0, 0.15, 1)';
const FONT = '"Memoir Unbounded"';

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
  const word = [...'MEMOIR'].map(ch => `<span class="wordmark wm-dark" data-t="${ch}">${ch}</span>`).join('');
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
    const big = [...word.children];
    const O = big[3];
    O.style.width = `${O.getBoundingClientRect().width}px`;   // so it can thin without moving the I and R
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

    // the clock sits where the O is, its ring exactly on the thinned O (the ring is 0.76 of the disc):
    // Unbounded's O at weight 300 is 0.776 of the size tall with a stroke the ring's own weight,
    // and narrowed to 0.921 it's round
    const m = mark.getBoundingClientRect(), o = O.getBoundingClientRect();
    const markAt = `translate(${o.left + o.width / 2 - (m.left + m.width / 2)}px, ${base - F * 0.375 - (m.top + m.height / 2)}px) scale(${(F * 0.776) / (m.width * 0.76)})`;

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
    big.forEach((L, i) => go(L, [{ opacity: 0, transform: 'translateX(-0.16em) scale(0.96)' }, { opacity: 1, transform: 'none' }],
      { duration: 1000, delay: T.word + i * 105, easing: EASE_OUT }));

    // ---- the turn: once the word has had its moment and the page's work is done
    const filled = Promise.all([at(word, T.turn), progress.promise]);

    // ---- the O becomes the clock, and it all becomes the card
    filled.then(() => {

      // the O thins out and rounds off into the ring, which fades in over it, at its pace
      const thinning = { duration: 900, delay: T.thin, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' };
      go(O, [{ fontVariationSettings: '"wght" 900' }, { fontVariationSettings: '"wght" 300' }], thinning);
      go(O, [{ scale: '1 1' }, { scale: '0.921 1' }], thinning);
      go(O, [{ opacity: 1 }, { opacity: 0 }], { duration: 650, delay: T.clock + 60, fill: 'forwards' });
      const logo = mark.querySelector('.logo');
      go(mark, [{ opacity: 1, transform: markAt }, { opacity: 1, transform: markAt }], { duration: 1 });
      playLogo(logo, { delay: T.clock, face: false, gentle: true });

      // into the card, a letter at a time from the left: the clock goes in the O's turn,
      // into the card's logo; when the R has landed, the card's MEMOIR takes over
      const landing = T.morph + 5 * T.step + T.morphMs;
      const flying = [];
      big.forEach((L, i) => {
        const start = T.morph + i * T.step;
        if (i === 3) {
          flying.push(go(mark, [{ opacity: 1, transform: markAt }, { opacity: 1, transform: 'none' }], { duration: T.morphMs, delay: start, easing: MORPH }));
          go(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: start + 250, pseudoElement: '::before', fill: 'forwards' });
          return;
        }
        const { dx, dy } = flights[i];
        flying.push(go(L, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: T.morphMs, delay: start, easing: MORPH, fill: 'forwards' }));
        go(L, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: landing - 120, fill: 'forwards' });
      });
      flying.push(go(title, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: landing - 160 }));
      go(kicker, [{ opacity: 1, transform: 'none' }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 0.7 }, { opacity: 0, transform: `translate(${kdx}px, ${kdy}px) scale(${kk})` }],
        { duration: T.morphMs, delay: T.morph, easing: MORPH, fill: 'forwards' });
      go(kick, [{ opacity: 0, transform: `translate(${-kdx}px, ${-kdy}px) scale(${1 / kk})` }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.8 }, { opacity: 1, transform: 'none' }],
        { duration: T.morphMs, delay: T.morph, easing: MORPH });
      // the black lifts off the page as they fly, and the rest of the card follows them in
      flying.push(go(bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 750, delay: T.morph + 60, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }));
      at(bg, T.morph).then(() => root.classList.add('cascade'));
      Promise.all(flying.map(a => a.finished)).catch(() => {}).then(() => {
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
