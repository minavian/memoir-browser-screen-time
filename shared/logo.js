// The Memoir clock on its black disc, built from parts so its entrance runs on the
// compositor: the disc pops in, the ring turns into place, the hands sweep from 9:00
// round to 10:10, and the knob clicks onto the ring's seam.

import { reducedMotion, EASE_OUT, POP } from './fx.js';

export const LOGO = '<span class="logo" aria-hidden="true"><span class="lg-clock"><i class="lg-ring"></i><i class="lg-knob"></i><i class="lg-min"></i><i class="lg-hour"></i></span></span>';

// slow off the mark, a long settle onto 10:10
const SWEEP = 'cubic-bezier(0.45, 0, 0.1, 1)';

/**
 * Plays the clock's entrance. A logo marked `hold` stays hidden until this runs.
 * delay: ms before it starts; pace: a multiplier on its length (under 1 is quicker);
 * face: false leaves the disc out (its caller brings it in).
 */
export function playLogo(logo, { delay = 0, pace = 1, face = true } = {}) {
  if (!logo) return Promise.resolve();
  logo.classList.remove('hold');
  if (reducedMotion() || !logo.getClientRects().length) return Promise.resolve();
  const t = ms => ms * pace;
  const part = name => logo.querySelector(`.lg-${name}`);
  // the hands, at rest: minute -30deg (the 2), hour 215deg (just past the 10)
  const hand = (from, to) => [{ opacity: 0, transform: `rotate(${from}deg)` }, { opacity: 1, offset: 0.12 }, { opacity: 1, transform: `rotate(${to}deg)` }];
  const sweep = { duration: t(1500), delay: delay + t(160), easing: SWEEP, fill: 'backwards' };
  return Promise.all([
    face && logo.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }],
      { duration: t(560), delay, easing: POP, fill: 'backwards', pseudoElement: '::before' }).finished,
    // the band turns; the knob's hole stays put at 12, a slot the knob clicks into
    part('ring').animate([{ opacity: 0, transform: 'rotate(-160deg) scale(0.8)' }, { opacity: 1, offset: 0.4 }, { opacity: 1, transform: 'none' }],
      { duration: t(1150), delay: delay + t(60), easing: EASE_OUT, fill: 'backwards', pseudoElement: '::before' }).finished,
    part('min').animate(hand(-450, -30), sweep).finished,
    part('hour').animate(hand(180, 215), sweep).finished,
    part('knob').animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'none' }],
      { duration: t(520), delay: delay + t(880), easing: POP, fill: 'backwards' }).finished,
  ]).catch(() => {});
}
