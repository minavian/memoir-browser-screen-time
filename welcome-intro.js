// The welcome's opening, before the card. On black, with a light drifting in behind,
// WELCOME TO and a big MEMOIR (the trailer's wordmark) arrive letter by letter from left
// to right; the O thins out into the clock, which sets itself; then it all becomes the
// welcome card: the letters fly one after another, left to right (the clock in the O's
// turn), onto the card's own MEMOIR, WELCOME TO into its kicker and the clock into its
// logo, while the black lifts off the page.
// Everything is scheduled at once from one start, on transform and opacity on layers
// painted once (the glow is a text-shadow, no filters); the O's weight is the one thing
// that repaints, and it comes after the page behind has rendered. Clicks and keys wait
// until the card has landed, so nothing unseen is pressed.

import { EASE_OUT } from './shared/fx.js';
import { playLogo } from './shared/logo.js';

// ms from the start
export const TIMES = {
  light: 250,     // the light behind the word starts drifting in
  kicker: 300,    // WELCOME TO, letter by letter
  word: 600,      // MEMOIR, the same
  thin: 3300,     // after a beat on the whole word, the O thins out…
  clock: 3400,    // …into the clock, which sets itself (shared/logo.js)
  morph: 4800,    // everything turns into the card…
  step: 75,       // …a letter at a time
  morphMs: 950,
};
const T = TIMES;
const MORPH = 'cubic-bezier(0.5, 0, 0.15, 1)';
const FONT = '"Memoir Unbounded"';
// when the last letter (the R) has landed
const LANDED = T.morph + 5 * T.step + T.morphMs;

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
  root.style.setProperty('--intro', `${T.morph}ms`);

  const run = [];

  /**
   * Plays it, into the card's own MEMOIR, kicker and logo (they're found at rest).
   * Resolves once everything is scheduled: start the card's own entrance then.
   */
  async function play({ card, mark }) {
    await Promise.race([document.fonts.load(`900 100px ${FONT}`), new Promise(r => setTimeout(r, 1500))]).catch(() => {});

    // ---- everything measured at rest, before anything moves
    const wordEl = type.querySelector('.wi-word');
    const kicker = type.querySelector('.wi-kicker');
    const big = [...wordEl.children];
    const O = big[3];
    O.style.width = `${O.getBoundingClientRect().width}px`;   // so it can thin without moving the I and R
    const F = parseFloat(getComputedStyle(wordEl).fontSize);
    const cap = F * 0.75;                                      // Unbounded's cap height
    const wr = wordEl.getBoundingClientRect();
    const base = baseline(wordEl);
    // the platinum runs across the whole word, so each letter shows its own slice of it
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

    // the clock sits where the O is, its ring on the O's outline (the ring is 0.76 of the disc)
    const m = mark.getBoundingClientRect(), o = O.getBoundingClientRect();
    const markAt = `translate(${o.left + o.width / 2 - (m.left + m.width / 2)}px, ${base - F * 0.375 - (m.top + m.height / 2)}px) scale(${(F * 0.78) / (m.width * 0.76)})`;

    // the light behind the word drifts in from the left and settles between the M and the O
    const light = document.createElement('div');
    light.className = 'wi-light';
    Object.assign(light.style, {
      left: `${wr.left + wr.width * 0.6 - wr.width * 0.55}px`, top: `${base - cap * 0.92 - cap * 1.1}px`,
      width: `${wr.width * 1.1}px`, height: `${cap * 2.2}px`,
    });
    bg.append(light);

    // ---- the schedule, all from now
    const go = (el, kf, opts) => {
      const a = el.animate(kf, { fill: 'both', easing: 'linear', ...opts });
      run.push(a);
      return a;
    };
    // the black, from the start until it lifts off the page (the opening's clock: run[0])
    const lift = T.morph + 60;
    go(bg, [{ opacity: 1 }, { opacity: 1, offset: lift / (lift + 750), easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }, { opacity: 0 }], { duration: lift + 750, fill: 'forwards' });
    go(light, [{ opacity: 0, transform: `translateX(${-wr.width * 0.5}px)`, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' }, { opacity: 1, offset: 0.35 }, { opacity: 1, transform: 'none' }],
      { duration: 2600, delay: T.light });
    // WELCOME TO, then MEMOIR, letter by letter from the left
    [...kicker.children].forEach((L, i) => go(L, [{ opacity: 0, transform: 'translateX(-0.7em)' }, { opacity: 1, transform: 'none' }],
      { duration: 800, delay: T.kicker + i * 40, easing: EASE_OUT }));
    big.forEach((L, i) => go(L, [{ opacity: 0, transform: 'translateX(-0.16em) scale(0.96)' }, { opacity: 1, transform: 'none' }],
      { duration: 1000, delay: T.word + i * 105, easing: EASE_OUT }));
    // the O thins out to the clock's ring and gives way to it
    go(O, [{ fontVariationSettings: '"wght" 900' }, { fontVariationSettings: '"wght" 200' }], { duration: 900, delay: T.thin, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' });
    go(O, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: T.thin + 480, fill: 'forwards' });
    const logo = mark.querySelector('.logo');
    playLogo(logo, { delay: T.clock, face: false, gentle: true });

    // into the card, a letter at a time from the left: the clock goes in the O's turn,
    // into the card's logo; when the R has landed, the card's MEMOIR takes over
    big.forEach((L, i) => {
      const start = T.morph + i * T.step;
      if (i === 3) {
        go(mark, [
          { opacity: 1, transform: markAt },
          { opacity: 1, transform: markAt, offset: start / (start + T.morphMs), easing: MORPH },
          { opacity: 1, transform: 'none' },
        ], { duration: start + T.morphMs });
        go(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: start + 250, pseudoElement: '::before', fill: 'forwards' });
        return;
      }
      const { dx, dy } = flights[i];
      go(L, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: T.morphMs, delay: start, easing: MORPH, fill: 'forwards' });
      go(L, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: LANDED - 120, fill: 'forwards' });
    });
    go(title, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: LANDED - 160 });
    go(kicker, [{ opacity: 1, transform: 'none' }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 0.7 }, { opacity: 0, transform: `translate(${kdx}px, ${kdy}px) scale(${kk})` }],
      { duration: T.morphMs, delay: T.morph, easing: MORPH, fill: 'forwards' });
    go(kick, [{ opacity: 0, transform: `translate(${-kdx}px, ${-kdy}px) scale(${1 / kk})` }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.8 }, { opacity: 1, transform: 'none' }],
      { duration: T.morphMs, delay: T.morph, easing: MORPH });

    Promise.all(run.map(a => a.finished)).catch(() => {}).then(() => {
      bg.remove();
      type.remove();
      root.classList.add('landed');
    });
  }

  return {
    play,
    // until the card has landed, a click or a key is for the opening (it does nothing)
    get busy() { return !root.classList.contains('landed') && (!run.length || (run[0].currentTime ?? 0) < LANDED); },
  };
}
