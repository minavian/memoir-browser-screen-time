// First run: a welcome card before the tour, on the same dim the tour uses. It
// covers the report while the report gets ready, then plays in: the clock pops up
// and sets itself to 10:10, the name rises letter by letter, the rest follows in a
// cascade. On the way out the clock flies into the header's logo, blurring as it
// goes, and the header's clock plays its own entrance as it lands. Heading for the
// tour, the card itself reshapes into the tour's first card and the two dims swap in
// the same frame, so there's no seam.

import { reducedMotion, morph, dropShell, EASE_OUT, EASE_IN_OUT } from './shared/fx.js';
import { LOGO, playLogo } from './shared/logo.js';
import { createIntro, TIMES } from './welcome-intro.js';

// the card reshapes from rest and settles softly (it's still when the words have gone)
const RESHAPE = 'cubic-bezier(0.45, 0, 0.15, 1)';

const PUZZLE = '<svg class="wel-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 2.5a1.6 1.6 0 0 1 3.2 0V4h2.4c.4 0 .7.3.7.7v2.4h-1.1a1.6 1.6 0 0 0 0 3.2h1.1v2.4c0 .4-.3.7-.7.7H9.4v-1.1a1.6 1.6 0 0 0-3.2 0v1.1H3.8c-.4 0-.7-.3-.7-.7v-2.4h1.1a1.6 1.6 0 0 0 0-3.2H3.1V4.7c0-.4.3-.7.7-.7h2.4V2.5Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const PIN = '<svg class="wel-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.8 2.2 13.8 6.2 12.4 6.6 10.3 8.7 10.6 11.6 9.6 12.6 7 10 3.6 13.4M6 9 3.4 6.4 4.4 5.4 7.3 5.7 9.4 3.6 9.8 2.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Resolves once the page has drawn three quick frames in a row (or after 400 ms):
// heavy setup is done, so an animation started now won't stutter.
function calm() {
  return new Promise(resolve => {
    const t0 = performance.now();
    let last = t0;
    let quick = 0;
    const tick = now => {
      quick = now - last < 20 ? quick + 1 : 0;
      last = now;
      if (quick >= 3 || now - t0 > 400) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Puts the welcome screen up straight away (its dim only), so nothing flashes
 * behind it. Call play() once the page underneath is ready.
 */
export function createWelcome() {
  const root = document.createElement('div');
  root.className = 'wel';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'wel-title');
  root.setAttribute('aria-describedby', 'wel-sub');
  root.innerHTML = `
    <div class="wel-dim"></div>
    <div class="wel-pin" aria-hidden="true">
      <svg class="wel-arrow" viewBox="0 0 24 56"><path d="M12 52V5M4.5 12.5 12 5l7.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <p class="wel-pin-card"><b>Keep it in reach</b><span>Click ${PUZZLE} in your toolbar, then ${PIN} next to <span class="wordmark wm-in">Memoir</span>.</span></p>
    </div>
    <div class="wel-card">
      <div class="wel-mark">${LOGO}</div>
      <p class="wel-kicker wel-in" style="--d:180">Welcome to</p>
      <h1 class="wel-title" id="wel-title"><span class="wordmark" style="--d:260">Memoir</span></h1>
      <p class="wel-tagline wel-in" style="--d:600">Browser Screen Time</p>
      <p class="wel-sub wel-in" id="wel-sub" style="--d:700">This extension tracks your browsing time and summarizes it.</p>
      <p class="wel-ask wel-in" style="--d:860">Do you want to go through a tutorial before we start?</p>
      <div class="wel-actions wel-in" style="--d:940">
        <button class="btn btn-primary btn-lg wel-go" type="button">Take the tour</button>
        <button class="btn btn-secondary btn-lg wel-skip" type="button">Skip for now</button>
      </div>
      <p class="wel-private wel-in" style="--d:1080"><svg><use href="#i-private"/></svg>Everything stays in this browser. Nothing is ever sent anywhere.</p>
      <p class="wel-by wel-in" style="--d:1200">Made by Mina Vian</p>
    </div>`;
  document.body.appendChild(root);
  // the opening (welcome-intro.js): its black goes up now, before the page draws anything
  const intro = reducedMotion() ? null : createIntro(root);

  /**
   * Plays the welcome in, waits for a choice, then leaves.
   * markTarget: the header logo the clock flies into (held hidden until it lands).
   * onShown(): called just after it starts playing in: fill the page in behind the dim
   *   then. Only compositor animations run here, so they don't stutter, and the page's
   *   follow-up work is done long before the card has to reshape.
   * onLeave(choice): called as it starts leaving, with 'tour' or 'skip'.
   * onHanded(): for 'tour', called once the card has become the tour's card (or the tour
   *   didn't come): render the page there, so its first render never runs during the reshape.
   * Resolves with { choice, handoff }. For 'tour' that's as soon as the tour can take
   * over: call handoff(tourCard) once its first card is placed, and the welcome card
   * becomes it. For 'skip' it's once everything is gone.
   */
  function play({ markTarget = null, onShown = () => {}, onLeave = () => {}, onHanded = () => {} } = {}) {
    return new Promise(resolve => {
      const go = root.querySelector('.wel-go');
      const skip = root.querySelector('.wel-skip');
      const card = root.querySelector('.wel-card');
      const mark = root.querySelector('.wel-mark');
      let leaving = false;

      requestAnimationFrame(() => requestAnimationFrame(async () => {
        // with the opening, the card's own entrance waits for it (--intro, recap.css)
        if (intro) await intro.play({ card, mark });
        root.classList.add('on');
        if (!intro) playLogo(mark.querySelector('.logo'), { delay: 120 });
        setTimeout(() => { if (!leaving) go.focus({ preventScroll: true }); }, reducedMotion() ? 0 : (intro ? TIMES.morph : 0) + 1300);
        setTimeout(() => { if (!leaving) onShown(); }, reducedMotion() ? 0 : 120);
      }));

      // during the opening, clicks and keys wait: nothing unseen gets pressed
      const hold = e => {
        if (!intro?.busy) return;
        e.preventDefault();
        e.stopPropagation();
      };
      root.addEventListener('pointerdown', hold, true);
      root.addEventListener('click', hold, true);

      root.addEventListener('keydown', e => {
        e.stopPropagation();
        if (intro?.busy) { e.preventDefault(); return; }
        if (e.key === 'Escape') { e.preventDefault(); leave('skip'); }
        else if (e.key === 'Tab') {
          e.preventDefault();
          (document.activeElement === go ? skip : go).focus();
        }
      });
      go.addEventListener('click', () => leave('tour'));
      skip.addEventListener('click', () => leave('skip'));

      // the clock flies into the logo in the header, blurring away as that one sets itself
      function flyMark() {
        const from = mark.getBoundingClientRect();
        const to = markTarget && markTarget.getClientRects().length ? markTarget.getBoundingClientRect() : null;
        mark.classList.add('flying');
        if (!to || !to.width || !from.width) {
          playLogo(markTarget);
          return mark.animate([{ opacity: 1, transform: 'none', filter: 'blur(0px)' }, { opacity: 0, transform: 'scale(0.7)', filter: 'blur(4px)' }],
            { duration: 420, delay: 80, easing: EASE_OUT, fill: 'forwards' }).finished;
        }
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const s = to.width / from.width;
        playLogo(markTarget, { delay: 120 + 950 * 0.45, pace: 0.8 });
        return mark.animate([
          { transform: 'none', filter: 'blur(0px)', opacity: 1 },
          { transform: `translate(${dx * 0.35}px, ${dy * 0.5}px) scale(${(1 + s) / 1.6})`, filter: 'blur(0.5px)', opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, filter: 'blur(6px)', opacity: 0 },
        ], { duration: 950, delay: 120, easing: EASE_IN_OUT, fill: 'forwards' }).finished;
      }

      function leave(choice) {
        if (leaving) return;
        leaving = true;
        go.disabled = true;
        skip.disabled = true;
        root.classList.add('leaving');
        const ready = Promise.resolve(onLeave(choice)).catch(() => {});
        let handedOver = false;
        const handed = () => { if (!handedOver) { handedOver = true; onHanded(); } };
        if (reducedMotion()) {
          playLogo(markTarget);
          ready.then(() => { root.remove(); resolve({ choice, handoff: handed }); if (choice === 'tour') setTimeout(handed, 0); });
          return;
        }

        // the words drift up and away, last ones first (transform and opacity only)
        const parts = [...card.querySelectorAll(':scope > :not(.wel-mark)'), root.querySelector('.wel-pin')].reverse();
        parts.forEach((el, i) => {
          el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px) scale(0.98)' }],
            { duration: 320, delay: i * 25, easing: EASE_OUT, fill: 'forwards' });
        });
        const flown = flyMark().catch(() => {});
        const wordsGone = new Promise(r => setTimeout(r, 320 + parts.length * 25));

        if (choice === 'skip') {
          root.classList.add('closing');
          root.querySelector('.wel-dim').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, delay: 220, easing: EASE_IN_OUT, fill: 'forwards' });
          Promise.all([flown, new Promise(r => setTimeout(r, 900))]).then(() => { root.remove(); resolve({ choice, handoff: () => {} }); });
          return;
        }

        // Heading for the tour: it's set up straight away, under this card, while the
        // words fade (nothing on screen needs the main thread then). Its dim replaces
        // this one at once (they're the same); once the words are gone and the page is
        // calm, the card reshapes into the tour's first card.
        let started = false;
        const handoff = tourCard => {
          if (started || !root.isConnected) return;
          started = true;
          clearTimeout(fallback);
          root.querySelector('.wel-dim').remove();
          Promise.all([wordsGone, calm()]).then(() => {
            const surface = getComputedStyle(card, '::before');
            const m = morph({
              from: card.getBoundingClientRect(), to: tourCard.getBoundingClientRect(), fromRadius: parseFloat(surface.borderTopLeftRadius) || 40, toRadius: 18,
              background: surface.backgroundColor, duration: 560, easing: RESHAPE, z: 1, parent: root,
            });
            m.shell.style.boxShadow = surface.boxShadow;
            card.classList.add('handed'); // the shell takes over the surface in the same frame
            const landed = m.finished.then(shell => {
              handed();
              return new Promise(r => { dropShell(shell, 200); setTimeout(r, 220); });
            });
            Promise.all([landed, flown]).then(() => root.remove());
          });
        };
        // if the tour never comes (it was already running), leave the way Skip does
        const fallback = setTimeout(() => {
          if (started || !root.isConnected) return;
          started = true;
          handed();
          root.classList.add('closing');
          root.querySelector('.wel-dim').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: EASE_IN_OUT, fill: 'forwards' });
          Promise.all([flown, new Promise(r => setTimeout(r, 520))]).then(() => root.remove());
        }, 4000);
        ready.then(() => resolve({ choice, handoff }));
      }
    });
  }

  return { play };
}
