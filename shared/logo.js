// The Memoir clock on its black disc, built from parts so its entrance runs on the
// compositor: the disc pops in, the ring turns into place, the hands sweep from 9:00
// round to 10:10, and the knob clicks onto the ring's seam.

import { reducedMotion, EASE_OUT, POP } from './fx.js';

export const LOGO = '<span class="logo" aria-hidden="true"><span class="lg-clock"><i class="lg-ring"></i><i class="lg-knob"></i><i class="lg-min"></i><i class="lg-hour"></i></span></span>';

// slow off the mark, a long settle onto 10:10
const SWEEP = 'cubic-bezier(0.45, 0, 0.1, 1)';
// the ring's inner edge at rest, as a share of its outer radius (59 of 76, recap.css)
const RING_IN = 59 / 76;

/**
 * Plays the clock's entrance. A logo marked `hold` stays hidden until this runs.
 * delay: ms before it starts; pace: a multiplier on its length (under 1 is quicker);
 * face: false leaves the disc out (its caller brings it in);
 * thick: the ring starts this heavy instead (its inner edge as a share of its outer
 *   radius), say to stand in for a heavy O, and slowly thins back; the hands start small
 *   inside it and grow with it, and the knob lands early, over the ring's seam. All of
 *   it is transform and opacity: the thinning is the ring's holed disc scaling up.
 */
export function playLogo(logo, { delay = 0, pace = 1, face = true, thick = null } = {}) {
  if (!logo) return Promise.resolve();
  logo.classList.remove('hold');
  if (reducedMotion() || !logo.getClientRects().length) return Promise.resolve();
  const t = ms => ms * pace;
  const part = name => logo.querySelector(`.lg-${name}`);
  const ring = part('ring');
  // the hands, at rest: minute -30deg (the 2), hour 215deg (just past the 10)
  const hand = (from, to) => [{ opacity: 0, transform: `rotate(${from}deg)` }, { opacity: 1, offset: 0.12 }, { opacity: 1, transform: `rotate(${to}deg)` }];
  const sweep = { duration: t(1500), delay: delay + t(160), easing: SWEEP, fill: 'backwards' };
  const anims = [
    face && logo.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }],
      { duration: t(560), delay, easing: POP, fill: 'backwards', pseudoElement: '::before' }),
    part('min').animate(hand(-450, -30), sweep),
    part('hour').animate(hand(180, 215), sweep),
    part('knob').animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'none' }],
      { duration: t(520), delay: delay + t(thick == null ? 880 : 320), easing: POP, fill: 'backwards' }),
  ];
  if (thick == null) {
    // the ring grows in as its fade turns round into place
    const turn = { duration: t(1150), delay: delay + t(60), easing: EASE_OUT, fill: 'backwards' };
    anims.push(
      ring.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, offset: 0.4 }, { opacity: 1, transform: 'none' }], turn),
      ring.animate([{ rotate: '-160deg' }, { rotate: '0deg' }], { ...turn, pseudoElement: '::before' }),
    );
  } else {
    // heavy at first, then slowly back to its own weight; the hands grow to fit
    const thin = { duration: t(1900), delay: delay + t(500), easing: 'cubic-bezier(0.35, 0, 0.2, 1)', fill: 'backwards' };
    const small = thick / RING_IN;
    logo.classList.add('thick');   // the ring built to thin by scaling, until it's thin
    const thinning = ring.animate([{ scale: small }, { scale: 1 }], { ...thin, pseudoElement: '::before' });
    thinning.finished.then(() => logo.classList.remove('thick'), () => logo.classList.remove('thick'));
    anims.push(
      ring.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t(300), delay, fill: 'backwards' }),
      ring.animate([{ rotate: '-70deg' }, { rotate: '0deg' }], { duration: t(1500), delay, easing: EASE_OUT, fill: 'backwards', pseudoElement: '::before' }),
      thinning,
      part('min').animate([{ scale: small }, { scale: 1 }], thin),
      part('hour').animate([{ scale: small }, { scale: 1 }], thin),
    );
  }
  return Promise.all(anims.filter(Boolean).map(a => a.finished)).catch(() => {});
}
