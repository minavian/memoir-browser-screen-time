// The Memoir clock on its black disc, built from parts so its entrance runs on the
// compositor: the disc pops in, the ring turns into place, the hands sweep from 9:00
// round to 10:10, and the knob clicks onto the ring's seam.
// A live clock (the report's header and empty card) shows the time instead: its hands
// sweep round to now and keep it, and the knob goes round the ring once a minute with
// the ring's fade turning behind it. All of it is compositor animation, kept in step
// with the real clock once a minute and whenever the page comes back into view.

import { reducedMotion, EASE_OUT, POP } from './fx.js';

export const LOGO = '<span class="logo" aria-hidden="true"><span class="lg-clock"><i class="lg-ring"></i><i class="lg-sec"><i class="lg-knob"></i></i><i class="lg-min"></i><i class="lg-hour"></i></span></span>';

// slow off the mark, a long settle onto 10:10 (or now)
const SWEEP = 'cubic-bezier(0.45, 0, 0.1, 1)';

// the hands' angles for a moment, in the rotation their bars need (a bar points at 3)
function angles(now) {
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  return { min: m * 6 - 90, hour: h * 30 - 90, sec: s * 6 };
}

// live clocks, and their running motion (so they can be set right again)
const live = new Map();

// sets a live clock's hands to now and starts them going: the minute and hour hands at
// their own pace, the knob and the ring's fade once round a minute
function run(logo, now = new Date()) {
  live.get(logo)?.forEach(a => a.cancel());
  const part = name => logo.querySelector(`.lg-${name}`);
  const a = angles(now);
  part('min').style.transform = `rotate(${a.min}deg)`;
  part('hour').style.transform = `rotate(${a.hour}deg)`;
  if (reducedMotion()) {
    live.set(logo, []);
    return;
  }
  const turn = (el, from, ms) => el.animate([{ rotate: `${from}deg` }, { rotate: `${from + 360}deg` }], { duration: ms, iterations: Infinity });
  live.set(logo, [
    turn(part('min'), 0, 3600_000),
    turn(part('hour'), 0, 43200_000),
    turn(part('sec'), a.sec, 60_000),
    turn(part('ring'), a.sec, 60_000),
  ]);
}

let watching = false;
function watch() {
  if (watching) return;
  watching = true;
  const again = () => {
    for (const logo of live.keys()) {
      if (logo.isConnected) run(logo);
      else live.delete(logo);
    }
  };
  setInterval(again, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) again(); });
}

/**
 * Sets a clock that shows 10:10 going with the time, with no jump: its hands, and the knob
 * with the ring's fade, sweep on clockwise from where they are round to now, then keep it
 * as a live clock does (the welcome's clock on its way home to the header).
 */
export function goLive(logo, { delay = 0, duration = 900 } = {}) {
  if (!logo) return;
  const now = new Date();
  run(logo, now);
  watch();
  if (reducedMotion()) return;
  const a = angles(now);
  const part = name => logo.querySelector(`.lg-${name}`);
  // each starts where it is (the live angle plus this) and comes round to the live angle
  const back = deg => -((((-deg) % 360) + 360) % 360);
  const sweep = (el, by) => el.animate([{ rotate: `${by}deg` }, { rotate: '0deg' }],
    { duration, delay, easing: SWEEP, composite: 'add', fill: 'backwards' });
  sweep(part('min'), back(-30 - a.min));
  sweep(part('hour'), back(215 - a.hour));
  sweep(part('sec'), back(-a.sec));
  sweep(part('ring'), back(-a.sec));
}

/** Drops every animation on a clock but its live motion (looks held by an entrance or a flight). */
export function settleLogo(logo) {
  const keep = new Set(live.get(logo) || []);
  for (const a of logo.getAnimations({ subtree: true })) if (!keep.has(a)) a.cancel();
}

/**
 * Plays the clock's entrance. A logo marked `hold` stays hidden until this runs.
 * delay: ms before it starts; pace: a multiplier on its length (under 1 is quicker);
 * face: false leaves the disc out (its caller brings it in);
 * fromO: the ring is already there (in the welcome's opening it was MEMOIR's O, and its
 *   caller thins it): its fade only turns a little into place, and the knob settles
 *   without a bounce;
 * live: it shows the time (see above) instead of 10:10.
 */
export function playLogo(logo, { delay = 0, pace = 1, face = true, fromO = false, live: isLive = false } = {}) {
  if (!logo) return Promise.resolve();
  logo.classList.remove('hold');
  const now = new Date();
  if (isLive) {
    run(logo, now);
    watch();
  }
  if (reducedMotion() || !logo.getClientRects().length) return Promise.resolve();
  const t = ms => ms * pace;
  const part = name => logo.querySelector(`.lg-${name}`);
  // where the hands come to rest: 10:10 (minute -30deg, hour 215deg), or now; they
  // sweep there from a turn and a sixth back (minute) and a little back (hour)
  const at = isLive ? angles(now) : { min: -30, hour: 215 };
  const hand = to => [{ opacity: 0, transform: `rotate(${to - 420}deg)` }, { opacity: 1, offset: 0.12 }, { opacity: 1, transform: `rotate(${to}deg)` }];
  const handH = to => [{ opacity: 0, transform: `rotate(${to - 35}deg)` }, { opacity: 1, offset: 0.12 }, { opacity: 1, transform: `rotate(${to}deg)` }];
  const sweep = { duration: t(1500), delay: delay + t(160), easing: SWEEP, fill: 'backwards' };
  // the ring grows in as its fade turns round into place (from an O, it only turns);
  // the knob clicks onto its seam (or settles there)
  const turn = fromO
    ? { duration: t(1300), delay: delay + t(60), easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'backwards' }
    : { duration: t(1150), delay: delay + t(60), easing: EASE_OUT, fill: 'backwards' };
  const knobIn = fromO
    ? { duration: t(600), delay: delay + t(820), easing: EASE_OUT, fill: 'backwards' }
    : { duration: t(520), delay: delay + t(880), easing: POP, fill: 'backwards' };
  return Promise.all([
    face && logo.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }],
      { duration: t(560), delay, easing: POP, fill: 'backwards', pseudoElement: '::before' }).finished,
    !fromO && part('ring').animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, offset: 0.4 }, { opacity: 1, transform: 'none' }], turn).finished,
    part('ring').animate([{ rotate: fromO ? '-40deg' : '-160deg' }, { rotate: '0deg' }], { ...turn, pseudoElement: '::before' }).finished,
    part('min').animate(hand(at.min), sweep).finished,
    part('hour').animate(handH(at.hour), sweep).finished,
    part('knob').animate([{ opacity: 0, transform: fromO ? 'scale(0.6)' : 'scale(0)' }, { opacity: 1, transform: 'none' }], knobIn).finished,
  ]).catch(() => {});
}
