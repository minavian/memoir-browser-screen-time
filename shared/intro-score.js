// The welcome's opening as a plan its picture and its sound both play from: where and
// when the grain blooms up, and when the words, the clock and the card arrive (ms from
// the start). The sound is synthesised here with Web Audio, so there are no audio files:
// a soft crackle for each bloom over a low hiss, a swell under the name, the clock
// ticking round and its knob clicking in, a breath as it all becomes the card, a chime.

export const TIMES = {
  bloomsFrom: 120,
  kicker: 1950,   // WELCOME TO, letter by letter, left to right
  word: 2250,     // MEMOIR, the same
  light: 2050,    // the light behind the word starts drifting in
  clock: 3800,    // the clock takes the O's place and sets itself (shared/logo.js)
  morph: 5000,    // everything turns into the card
  morphMs: 950,
  end: 6000,
};
// shared/logo.js's timing (heavy ring, as here): the hands sweep after 160 ms for 1500 ms;
// the knob pops at 320 ms
const SWEEP = { delay: 160, ms: 1500, ease: [0.45, 0, 0.1, 1] };
const KNOB = 320;

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The grain blooms: the same every time, so the sound can follow them.
export function plan() {
  const r = rng(19);
  const blooms = [];
  for (let i = 0; i < 9; i++) {
    blooms.push({
      at: TIMES.bloomsFrom + i * 245 + (r() - 0.5) * 110,
      x: 0.1 + r() * 0.8, y: 0.12 + r() * 0.76,   // where, as a share of the screen
      size: 26 + r() * 24,                        // vmin
      life: 3000 + r() * 900,
      dx: (r() - 0.5) * 9, dy: (r() - 0.5) * 7,   // vmin over its whole life: a slow drift
      turn: (r() - 0.5) * 16,
      freq: 800 + r() * 1800,
    });
  }
  return { blooms };
}

function bezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return x => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (at(x1, x2, m) < x) lo = m; else hi = m; }
    return at(y1, y2, (lo + hi) / 2);
  };
}

// the times (ms) the minute hand passes each 60 degrees of its 420-degree sweep
function ticks() {
  const ease = bezier(...SWEEP.ease);
  const out = [];
  let k = 1;
  for (let i = 0; i <= 1000 && k <= 7; i++) {
    if (ease(i / 1000) >= k / 7) { out.push(TIMES.clock + SWEEP.delay + (SWEEP.ms * i) / 1000); k++; }
  }
  return out;
}

/**
 * Schedules the whole score on ctx into out, with the opening's start at t0 (seconds,
 * ctx time). Anything due before `from` ms (already played on screen) is left out.
 */
export function score(ctx, out, t0, from = 0) {
  const r = rng(5);
  const noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 2), ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  const at = ms => t0 + ms / 1000;
  const due = ms => ms >= from;

  // a gain that rises to peak in `a` s and dies away over `d` s
  const env = (t, peak, a, dd) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dd);
    return g;
  };
  const hiss = (t, len) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.start(t, r() * 1.5);
    s.stop(t + len);
    return s;
  };
  const filter = (type, f, q = 0.8) => {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };
  const tone = (t, type, f0, f1, len) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  };
  const panned = p => { const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(out); return n; };

  // a low hiss under the grain, until the card arrives
  {
    const t = at(Math.max(0, from)), end = at(TIMES.morph + 700);
    if (end > t) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, Math.max(t + 0.05, at(1500)));
      g.gain.setValueAtTime(0.022, at(TIMES.morph));
      g.gain.linearRampToValueAtTime(0.0001, end);
      hiss(t, end - t + 0.1).connect(filter('lowpass', 900, 0.5)).connect(g).connect(out);
    }
  }

  // each bloom: a soft crackle where it appears, with a little body under it
  for (const b of plan().blooms) {
    if (!due(b.at)) continue;
    const t = at(b.at), side = panned((b.x - 0.5) * 1.4);
    const bp = filter('bandpass', b.freq, 1.1);
    bp.frequency.setValueAtTime(b.freq, t);
    bp.frequency.exponentialRampToValueAtTime(b.freq * 0.5, t + 0.6);
    hiss(t, 0.8).connect(bp).connect(env(t, 0.15, 0.012, 0.6)).connect(side);
    tone(t, 'sine', 150, 50, 0.32).connect(env(t, 0.08, 0.01, 0.34)).connect(side);
  }

  // the name: a swell that opens up, a low bloom, a quiet shimmer on top
  if (due(TIMES.word)) {
    const t = at(TIMES.word);
    const lp = filter('lowpass', 200, 0.7);
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.exponentialRampToValueAtTime(4200, t + 1.2);
    hiss(t, 2.6).connect(lp).connect(env(t, 0.07, 0.9, 1.5)).connect(out);
    tone(t, 'sine', 55, 55, 2.4).connect(env(t, 0.14, 0.55, 1.7)).connect(out);
    [1318.5, 1975.5, 2637].forEach((f, i) => tone(t + 0.25 + i * 0.12, 'sine', f, f, 2.4).connect(env(t + 0.25 + i * 0.12, 0.008, 0.8, 1.4)).connect(panned((i - 1) * 0.35)));
  }

  // the clock: a tick each time the minute hand passes 60 degrees, then the knob clicks in
  ticks().forEach((ms, i) => {
    if (!due(ms)) return;
    const t = at(ms), side = panned(i % 2 ? 0.12 : -0.12);
    hiss(t, 0.05).connect(filter('highpass', 3200, 0.7)).connect(env(t, 0.05, 0.002, 0.03)).connect(side);
    tone(t, 'sine', 2300, 2300, 0.05).connect(env(t, 0.018, 0.002, 0.04)).connect(side);
  });
  if (due(TIMES.clock + KNOB + 120)) {
    const t = at(TIMES.clock + KNOB + 120);
    hiss(t, 0.08).connect(filter('bandpass', 1500, 1.4)).connect(env(t, 0.14, 0.002, 0.05)).connect(out);
    tone(t, 'sine', 700, 420, 0.09).connect(env(t, 0.07, 0.003, 0.09)).connect(out);
  }

  // into the card: a breath, then a soft two-note chime as it lands
  if (due(TIMES.morph)) {
    const t = at(TIMES.morph);
    const bp = filter('bandpass', 2400, 0.6);
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(450, t + 0.9);
    hiss(t, 1.2).connect(bp).connect(env(t, 0.05, 0.3, 0.7)).connect(out);
  }
  [[659.25, 0, 0.022], [1318.5, 0, 0.032], [1975.5, 0.09, 0.022]].forEach(([f, dt, peak]) => {
    const ms = TIMES.morph + 650 + dt * 1000;
    if (!due(ms)) return;
    tone(at(ms), 'sine', f, f, 2).connect(env(at(ms), peak, 0.01, 1.8)).connect(out);
  });
}

// the master chain: a little headroom and a gentle limiter
export function master(ctx) {
  const g = ctx.createGain();
  g.gain.value = 1.8;
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = -14;
  c.ratio.value = 4;
  g.connect(c).connect(ctx.destination);
  return g;
}

// the whole score, rendered (for recordings of the opening)
export function renderIntroSound(rate = 48000) {
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * 8.5), rate);
  score(ctx, master(ctx), 0);
  return ctx.startRendering();
}
