// Over the daily limit: the ring's own flame takes the stage. It comes up as big as the
// overshoot (four sizes, each burning harder than the last), with how far over, and past an
// hour a dry line, then flies home into its ring. One element all the way: the flame leaves
// its spot (an empty one its size keeps the room, so nothing in the ring moves), plays, and
// lands back in it. Transform and opacity only; the flicker always comes to rest exactly as
// the flame lands, so the ring's own flicker takes up from there without a jump.

import { formatDuration } from './core.js';
import { reducedMotion } from './fx.js';

export const OVER_LINES = [
  'Your limit called. It wants to know if you’re okay.',
  'At this point the limit is more of a suggestion.',
  'Bold of you to call that a limit.',
  'The internet will still be here tomorrow. Promise.',
  'Somewhere, a book is quietly gathering dust.',
  'A new personal best. Not the good kind.',
  'Even your browser could use a break.',
  'That “one more video” was a while ago.',
  'Fun fact: the limit was your idea.',
  'Plot twist: the tabs won.',
];

// By how far over: the flame's height (a share of the stage's smaller side, capped), how
// hard and fast it flickers, its embers, its glow, and how long it holds the stage. Past
// two hours it's a wall of fire, taller than the stage. Each holds long enough to read its words
// (the dry line, from an hour, a second more). From an hour the stage's whole edge burns
// too (edge: how deep, a share of its smaller side).
const TIERS = [
  { name: 'small', at: 0, share: 0.24, cap: 120, amp: 1, period: 1100, embers: 0, glow: 0.18, hold: 2000 },
  { name: 'big', at: 30 * 60e3, share: 0.42, cap: 220, amp: 1.7, period: 820, embers: 0, glow: 0.28, hold: 2200 },
  { name: 'huge', at: 60 * 60e3, share: 0.56, cap: 320, amp: 2.4, period: 640, embers: 22, glow: 0.38, hold: 3400, edge: 0.07 },
  { name: 'wall', at: 120 * 60e3, share: 1.3, cap: Infinity, amp: 3.2, period: 520, embers: 48, glow: 0.55, hold: 3800, edge: 0.11 },
];
export function overTier(overMs) {
  return TIERS.reduce((t, x) => (overMs >= x.at ? x : t), TIERS[0]);
}

const GROW = 'cubic-bezier(0.33, 1, 0.68, 1)';    // comes up: an even ease out
const IN = 'cubic-bezier(0.16, 1, 0.3, 1)';       // the words: quick, then a long soft settle
const HOME = 'cubic-bezier(0.65, 0, 0.25, 1)';    // flies home: firm in, long soft landing
// Home, it's back to its own size this far into the flight, and glides the rest: drawn
// shrunk from big, a flame is drawn a hair differently from itself at its size, and the
// switch then happens in flight, not as it lands
const SIZED = 0.78;

// a dry line, never the same twice running
function line() {
  let last = -1;
  try { last = Number(localStorage.getItem('memoir:overLine')); } catch { /* no storage */ }
  let i = Math.floor(Math.random() * OVER_LINES.length);
  if (i === last) i = (i + 1) % OVER_LINES.length;
  try { localStorage.setItem('memoir:overLine', String(i)); } catch { /* no storage */ }
  return OVER_LINES[i];
}

let playing = null;

// keyframes eased one by one, so a flicker turns softly at every value
const soft = (...o) => o.map(([opacity, offset]) => ({ opacity, offset, easing: 'ease-in-out' }));

/**
 * The stage's edge on fire, past an hour (gone with the dim, well before the flame lands,
 * then taken away, so the landing frame has nothing else to redraw). An hour: it's hot, a
 * glow all round that closes in from past the edges and breathes. Two: it burns (burn()).
 */
function edgeFire(stage, { edge, hold }, { vw, vh, short, intro, home, wall }) {
  const D = short * edge;
  const out = intro + hold, total = out + home * 0.6;
  const box = document.createElement('div');
  box.className = 'os-edge';
  box.style.setProperty('--e', `${Math.round(D)}px`);
  box.innerHTML = `<div class="os-edge-in">${wall ? '' : '<i class="os-glow"></i>'}</div>`;
  stage.querySelector('.os-back').after(box);
  const inner = box.firstElementChild;
  box.animate([
    { opacity: 0, easing: 'ease-out' },
    { opacity: 1, offset: (wall ? 380 : 520) / total },
    { opacity: 1, offset: (out - 120) / total, easing: 'ease-in-out' },
    { opacity: 0 },
  ], { duration: total, fill: 'forwards' }).finished.then(() => box.remove(), () => {});

  if (wall) { burn(inner, { vw, vh, D, intro, out, total }); return; }
  inner.animate([{ scale: '1.14' }, { scale: '1' }], { duration: 1100, easing: IN });
  inner.firstElementChild.animate([{ opacity: 1, scale: '1' }, { opacity: 0.55, scale: '1.035' }, { opacity: 1, scale: '1' }],
    { duration: 1700, delay: 900, iterations: Infinity, easing: 'ease-in-out' });
}

/**
 * Two hours over: the stage's edge burns away like paper. Black char eats in from every
 * side (deepest at the bottom, where the wall of fire is) to a ragged rim burning orange
 * to white hot, never the same twice. It creeps in from past the edges as the wall rises,
 * flares as the wall is up, and keeps eating in, slowly, while the words are read; its heat
 * flickers. Drawn once, on two canvases (the char and its rim; the heat, soft, at half the
 * resolution), then only scaled and faded: two layers, whatever the size of the stage.
 */
function burn(inner, { vw, vh, D, intro, out, total }) {
  const O = 0.06;                                   // room past each edge, for the creeping
  const W = vw * (1 + 2 * O), H = vh * (1 + 2 * O), x0 = vw * O, y0 = vh * O, x1 = x0 + vw, y1 = y0 + vh;
  // the stage's edge, its corners rounded, walked all round: each step's spot and the way in
  const R = Math.min(D * 2.2, Math.min(vw, vh) / 2 - 1);
  const arc = (cx, cy, t) => [cx + R * Math.cos(t), cy + R * Math.sin(t), -Math.cos(t), -Math.sin(t)];
  const q = (Math.PI * R) / 2;
  const sides = [
    [vw - 2 * R, t => [x0 + R + t, y0, 0, 1]], [q, t => arc(x1 - R, y0 + R, -Math.PI / 2 + t / R)],
    [vh - 2 * R, t => [x1, y0 + R + t, -1, 0]], [q, t => arc(x1 - R, y1 - R, t / R)],
    [vw - 2 * R, t => [x1 - R - t, y1, 0, -1]], [q, t => arc(x0 + R, y1 - R, Math.PI / 2 + t / R)],
    [vh - 2 * R, t => [x0, y1 - R - t, 1, 0]], [q, t => arc(x0 + R, y0 + R, Math.PI + t / R)],
  ];
  const L = sides.reduce((n, [l]) => n + l, 0), N = Math.round(L / 4);
  // how far it's eaten in: waves of three sizes, each a whole number of times round, so the
  // line closes on itself. The smaller ones ridged (sharp where they reach in), so the edge
  // is ragged, not wavy; the rim's width wanders too, from a hairline to thick
  const waves = (n, len) => Array.from({ length: n }, () => ({ k: Math.max(1, Math.round(L / (len * (0.6 + Math.random() * 0.8)))), p: Math.random() * 2 * Math.PI, a: 0.4 + Math.random() }));
  const wave = ({ k, p }, s) => Math.sin((2 * Math.PI * k * s) / L + p);
  const sum = (ws, s, f = x => x) => ws.reduce((v, w) => v + w.a * f(wave(w, s)), 0) / ws.reduce((n, w) => n + w.a, 0);
  const ridge = x => 1 - 2 * Math.abs(x);
  const big = waves(3, D * 9), mid = waves(4, D * 2.2), fine = waves(5, D * 0.6), rim = waves(3, D * 1.8);
  const A = [], B = [], C = [], E = [];
  let side = 0, from = 0, deepest = 0;
  for (let i = 0; i < N; i++) {
    const s = (i * L) / N;
    while (side < 7 && s - from > sides[side][0]) from += sides[side++][0];
    const [x, y, nx, ny] = sides[side][1](s - from);
    const low = Math.min(1, Math.max(0, ((y - y0) / vh - 0.55) / 0.45));
    const d = D * (0.62 + 0.3 * sum(big, s) + 0.17 * sum(mid, s, ridge) + 0.08 * sum(fine, s, ridge)) * (1 + 0.8 * low * low * (3 - 2 * low));
    const w = D * (0.025 + 0.16 * Math.max(0, sum(rim, s)) ** 1.4);
    deepest = Math.max(deepest, d);
    A.push([x + nx * d, y + ny * d]);                       // where it's burning
    C.push([x + nx * (d - w * 0.4), y + ny * (d - w * 0.4)]); // white hot to here
    B.push([x + nx * (d - w), y + ny * (d - w)]);             // orange to here
    E.push([x + nx * (d - w - D * 0.22), y + ny * (d - w - D * 0.22)]); // scorched to here
  }
  const trace = (g, pts, back = false) => {
    const list = back ? [...pts].reverse() : pts;
    g.moveTo(list[0][0], list[0][1]);
    for (let i = 1; i < list.length; i++) g.lineTo(list[i][0], list[i][1]);
    g.closePath();
  };
  const band = (g, a, b, fill) => {
    g.beginPath();
    g.moveTo(a[0][0], a[0][1]);
    for (const [x, y] of a) g.lineTo(x, y);
    for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i][0], b[i][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  const sheet = res => {
    const c = document.createElement('canvas');
    c.width = Math.round(W * res); c.height = Math.round(H * res);
    Object.assign(c.style, { left: `${-x0}px`, top: `${-y0}px`, width: `${W}px`, height: `${H}px` });
    const g = c.getContext('2d');
    g.scale(res, res);
    return [c, g];
  };

  // the char, scorched red near the rim (fading into it), the rim
  const res = Math.min(devicePixelRatio, 1.5);
  const [char, g] = sheet(res);
  g.beginPath();
  g.rect(0, 0, W, H);
  trace(g, A);
  g.fillStyle = '#070201';
  g.fill('evenodd');
  g.filter = `blur(${Math.max(1.5, D * 0.09 * res)}px)`;
  band(g, B, E, 'rgba(128, 22, 4, 0.75)');
  g.filter = 'none';
  band(g, A, B, '#ff6a1c');
  band(g, A, C, '#ffd88a');
  // its heat: glowing both ways, into the char and onto the page
  const [heat, h] = sheet(0.5);
  h.filter = `blur(${Math.max(2, D * 0.12)}px)`;
  h.lineJoin = 'round';
  for (const [width, colour] of [[D * 1.1, 'rgba(255, 84, 20, 0.42)'], [D * 0.45, 'rgba(255, 150, 60, 0.55)'], [D * 0.14, 'rgba(255, 220, 140, 0.8)']]) {
    h.beginPath();
    trace(h, A);
    h.lineWidth = width;
    h.strokeStyle = colour;
    h.stroke();
  }
  const glow = document.createElement('div');
  glow.className = 'os-heat';
  glow.appendChild(heat);
  inner.append(char, glow);

  // it creeps in from past the edges with the wall (from just out of sight), then on, slowly
  const cx = vw / 2, cy = vh / 2;
  const s0 = Math.min(1.6, 1.04 * Math.max(cx / Math.max(1, cx - deepest), cy / Math.max(1, cy - deepest)));
  inner.animate([
    { scale: `${s0}`, easing: GROW },
    { scale: '1', offset: intro / out, easing: 'ease-in-out' },
    { scale: '0.975' },
  ], { duration: out, fill: 'forwards' });
  // its heat flares as the wall is up, then flickers
  glow.animate([
    { opacity: 0, easing: 'ease-in' },
    { opacity: 0.7, offset: (intro * 0.6) / total, easing: 'ease-in' },
    { opacity: 1, offset: intro / total, easing: 'ease-out' },
    { opacity: 0.72, offset: (intro + 700) / total },
    { opacity: 0.72 },
  ], { duration: total, fill: 'forwards' });
  heat.animate(soft([1, 0], [0.62, 0.16], [0.95, 0.33], [0.55, 0.52], [0.9, 0.7], [0.7, 0.85], [1, 1]),
    { duration: 1100, iterations: Infinity });
}

/**
 * Plays it. flame: the ring's .gr-flame (the ring must show "over"). lifted: the flame is
 * already on screen in its ring (it rises out of it), else it comes up at the middle.
 * Resolves once it's home.
 */
export function playOverShow({ flame, overMs, limitMs, lifted = false }) {
  if (!flame || playing || reducedMotion() || !(overMs > 0) || !flame.getClientRects().length) return Promise.resolve();
  // its own laid-out size (not as drawn: the ring may still be bringing it in, scaled down)
  const cs = getComputedStyle(flame);
  const fw = parseFloat(cs.width), fh = parseFloat(cs.height);
  if (!fw || !fh) return Promise.resolve();
  const tier = overTier(overMs);
  const vw = innerWidth, vh = innerHeight, short = Math.min(vw, vh);
  const wall = tier.name === 'wall';
  // the flame's own shape in its 24-unit box: 21.2 tall, its base 23 down. A wall is taller
  // than the stage, its base just under the bottom edge
  const H = wall ? vh * tier.share : Math.min(short * tier.share, tier.cap);
  const S = H / (fh * (21.2 / 24));
  const cx = vw / 2, cy = wall ? vh * 1.04 - fh * S * (23 / 24 - 0.5) : vh * 0.4;

  // the stage: a dim with a glow behind the flame, the words, the embers
  const stage = document.createElement('div');
  stage.className = 'os';
  stage.dataset.tier = tier.name;
  stage.style.setProperty('--os-cy', `${cy}px`);
  stage.style.setProperty('--os-glow', String(tier.glow));
  const sarcasm = overMs >= 60 * 60e3 ? `<p class="os-line">${line()}</p>` : '';
  stage.innerHTML = `<div class="os-back"></div><div class="os-embers"></div>
    <div class="os-text" role="status"><p class="os-big num">${formatDuration(overMs)} over</p><p class="os-sub">your ${formatDuration(limitMs)} daily limit</p>${sarcasm}</div>`;
  const text = stage.querySelector('.os-text');
  text.style.top = wall ? `${vh * 0.15}px` : `${cy + H / 2 + 14}px`;
  document.body.appendChild(stage);

  // the flame leaves its spot: an empty one its size keeps the room (and says where home is)
  const slot = document.createElement('span');
  slot.className = 'gr-flame-slot';
  slot.setAttribute('aria-hidden', 'true');
  Object.assign(slot.style, {
    display: 'block', flex: 'none', width: cs.width, height: cs.height,
    marginTop: cs.marginTop, marginRight: cs.marginRight, marginBottom: cs.marginBottom, marginLeft: cs.marginLeft,
  });
  flame.before(slot);
  const out = flame.querySelector('.fl-out'), core = flame.querySelector('.fl-in');
  // rising out of its ring, it may be mid-flicker: the show's flicker starts from that shape
  const was = [out, core].map(e => {
    const c = e && lifted ? getComputedStyle(e) : null;
    return c && (c.transform !== 'none' || c.opacity !== '1') ? { transform: c.transform, opacity: c.opacity } : null;
  });
  // (held there until that starts: out of its ring, the ring's flicker stops at once)
  [out, core].forEach((e, i) => { if (e && was[i]) Object.assign(e.style, was[i]); });
  stage.appendChild(flame);
  // where it was: its spot, now the flame has left it (with both in the ring, they'd share it)
  const r = slot.getBoundingClientRect();
  // its own size (none of the ring's resting look: that scales it down), laid out at the
  // middle of the stage, on whole pixels; the show is all
  // transform. Its spot is drawn on whole pixels too (Chrome rounds where a resting element
  // goes), so it flies to exactly there: landing, nothing moves
  const snap = v => Math.round(v * devicePixelRatio) / devicePixelRatio;
  const left = snap(cx - fw / 2), top = snap(cy - fh / 2);
  Object.assign(flame.style, {
    position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${fw}px`, height: `${fh}px`,
    margin: '0', opacity: '1', transition: 'none', transform: 'none', transformOrigin: '50% 50%',
  });
  const atSlot = `${snap(r.left) - left}px ${snap(r.top) - top}px`;

  const intro = wall ? 950 : 800, home = wall ? 1150 : 950;
  const total = intro + tier.hold + home;

  // up: out of the ring, from the middle, or (a wall) from below the stage. Moved and sized
  // apart (translate, scale), so the way home can size it on its own clock
  const from = lifted ? { translate: atSlot, scale: '1' } : wall ? { translate: `0px ${vh * 0.9}px`, scale: `${S}` } : { translate: '0px 0px', scale: `${S * 0.4}` };
  const show = flame.animate([
    { ...from, easing: lifted ? 'cubic-bezier(0.45, 0, 0.2, 1)' : GROW },
    { translate: '0px 0px', scale: `${S}`, offset: intro / (intro + tier.hold) },
    { translate: '0px 0px', scale: `${S}` },
  ], { duration: intro + tier.hold, fill: 'forwards' });
  if (!lifted && !wall) flame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: intro * 0.5, easing: 'ease-out', fill: 'both' });
  // and until those first draw (a new animation waits a frame to start), it's already there
  // as they begin: never a frame of it at the middle, its own size
  Object.assign(flame.style, { translate: from.translate, scale: from.scale, opacity: !lifted && !wall ? '0' : '1' });

  // the flicker, harder the further over, always at rest again exactly as it lands
  const flick = [];
  const a = tier.amp;
  const ease = was.some(Boolean) ? 220 : 0;
  [out, core].forEach((e, i) => {
    if (e && was[i]) flick.push(e.animate([was[i], { transform: 'none', opacity: 1 }], { duration: ease, easing: 'ease-out', fill: 'forwards' }));
  });
  const n = Math.max(2, Math.round((total - ease) / tier.period));
  if (out) flick.push(out.animate([
    { transform: 'none' },
    { transform: `scale(${1 - 0.03 * a}, ${1 + 0.05 * a}) skewX(${-2.5 * a}deg)`, offset: 0.3 },
    { transform: `scale(${1 + 0.025 * a}, ${1 - 0.035 * a}) skewX(${1.8 * a}deg)`, offset: 0.65 },
    { transform: 'none' },
  ], { duration: (total - ease) / n, delay: ease, iterations: n, easing: 'ease-in-out' }));
  if (core) flick.push(core.animate([
    { transform: 'none', opacity: 1 },
    { transform: `scale(${1 - 0.07 * a}, ${1 + 0.09 * a})`, opacity: 0.82, offset: 0.45 },
    { transform: `scale(${1 + 0.05 * a}, ${1 - 0.05 * a})`, opacity: 1, offset: 0.75 },
    { transform: 'none', opacity: 1 },
  ], { duration: (total - ease) / (n * 2), delay: ease, iterations: n * 2, easing: 'ease-in-out' }));

  // the dim (and its glow) comes up almost at once, so the flame and its words are seen
  // straight away; it goes as the flame flies home
  const DIM = 220;
  const back = stage.querySelector('.os-back');
  // (each layer of the stage is taken away once it's gone, so as the flame lands it's the
  // only thing left to redraw)
  const backEnd = intro + tier.hold + home * 0.7;
  back.animate([{ opacity: 0, easing: 'ease-out' }, { opacity: 1, offset: DIM / backEnd }, { opacity: 1, offset: (intro + tier.hold) / backEnd }, { opacity: 0 }],
    { duration: backEnd, fill: 'forwards', easing: 'ease-in-out' }).finished.then(() => back.remove(), () => {});
  text.animate([
    { opacity: 0, transform: 'translate(-50%, 10px)' },
    { opacity: 0, transform: 'translate(-50%, 10px)', offset: DIM / total, easing: IN },
    { opacity: 1, transform: 'translate(-50%, 0)', offset: (DIM + 600) / total },
    { opacity: 1, transform: 'translate(-50%, 0)', offset: (intro + tier.hold - 260) / total, easing: 'ease-in' },
    { opacity: 0, transform: 'translate(-50%, -6px)', offset: (intro + tier.hold - 40) / total },
    { opacity: 0, transform: 'translate(-50%, -6px)' },
  ], { duration: total, fill: 'forwards' });

  if (tier.edge) edgeFire(stage, tier, { vw, vh, short, intro, home, wall });

  // embers, rising off it while it holds the stage (gone before it flies)
  const embers = stage.querySelector('.os-embers');
  for (let i = 0; i < tier.embers; i++) {
    const e = document.createElement('i');
    const spread = wall ? vw * 0.9 : H * 0.55;
    const x = cx + (Math.random() - 0.5) * spread;
    const y = wall ? vh * (0.7 + Math.random() * 0.28) : cy + H * (0.1 + Math.random() * 0.25);
    const size = 4 + Math.random() * 5;
    Object.assign(e.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` });
    embers.appendChild(e);
    const dur = 1100 + Math.random() * 900;
    const delay = intro * 0.4 + Math.random() * Math.max(0, intro * 0.6 + tier.hold - dur);
    const rise = (wall ? vh * 0.55 : H * 0.9) * (0.6 + Math.random() * 0.4);
    const drift = (Math.random() - 0.5) * (wall ? 120 : 50);
    e.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${drift}px), calc(-50% - ${rise}px)) scale(0.3)`, opacity: 0 },
    ], { duration: dur, delay, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', fill: 'both' });
  }

  playing = new Promise(resolve => {
    show.finished.then(() => {
      // home: to where its spot is now (measured now, so an entrance that moved the card
      // since doesn't matter), its own size again
      text.remove();
      embers.remove();
      const t = slot.getBoundingClientRect();
      const dx = snap(t.left) - left, dy = snap(t.top) - top;
      // (these take over from the show's last values, which hold until they start)
      flame.animate([{ scale: `${S}` }, { scale: '1' }], { duration: home * SIZED, easing: 'cubic-bezier(0.6, 0, 0.3, 1)', fill: 'forwards' });
      const fly = flame.animate([{ translate: '0px 0px' }, { translate: `${dx}px ${dy}px` }], { duration: home, easing: HOME, fill: 'forwards' });
      return fly.finished;
    }).catch(() => {}).then(() => {
      // landed: back into its spot, looking just as it did (the flicker at rest)
      for (const f of flick) f.cancel();
      for (const e of [out, core]) if (e) { e.style.removeProperty('transform'); e.style.removeProperty('opacity'); }
      slot.replaceWith(flame);
      flame.removeAttribute('style');
      for (const an of flame.getAnimations()) an.cancel();
      stage.remove();
      playing = null;
      resolve();
    });
  });
  return playing;
}
