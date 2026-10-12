// The offscreen page the welcome's sounds play from: a freshly opened tab can't start
// audio before it's clicked, an offscreen document (reason AUDIO_PLAYBACK) can.
// welcome-intro.js opens it and says when the opening started; the score is scheduled
// from that moment, leaving out whatever has already gone by.

import { score, master } from './shared/intro-score.js';

let ctx = null;
let out = null;

chrome.runtime.onMessage.addListener(msg => {
  if (!msg || msg.to !== 'sound') return;
  if (msg.play === 'intro') {
    if (ctx) ctx.close().catch(() => {});
    ctx = new AudioContext({ latencyHint: 'interactive' });
    out = master(ctx);
    const gone = Math.max(0, Date.now() - msg.startedAt);
    score(ctx, out, ctx.currentTime + 0.02 - gone / 1000, gone + 20);
  } else if (msg.stop && ctx) {
    // a skipped opening: let what's sounding fade out
    const c = ctx;
    out.gain.setTargetAtTime(0, c.currentTime, 0.08);
    setTimeout(() => c.close().catch(() => {}), 500);
    ctx = null;
  }
});
