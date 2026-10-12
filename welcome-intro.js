// The welcome's opening, before the card. On black, grain blooms up here and there and
// drifts off slowly, each bloom with a soft crackle; then WELCOME TO and a big MEMOIR
// (the trailer's wordmark, with a light behind it) arrive letter by letter from left to
// right; the clock takes the O's place, as heavy as the O at first and slowly thinning
// to its own weight as it sets itself; then it all becomes the welcome card. The
// letters fly onto the card's own MEMOIR, WELCOME TO into its kicker and the clock into
// its logo, while the black lifts off the page.
// Made to stay smooth on a slow device: everything is scheduled at once from one start,
// almost all of it transform and opacity on layers painted once (the letters' glow is a
// text-shadow, the grain clouds are drawn with their soft edge in them: no filters, no
// masks moving; the clock's ring thins by scaling). A click or a key skips ahead to the card.

import { EASE_OUT } from './shared/fx.js';
import { playLogo } from './shared/logo.js';
import { TIMES as T, plan, rng } from './shared/intro-score.js';

const MORPH = 'cubic-bezier(0.5, 0, 0.15, 1)';
const POPIN = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
const FONT = '"Memoir Unbounded"';
const TILE = 160;
const CLOUD = 384;
// the heavy O's hole is about 0.4 of its outer radius (Unbounded 900: its stroke is 238
// of 393 units), so the clock's ring starts with its inner edge there
const O_INNER = 0.4;

// A tile of fine light specks, for the faint grain over the whole black.
function specks(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  const img = g.createImageData(TILE, TILE);
  const r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r();
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 205 + r() * 50;
    img.data[i + 3] = v * v * v * 255;
  }
  g.putImageData(img, 0, 0);
  return `url(${c.toDataURL()})`;
}

// A cloud of grain with its soft round edge drawn in (so it needs no mask): full to a
// fifth of the way out, under half by three fifths, gone at the rim; a faint haze under it.
function cloud(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = CLOUD;
  const g = c.getContext('2d');
  const img = g.createImageData(CLOUD, CLOUD);
  const r = rng(seed), h = CLOUD / 2;
  for (let y = 0; y < CLOUD; y++) {
    for (let x = 0; x < CLOUD; x++) {
      const d = Math.hypot(x + 0.5 - h, y + 0.5 - h) / h;
      if (d >= 1) continue;
      const fall = d < 0.22 ? 1 : d < 0.62 ? 1 - ((d - 0.22) / 0.4) * 0.55 : 0.45 * (1 - (d - 0.62) / 0.38);
      const v = r(), i = (y * CLOUD + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 205 + r() * 50;
      img.data[i + 3] = (v * v * v + 0.05 * (1 - d)) * fall * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

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

// The sounds play from an offscreen document (sound.js): a fresh tab can't start audio.
async function sound(startedAt) {
  try {
    if (!chrome.offscreen) return;
    if (!(await chrome.offscreen.hasDocument())) {
      await chrome.offscreen.createDocument({ url: 'sound.html', reasons: ['AUDIO_PLAYBACK'], justification: 'The first-run welcome plays a few soft sounds.' });
    }
    await chrome.runtime.sendMessage({ to: 'sound', play: 'intro', startedAt });
    setTimeout(() => chrome.offscreen.closeDocument().catch(() => {}), 10_000);
  } catch { /* no sound, then */ }
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
  const elapsed = () => (run.length ? run[0].currentTime ?? 0 : 0);

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
    const markAt = `translate(${o.left + o.width / 2 - (m.left + m.width / 2)}px, ${base - F * 0.375 - (m.top + m.height / 2)}px) scale(${(F * 0.786) / (m.width * 0.76)})`;

    // the light behind the word drifts in from the left and settles between the M and the O
    const light = document.createElement('div');
    light.className = 'wi-light';
    Object.assign(light.style, {
      left: `${wr.left + wr.width * 0.6 - wr.width * 0.55}px`, top: `${base - cap * 0.92 - cap * 1.1}px`,
      width: `${wr.width * 1.1}px`, height: `${cap * 2.2}px`,
    });
    const field = document.createElement('div');
    field.className = 'wi-grain';
    field.style.backgroundImage = specks(11);
    const { blooms } = plan();
    const clouds = [cloud(23), cloud(31), cloud(47)];
    const puffs = blooms.map((b, i) => {
      const el = document.createElement('canvas');
      el.className = 'wi-bloom';
      el.width = el.height = CLOUD;
      el.getContext('2d').drawImage(clouds[i % 3], 0, 0);
      Object.assign(el.style, { left: `${b.x * 100}vw`, top: `${b.y * 100}vh`, width: `${b.size}vmin`, height: `${b.size}vmin` });
      return el;
    });
    bg.append(field, ...puffs, light);

    // ---- the schedule, all from now
    const go = (el, kf, opts) => {
      const a = el.animate(kf, { fill: 'both', easing: 'linear', ...opts });
      run.push(a);
      return a;
    };
    // a faint grain over the whole black, drifting the whole time
    go(field, [{ opacity: 0, transform: 'none' }, { opacity: 0.3, offset: 0.25 }, { opacity: 0.3, offset: 0.8 }, { opacity: 0.2, transform: 'translate(-56px, -34px)' }],
      { duration: T.end + 400 });
    // the blooms: each pops up, then drifts, turns and fades, slowly
    blooms.forEach((b, i) => go(puffs[i], [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.5)', easing: POPIN },
      { opacity: 1, transform: `translate(-50%, -50%) scale(1) rotate(${b.turn * 0.15}deg)`, offset: 0.13 },
      { opacity: 0.6, offset: 0.55 },
      { opacity: 0, transform: `translate(calc(-50% + ${b.dx}vmin), calc(-50% + ${b.dy}vmin)) scale(1.16) rotate(${b.turn}deg)` },
    ], { duration: b.life, delay: b.at }));
    go(light, [{ opacity: 0, transform: `translateX(${-wr.width * 0.5}px)`, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' }, { opacity: 1, offset: 0.35 }, { opacity: 1, transform: 'none' }],
      { duration: 2600, delay: T.light });
    // WELCOME TO, then MEMOIR, letter by letter from the left
    [...kicker.children].forEach((L, i) => go(L, [{ opacity: 0, transform: 'translateX(-0.7em)' }, { opacity: 1, transform: 'none' }],
      { duration: 800, delay: T.kicker + i * 40, easing: EASE_OUT }));
    big.forEach((L, i) => go(L, [{ opacity: 0, transform: 'translateX(-0.16em) scale(0.96)' }, { opacity: 1, transform: 'none' }],
      { duration: 1000, delay: T.word + i * 105, easing: EASE_OUT }));

    // the clock takes the O's place, as heavy as the O, and slowly thins to its own weight
    go(O, [{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: T.clock + 60, fill: 'forwards' });
    const logo = mark.querySelector('.logo');
    go(mark, [
      { opacity: 1, transform: markAt },
      { opacity: 1, transform: markAt, offset: T.morph / (T.morph + T.morphMs), easing: MORPH },
      { opacity: 1, transform: 'none' },
    ], { duration: T.morph + T.morphMs });
    playLogo(logo, { delay: T.clock, face: false, thick: O_INNER });
    go(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: T.morph + 250, pseudoElement: '::before', fill: 'forwards' });

    // into the card: each letter onto its own (the furthest set off first, so they land
    // together), then the card's MEMOIR takes over where they've landed
    const far = Math.max(...flights.map(f => Math.hypot(f.dx, f.dy)));
    big.forEach((L, i) => {
      if (i === 3) return;   // the O became the clock
      const { dx, dy } = flights[i];
      const start = T.morph + (1 - Math.hypot(dx, dy) / far) * 160;
      go(L, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: T.morphMs, delay: start, easing: MORPH, fill: 'forwards' });
      go(L, [{ opacity: 1 }, { opacity: 0 }], { duration: T.morphMs * 0.2, delay: start + T.morphMs * 0.86, fill: 'forwards' });
    });
    go(title, [{ opacity: 0 }, { opacity: 1 }], { duration: T.morphMs * 0.24, delay: T.morph + 160 + T.morphMs * 0.8 });
    go(kicker, [{ opacity: 1, transform: 'none' }, { opacity: 1, offset: 0.25 }, { opacity: 0, offset: 0.7 }, { opacity: 0, transform: `translate(${kdx}px, ${kdy}px) scale(${kk})` }],
      { duration: T.morphMs, delay: T.morph, easing: MORPH, fill: 'forwards' });
    go(kick, [{ opacity: 0, transform: `translate(${-kdx}px, ${-kdy}px) scale(${1 / kk})` }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.8 }, { opacity: 1, transform: 'none' }],
      { duration: T.morphMs, delay: T.morph, easing: MORPH });
    // the black lifts off the page
    go(bg, [{ opacity: 1 }, { opacity: 0 }], { duration: 750, delay: T.morph + 60, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' });

    sound(performance.timeOrigin + document.timeline.currentTime);
    Promise.all(run.map(a => a.finished)).catch(() => {}).then(() => {
      bg.remove();
      type.remove();
      root.classList.add('landed');
    });
  }

  return {
    play,
    // until the card has landed, a click or a key is for the opening (it skips ahead)
    get busy() { return run.length > 0 && elapsed() < T.morph + T.morphMs; },
    // skips to the moment it all turns into the card: everything moves on together
    skip() {
      const jump = T.morph - elapsed();
      if (!run.length || jump <= 0) return;
      for (const a of root.getAnimations({ subtree: true })) if (a.currentTime != null) a.currentTime += jump;
      chrome.runtime.sendMessage({ to: 'sound', stop: true }).catch(() => {});
    },
  };
}
