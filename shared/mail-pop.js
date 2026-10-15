// A name or an address that opens a small popover with an email address to copy: the
// report's "Made by" name in Settings (where bug reports go) and the privacy page's address.
// Markup: a trigger (.p-author) and a .pop.author-pop holding .ap-addr and .ap-copy
// (styles in shared/pop.css).
//
// Hovered, it opens after a beat (hover intent, only from rest: coming back while it's
// closing reverses it at once); moving between the trigger and the popover keeps it open,
// leaving both closes it. A click, or reaching the trigger by keyboard, opens it at once;
// Tab steps into it and back out. Copy says "Copied" for a moment.

import { MorphPopover, replay } from './fx.js';

/**
 * address: the email. mailto: the address's link (it can carry a subject). onCopyFail:
 * when the clipboard refuses (by default the address is selected, to copy by hand).
 * dismiss: Escape and a click elsewhere close it, and it stays on its trigger as the page
 * scrolls (the report handles those itself, among its other popovers).
 */
export function mailPop(trigger, pop, { address, mailto = `mailto:${address}`, onCopyFail = null, dismiss = false } = {}) {
  const addr = pop.querySelector('.ap-addr');
  const copy = pop.querySelector('.ap-copy');
  const popover = new MorphPopover(pop, { radius: 16, onClose: () => trigger.setAttribute('aria-expanded', 'false') });
  addr.href = mailto;
  let timer = 0;
  let copyTimer = 0;
  let quiet = false;

  // focus going back to the trigger (after Escape or leaving the popover) mustn't reopen it
  const focusTrigger = () => {
    quiet = true;
    trigger.focus({ preventScroll: true });
    quiet = false;
  };
  const close = (instant = false) => {
    clearTimeout(timer);
    if (!pop.hidden) popover.close({ instant });
  };
  const open = delay => {
    clearTimeout(timer);
    if (popover.isOpen) return;
    timer = setTimeout(() => { trigger.setAttribute('aria-expanded', 'true'); popover.open(trigger); }, delay);
  };
  const leave = () => { clearTimeout(timer); timer = setTimeout(() => close(), 220); };

  trigger.addEventListener('pointerenter', () => open(pop.hidden ? 120 : 0));
  trigger.addEventListener('pointerleave', leave);
  pop.addEventListener('pointerenter', () => clearTimeout(timer));
  pop.addEventListener('pointerleave', leave);
  trigger.addEventListener('click', () => open(0));
  trigger.addEventListener('focus', () => { if (!quiet && trigger.matches(':focus-visible')) open(0); });
  trigger.addEventListener('blur', e => { if (!pop.contains(e.relatedTarget)) leave(); });
  pop.addEventListener('focusout', e => { if (!pop.contains(e.relatedTarget) && e.relatedTarget !== trigger) leave(); });
  // the popover sits apart from its trigger: Tab steps into it and back out
  trigger.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey && !pop.hidden) { e.preventDefault(); addr.focus({ preventScroll: true }); }
  });
  pop.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === addr) { e.preventDefault(); focusTrigger(); }
    else if (!e.shiftKey && document.activeElement === copy) { e.preventDefault(); close(); focusTrigger(); }
  });
  copy.addEventListener('click', async () => {
    const label = copy.querySelector('.ap-copy-label');
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      if (onCopyFail) onCopyFail(address);
      else getSelection().selectAllChildren(addr);
      return;
    }
    label.textContent = 'Copied';
    replay(label, 'swap');
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { label.textContent = 'Copy'; replay(label, 'swap'); }, 1600);
  });

  if (dismiss) {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && popover.isOpen) { close(); focusTrigger(); }
    });
    document.addEventListener('pointerdown', e => {
      if (popover.isOpen && !pop.contains(e.target) && !trigger.contains(e.target)) close();
    });
    const follow = () => { if (!pop.hidden) popover.place(trigger.getBoundingClientRect()); };
    addEventListener('scroll', follow, { passive: true });
    addEventListener('resize', follow);
  }

  return { popover, close, focusTrigger };
}
