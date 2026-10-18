# Memoir: Browser Screen Time — handoff notes

Chrome MV3 extension by **Mina Vian** ("Made by Mina Vian" credit stays everywhere).
Logs browsing time and shows today in a popup and the whole week in a full-page report.
Current version: **6.0.0** (`manifest.json`). Load unpacked from this folder; after edits,
press reload on the extension in `chrome://extensions` and refresh the report tab.

## What the owner cares about (apply to every change)
- **Themes:** Light / Dark; the default follows the system. Pink was dropped (2026-10-17), and so was the
  full Pride palette that briefly replaced it (pastel trans-flag colours: every version looked off to the owner,
  as it went against "colour is reserved for data"). What stayed is **Rainbow clock** (a small switch,
  `.switch-sm`, on the Appearance heading's line, with one line under the theme buttons: it keeps the left
  column of Settings short; moving Never track out of Tracking detail instead looked broken), in support
  of the LGBTQ+ community: the clock's ring in the rainbow's colours with its usual clockwise fade, in either
  theme (logo.css, `:root[data-rainbow="on"]`), on the toolbar icon (`icons/rainbowN.png`, made from
  `iconN.png` by recolouring only the ring's pixels by angle, keeping their brightness; background.js
  `applyIcon` on start and when `settings.rainbow` changes) and on the report's tab icon. It's kept in
  localStorage (`bst-rainbow`, applied before first paint by theme-boot.js) and mirrored to
  `settings.rainbow` for the tracker. A saved `pink` or `pride` theme becomes System (Rainbow clock stays off unless chosen).
  The MEMOIR wordmark (`.wordmark`: popup, privacy page, menus, tour text) goes rainbow with it, a colour to
  each letter (`--wm-fill` under `[data-rainbow="on"]`; deeper on Light, brighter on Dark); `.wordmark-plain`
  (the Settings footer, toasts) stays plain.
- **One screen, no scrolling** on large windows (cards stack and the page scrolls only under ~1100 px wide).
- Minimal, clean, borderless look; **everything interactive is animated**; morph animations wherever possible.
- Hovers use `--ease-out` and must **never shake or overshoot**. `--pop` only for deliberate pops.
- **Performance matters** (they use a 165 Hz 2K screen): animate only `transform`/`opacity`, prefer
  WAAPI/CSS so the compositor runs it; avoid per-frame layout, big `filter`/`backdrop-filter`
  animations and per-element transitions on many nodes.
- "Absolutely no bugs": verify every change, check console errors.
- Keep edits small when asked for a "quick patch"; the owner watches usage.
- Don't use sub-agents for reviews (owner reviews themselves).

## Files
- `background.js` — service worker: tracking (active tab of focused window; idle 60 s unless media),
  writes day records, goal notifications (95% and over), weekly reminder alarm, retention pruning.
- `shared/core.js` — storage helpers, settings, goal history (`commitLimit`, `limitLocked`, `resetLimit`…).
- `shared/fx.js` — animation helpers (morph, tooltip, `animateHeight`, `makeScroller`, segmented controls…).
- `shared/scroll.js` — shared wheel/key glide for all overflow areas and the page; 145 ms time constant,
  refresh-rate independent, reduced-motion aware. List sliders use it too; dragging and resets stay immediate.
- `shared/context-menu.js` — themed right-click menus shared by report/popup, contextual site/text actions,
  keyboard navigation, viewport clamping, and transform/opacity entrances. Styles live in `shared/theme.css`.
- `shared/theme.css` — tokens per theme, buttons, switches, cursor styles, the MEMOIR wordmark (`shared/grain.png` is its
  grain tile). `shared/theme-boot.js` sets theme/cursor before paint.
- `shared/cursor.js` — custom animated cursor (toggle in Settings).
- `shared/goal.js` / `goal.css` — limit ring and circular limit picker.
- `shared/dust.js`, `shared/dust-engine.js`, `shared/dust-worker.js` — the dust that hides the Never track
  sites (see "Never track, hidden" below).
- `shared/logo.js` — the clock logo's markup, its entrance (`playLogo`) and the live clocks (see "The clock logo"
  below).
- `popup.*` — 380×600 "today" popup. No "Now" row (removed 5.1.5): opening the popup takes focus from the browser
  window, so the tracker always paused and it only ever said "Nothing to track on this page". The owner kept the rest
  as it was (a simplified, centred redesign was tried and turned down).
  The legend lists every category of the day (three rows, two with the private line; the rest scroll, `makeScroller`).
  A category opens its sites on click (legend, ring segment, or Enter): the report's own category popover
  (MorphPopover, `shared/pop.css`, now shared by both pages), growing out of what was clicked; again, or a click
  elsewhere, closes it. Hover previews in the ring's middle.
- `recap.html/css/js` — the weekly report (main orchestrator, ~3000 lines).
- Every tab counts (core.js `siteFromUrl`, used by the tracker): a website by its domain; anything else under a
  key no website can have (`PAGE_NAMES`, like `~private`): `~memoir` (Memoir's own pages), `~newtab` (chrome://
  newtab, edge://newtab, chrome-search://, and the web-served ntp.msn.com / google.com/_/chrome/newtab),
  `~browser` (other chrome:// edge:// about: data: view-source: pages), `~extensions` (other extensions),
  `~files` (file://); a blob: file counts for the site that made it. They have no origin or link, a name
  (`siteName`) and a glyph (fx.js `PAGE_GLYPHS`; Memoir its own icon), category Other by default, no "Never track"
  in their category menu, and survive Export/Import (`siteKey`). Before, only http(s) tabs counted.
- Live refreshes re-sort without jumping (recap.js `regroup`, used by Most used and the Categories legend on a
  soft render, i.e. when new time comes in, as when you switch back to the report): rows that stay glide from their
  old place to their new one (560 ms), Most used bars grow or shrink from their old length, new rows fade in.
  Measured: a row moving 100 px takes ~40 frames, at most 9 px a frame (it used to jump in one).
- `trend.js` — Trend over time line chart. `tour.js` — guided tutorial. `gauntlet.js` — "reset the limit" questions.
  Trend's range switch (4/12/24 weeks, a year) is one camera (`cam`: weeks u0…u1, values 0…top) moving over the
  same weeks: the curve is worked out on weeks and values (`withTangents`, monotone) and drawn through the camera
  (`curvePath`), so it stays smooth while it zooms; a week only one range has keeps its value and slides out past
  an edge or in from one (line and dots clipped to the plot while it moves). Grid lines, dates, the avg/limit lines
  and dots are kept by key (`els`) and glide with the camera; leaving ones fade by 60%, arriving ones over the last
  60%. The week you're viewing rides along. It starts from what's on screen (a switch mid-switch carries on from
  that frame) and lands exactly on a fresh draw (checked: first frame within 5/255 of the chart before, last frame
  identical). The chart measures its box's layout size (`offsetWidth/Height`, not getBoundingClientRect, which the
  arriving view's scale shrank) and refits on resize (ResizeObserver), so it no longer draws too tall first and
  snaps on the next redraw. It used to resample both lines by index and draw straight segments while moving, then
  snap back to the smooth curve, with dots, labels and grid swapped out.
- `welcome.js` — first-run welcome screen (styles at the end of `recap.css`). `welcome-intro.js` — its opening;
  `fonts/Unbounded-subset.woff2` — the trailer's face, MEMOIR/WELCOME TO only.
- `fonts/InterVariable-memoir.woff2` — Inter 4.1 (OFL), every weight and optical size, Latin/Greek/Cyrillic: the text's
  font everywhere but on a Mac, which keeps SF Pro (`-apple-system` first in `--font`; SF Pro is never named, so a PC
  with it installed still gets Inter). theme-boot.js preloads it off-Mac. The Clear-all label uses it on a Mac too.
  One change from Inter itself (the owner's ask): tabular digits keep the plain 1, not Inter's footed tabular 1
  (`tnum`'s one → one.tf rule removed before subsetting, fontTools; OFL allows it, Inter reserves no name), so a 1
  looks the same everywhere. Remaking the file: subset InterVariable.ttf to the ranges in the @font-face comment.
- `PRIVACY.md` — the privacy policy; `privacy.html/css/js` — the same text in the extension: plain text in one column, the clock
  and MEMOIR on top, the report's cursor and scrolling; sizes follow the window; the text pops on (the
  headline word by word, the rest as it comes into view; `<html class="pv-pop">` hides it from the start; not `pop`, which shared/pop.css styles as a
  popover); hovering the address opens the report's "Made by" popover, holding just its Copy button
  (`shared/mail-pop.js`, styles in `shared/pop.css`). Opened from the footer of
  Settings ("Your data never leaves this computer": linked with Memoir for Windows it goes to that app, on the same computer). Keep the two the same. `store/chrome-web-store-privacy.md` — the
  Web Store's Privacy practices answers (single purpose, why each permission, data use), checked against the code.
  If a permission, a stored field or a data flow changes, update all of these.

### Data model (chrome.storage.local)
- `day:YYYY-MM-DD` = `{ s:{domain:ms}, h:[24], hs:{hour:{domain:ms}}, ti:{domain:{title:ms}} }`; excluded sites stored as `~private`.
- `origins`, `categories` (overrides), `goal:{history:[{from, limit|null}]}`, `goalNotify`, `onboarded`,
  `settings:{paused, weeklyReminder, reminderDay, reminderMinutes, titles, excluded, retention(0=forever)}`.

## Features in place (all working, tested)
- Report: summary + highlights (bold words are buttons), daily chart (day → hour drill-down, ‹ › stepping,
  Back and round « home), Activity by hour heat grid with a single morphing outline, categories donut,
  most-used list, Trend over time (hover the "x% from last week" line).
- Heat outline (rewritten in 4.2.3): 12 pieces in `#heat-sel` (4 dim bands, 4 edges, 4 corners), moved
  **only by transform** via WAAPI (`placeHeatFrame`, `setHeatBox`, `heatNow` in recap.js). Pixel-snapped, 2 px.
- Settings panel morphs from the gear with an ease-in-out curve (`--sheet`), everything behind blurs (header too).
- Never track: typed site flies into its chip; removal FLIPs the other chips.
- Reset limit gauntlet: 10 steps, no step count shown, 4 variants per step (40), middle 8 shuffled,
  random button sides/"trick" styling, generated sums, avoids repeating the last attempt's variants.
  Opening (gauntlet.js, end of `runGauntlet`): the Reset button reshapes into the card on the tutorial's clock
  (`RESHAPE`/`RESHAPE_MS` in fx.js, shared with the welcome's handoff to the tour). The first question goes in
  without the height animation, so the card is measured at its real size (it used to be measured with its body
  at 0 px: the shell flew to a 380×38 bar, sat empty, then the card faded in four times taller, which read as
  loading). The shell is the surface (in the layer, under the card, with the card's shadow); at 80% of the flight,
  once it's around them, the question's parts arrive one by one (`playParts`: retort, title, words, options or
  field, then each button, 60 ms apart, 480 ms each, rising into place, like the limit clock's "Are you
  committed?" card; only on opening: a next question slides in whole, as before); on landing the card takes over in the same frame, byte-identical at
  100/125/150% (checked by freezing the last frame and diffing). Esc or a click outside mid-open shrinks back from
  where the shell is.
- `morph` (fx.js): coordinates are exact (no rounding to 0.01 px, which put a shell 1/64 px off its box), and an
  opacity that stays 1 is left out of the keyframes: animating it promoted the shell to its own layer, drawn
  between device pixels at 125%, so it landed with a soft edge next to the crisp box (up to 27/255 apart).
- Keep history: shorter period asks **twice** (Remove → glowing "Delete forever", 9 s auto-disarm).
  Under it, "Used X so far, Y of it page titles." (recap.js `refreshStats`): X is all of storage (`getBytesInUse`),
  Y the days' `ti`/`th`/`tu` as UTF-8 JSON (`titleBytesIn`, a month of days per read, so Settings never waits; matches
  Chrome's own count). It refreshes on opening Settings, imports, Keep history changes, Clear all and Erase titles.
  Measured: 730 heavy days (17 MB) show in under a second, with no long tasks.
- Clear all: two-step (sure → SURE variable-font morph).
- Sample week uses the user's real limit (no fake limit).
- First run (4.3.0): a fresh install opens `recap.html` (`onInstalled`, reason `install`). While `onboarded`
  is unset the report shows the welcome (`welcome.js`): the clock pops and sets itself, letters rise, cards cascade,
  pin hint points at the toolbar. Behind it the board is the tour's sample week (a new week is empty); "Skip for now"
  goes from it to your own week the way the tour's end does (`resetView` + `render`). "Take the tour" flies the clock into the header logo while the page
  reveals, then the tutorial runs; "Skip for now" (or Esc) just sets `onboarded`. Replay the tour from Settings.
- Welcome (5.1.2): a single card on the tour's own dim (`--tour-dim`, no colour orbs, no feature cards). Its surface
  is `.wel-card::before`, so the clock inside can fly off on its own. It flies home to the header and IS the header
  logo from then on (`flyMark`: the hidden one waiting there is replaced by it; `goLive` starts it showing the time on
  the way; halfway it takes the header logo's own 40 px size inside, scaled up, so it arrives drawn exactly as the
  header's is; its start is allowed for being drawn from a whole pixel; a strong ease in and out; heading for the tour
  it darkens on the way to how it looks under the tour's dim, `underDim`, so landing under it changes nothing). One
  clock from the opening's O to the header,
  nothing handed over (owner's rule). On a narrow window, with no header logo, it blurs away instead.
  "Take the tour" starts the tour at once, under the card, while the words fade; the dims swap in one frame
  (`.tour.handoff` skips the spot's fade); once the words are gone and the page is calm (`calm()`), a shell reshapes
  the card into the tour's first card (`handoff(card, { onMove, onLand })` from `runTour`). That card is "Your weeks",
  beside the lit week arrows: there's no intro card of its own any more (a "This is Memoir" card repeated the welcome
  and cost a click; dropped 2026-10-16, its sample-week note moved onto "Your weeks"). Till the shell sets off the
  tour card is unseen (`.tour.arriving`) and the light shut at the arrows' middle; it opens on the reshape's own clock
  (`RESHAPE_MS`, `RESHAPE`), and the card shows in the frame the shell lands. The board's first render waits until it has
  landed (`onHanded`), so it never competes with the reshape. The real week renders behind the dim just after the
  welcome starts playing in (`onShown`, 120 ms), so the page isn't blank and its follow-up work (about 2.5 s of
  small tasks) is done before most clicks; the tour path redraws it as the sample week after landing.
  Card radius 40 px (reshapes to the tour card's 18). Pin hint: a straight up arrow, `right: 72px` (tip ~104 px
  from the right edge), aimed at the Extensions (puzzle) button.
  Measured: reshape frames are a steady 6 ms once the GPU shader cache is warm; a brand-new browser profile may drop
  a frame or two on its very first run (GPU shader compilation, not page work).
- Limit lock (4.3.0): a committed limit stays locked on later days too (`limitLocked` = any limit in effect).
  Only the Settings gauntlet unlocks it (`resetLimit` writes `{from: today, limit: null}`; past days keep theirs).
- Limit picker (4.3.0): knob rides a critically damped spring (`FOLLOW`/`HOP`/`SETTLE`/`GLIDE` in goal.js) and
  settles onto the value on release; dragging past an end through the top gap pins it.
  Minutes are 0–59 in 1-minute steps (`GOAL_MIN_MS` = 1 min). Dragging snaps to the dots (`DOT`: every hour, every
  5 minutes; past 55 it stays on 55). Creeping slowly in the minutes (`pace`: speed smoothed over ~0.12 s, between
  `CREEP` 0.4 and 5 minutes a second for `CREEP_FOR` 0.35 s) turns on fine-tuning: the knob follows the pointer and
  minutes go one at a time, until a sweep faster than `FAST` (18 a second). Grabbing a knob that's between dots
  keeps fine-tuning. Held on a dot, the knob grows slowly (`.on-dot`, r 11→13 in 0.5 s, back in 0.7 s) and stays
  grown until it leaves the dot or is let go; no taps. Measured in Edge: drags up to ~1.5 s land on a dot, a 2.5 s
  crawl fine-tunes. `.pk-center` lets clicks through (only the fields and Cancel take them): its corners reach the
  ring around 20 and 40 minutes, where the knob couldn't be grabbed. Tick dots sit on the track, numbers outside,
  Cancel in the centre column. The ✓ centres with `translate`, hovers with `scale`, and pops via WAAPI `transform`,
  so its animations never restart or fight each other.
- Picker look (4.3.0): colours follow the theme (light picker on Light, dark on Dark;
  `--pk-*` tokens incl. `--pk-shadow`, `--pk-scrim`). The page behind blurs like Settings (2px backdrop blur).
  Opening is choreographed in goal.js (`buildParts` / `playIn`): the track draws itself round (dashoffset,
  pathLength 1), dots pop as the sweep passes, numbers drift out after them, knob/✓/digits/underline/hint/Cancel
  arrive in the middle. Closing (`playOut`) plays it backwards (still-running parts just reverse), then the
  circle shrinks. The circle itself grows/shrinks with `flyShell` (transform + opacity only, compositor).
  Shells must live in the SAME stacking context as what they grow into (`.pk-layer` is z 4000, so a shell on
  <body> at z 4050 covers the whole picker): `flyShell` inserts into the layer, `morph({ parent })` and
  MorphPopover put the shell next to the popover.
  playIn creates every part paused and sets one shared startTime two frames later, so no part loses time to
  the first paint. It starts at ~190 ms (circle ~90% grown) while the circle is still growing (`.pk.bare`: the morph shell is the
  surface until it lands); `MorphPopover` does the same at 150 ms for every popover, so nothing waits on the shell.
  Hint under the time is just "a day" (only animates when its text changes); above 8 h it shows one of 12
  remarks (`SASS` in goal.js), a new one per hour value, no repeats until all have been used.
- Custom cursor (5.1.2): drawn exactly at the pointer on every move (`pointerrawupdate`), no catch-up.
  Smooth cursor (`bst-cursor-smooth`, off by default) brings back the glide (`SMOOTH_MS = 22`). Hover =
  tilt/shrink on `.cc-inner`, press = extra squeeze on `.cc-arrow` (same everywhere); popup edge guard hides it
  when the pointer leaves fast. Off setting works in all themes. The system draws the same arrow (theme.css
  `--cursor`, `.cc.is-native`, no `html.cc-live`) until the page has settled after opening (load, then an idle
  callback), and whenever moves arrive late (handled > 40 ms after the mouse sent them: a busy page, a slow
  device); the animated one takes over again on a move after 900 ms on time, at full strength in that frame.
  Settings: Custom + Smooth cursor share a section; with Custom cursor off, Smooth cursor's row fades
  (`#smooth-row.locked`) and its switch is `aria-disabled` (a press nudges the switch only, nothing changes).
  Tracking detail and Track browsing share a section.

- First load is queued (4.3.0): cards enter 110 ms apart, row by row (`--i`: header 0, summary 1, chart 2,
  categories 3, limit 4, by hour 5, most used 6). While `body.intro` is on (first render + 2.6 s), everything
  inside a card waits for its card: CSS adds `--intro-wait` (= --i x 110 ms) to its delays, JS uses
  `introWait(sel)`. Heat squares ripple (--d) on the first render too. On a first visit the first render runs
  as the welcome leaves (`show()` in init), so the entrance is seen instead of playing behind the welcome.

- Tour (4.3.0) is hands-on: steps with `tasks` (or `interactive`) cut a hole in `.tour-block` over the light
  (clip-path evenodd), so what's lit is clickable; each task `{ text, watch(done) => cleanup }` turns its dot
  green when done (onClick/onHover/onScroll/onChange helpers in startTour). Next always works. Steps that could
  erase data (history, Clear all) stay closed. While `body.touring`, .pop/.menu/.tip sit
  above the tour. It ends with a walk through Settings (opened and scrolled by each step's `before`).
  From the welcome, choosing the tour makes the sample week the first render (`useTourWeek`) and the tour
  starts with `{ prepared: true }` once the board has filled in.
- Empty week <-> full week is animated (`toggleEmpty`): cards step aside before the empty card enters (its
  icon, title, line and button stagger in); going the other way the cards come back at once (they're measured
  while rendering) and enter in turn while the empty card fades on top. Both directions use the queue
  (`startQueue`), like the first load.

- Week / Day switch on Categories (4.3.0): `state.scope` ('day' default, not saved). `scoped(s)` gives the
  cats / siteList / total / labels for the scope; Day = the day open in Daily activity, else today, else the
  week's last active day. Donut, legend, its popover and Most used read from it; `followDay()` (after each
  view change) re-renders them when the shown day changes. Thumb is placed by CSS (`--k`), not syncSegmented.
- Settings contents (`.panel-inner`) keep `will-change` so the text doesn't re-snap when the opening ends.

- Tour Next button charges up (4.3.0, `chargeNext` in tour.js): each done try sends a spark (arc, 600 ms, after
  140 ms) into Next, whose green fill (`.tn-fill`, translateX) advances one share per try, starting at 80% of the
  flight. Full: `.full` slides the arrow in and the word eases 6 px left; the arrow nudges every
  2.8 s. Fill/arrow are absolutely positioned, so the button never moves or resizes.

- Exiting the sample week (4.3.0, `meltPill` in recap.js): the Sample week pill melts into the gear, built
  from two round caps + a middle (transform only, so the capsule never distorts); right end reaches the gear
  first, the drop thins and pours in under the gear (the layer sits in .head below the gear). The gear runs
  on the same clock: swells with the pour, bulges, turns one full 360 (the icon isn't truly 60-deg
  symmetric, so it must end at 0/360), then settles. Skipped when
  Settings is open or with reduced motion. The re-render waits two frames so the melt starts first.

- List performance (4.3.0): favicon lookups are lazy (`whenSeen`, IntersectionObserver), at most 4 at once
  (`favSlot`), and the page address that worked is remembered in localStorage (`memoir-fav:<domain>`, keyed
  with its origin; 'no icon' is re-asked after a day). Site/row bars grow with `transform` (compositor), not
  clip-path. Most used only animates the rows on screen (`.site.still` for the rest) and starts all bars
  from one frame.

- Highlights updates (4.3.0, `setStory` in recap.js): lines are keyed (limit line = 'goal', facts = icon +
  count). A new week cascades in as before; any other change (a day opened, a category moved, a resize) is
  diffed: gone lines leave from where they were (lifted out of the flow), changed ones cross-fade their words,
  new ones rise in, moved ones glide (FLIP). Lines that no longer fit leave the same way. Leaving is a pure fade
  in place; a line that returns while still fading out is revived (`storyRevive`), never duplicated. Lines
  have 4px vertical padding so a full week (limit line + private + sites) fits.

- Empty week layout (5.0.1): the hour grid stays in the layout, invisible (`.board.is-empty > .heat-card`), and
  is rendered even for an empty week, because the limit card's row takes its height from it; so the summary and
  limit cards never move when a week fills or empties. Stacked (narrow) layouts drop it with display:none.

- Data lock (5.1.2): every read-then-write of tracked data holds `withData` (core.js, a Web Lock named
  `memoir-data`): the tracker's queue (`enqueue` in background.js) and the report's import, Never-track
  anonymizing, title erasing and Clear all. Never await the tracker (`sendMessage({type:'sync'})`) inside it.
- Import (5.1.2): `readImport` only keeps names the tracker could have written (`siteKey`: `domainFromUrl`
  round-trip; titles through `safeKey`). Days that already have time open the merge/replace popover
  (`#import-pop`, MorphPopover from the Import button). Merge = larger time per site per hour (`mergeDay`),
  idempotent; days without per-hour detail keep the fuller record.
- Limits in Export/Import (6.0.0): Export already wrote everything, `goal` included; `readImport` now reads
  `goal.history` too (real days only, none still to come; limits clamped to GOAL_MIN_MS…GOAL_MAX_MS) and
  `writeImport` adds it under the lock rule: no history here, the file's whole history (today's limit too,
  so it's locked); a history here, only the file's entries before its first `from`. An import is never a way
  around a locked limit. The toast adds "and your limits".
- Private windows (5.1.2): when allowed in incognito, those tabs record as `~private`.
- Title-only tab updates sync only while titles are on (`titlesOn` in background.js).
- Background tab (5.1.2): `onStorageChanged` folds changes while `document.hidden` and applies them once on
  `visibilitychange` (`applyHiddenChanges`), so a hidden report does no DOM work per tab switch and is current
  as soon as it's seen. `goalTick` and the cursor's recheck timer also stop while hidden.
- Scrolling (5.1.2): in-page lists no longer use `overscroll-behavior: contain` (popover lists still do), and
  scroll.js latches a wheel gesture to what it started on (`GESTURE_GAP_MS`): a list that runs out holds the
  rest of that gesture, the next one carries on to the page.
- Right-click menu (5.1.2): right-clicking while it's open glides it (translate + height, WAAPI) to the new spot;
  the old rows ride along in `.context-ghost` and fade while the new ones enter.
- Pausing tracking (5.1.5, recap.js `askPause`, recap.css `.pause-switch`): only the Track browsing switch in
  Settings can pause, on a second press. The first press leaves it on and turns the switch itself into a red
  "Sure?" button (it widens, its knob gives way to the word); pressing that pauses, and it shrinks back into the
  switch, off. Left alone 4 s, Esc, a press elsewhere, blur or closing Settings: back to the switch, still on.
  Turning it on is one click. The report's and the popup's right-click menus, and the popup's Resume button,
  can only resume (shown only while paused).
- Bug reports (5.1.2): hovering/focusing "Mina Vian" in the Settings footer morphs `#author-pop` out of it
  (120 ms hover intent, 220 ms grace to cross into it; Tab steps in, Escape returns to the name).
- MorphPopover is fully interruptible (5.1.2, all popovers): open/close take over the shell still in flight
  (`takeShell`) and continue from its current rect, radius and opacity, so there's only ever one surface. The
  remaining trip sets the duration, and an interrupted trip turns from rest (`TURN` easing) instead of snapping.

- Tour fixes (5.1.2): the limit step is hands-on ("Tap Set limit to try it out", only when no limit is locked). A
  limit committed while `touring` writes `goalTrial {from, until: +24 h}`: Settings shows "Undo" (one click, no
  gauntlet) until it expires, then `trialActive()` removes it. While a picker is up, `body.picking` fades the whole
  tour out (dim + card, no pointer events), so the picker's scrim is the only dim/blur. The hour step has `autoNext`
  (moves on 900 ms after Next fills). Most used: no scroll task, and its `before` closes Settings (Back from the
  Settings step). Sparks fly inside the tour card (card-relative), so they land on Next when the card moves. Tour
  buttons have no focus ring. Day stepping cross-fades the hour bars' colours (`.hbar-old`, reuseStrip).

- Mouse Back button (5.1.2, recap.js): a button-3 press is taken at window/capture (before any other handler) and
  acts once on pointerup (cancelling the press cancels its mouseup): tour → previous step; otherwise, if anything is
  open or a day/hour is showing, a synthetic Escape; with nothing to step back from, the browser's own Back runs.
- Favicons don't blink on refresh (5.1.2, fx.js): `iconKnown` remembers each resolved icon, so a redrawn list
  (soft render after every tracker save) shows it at once with no entrance; the pop-in only plays the first time.

- No hover tooltips (5.1.2, fx.js `disableTitleTooltips`, called by recap and popup): any `title` is removed on
  pointerover, before the browser's tooltip delay, so it never shows; a control without text gets it as aria-label.

- A site's pages (5.1.2). Data, per day: `ti` (title → ms), `th` (hour → site → title → ms, so an hour has its
  own pages), `tu` (title → its latest link, cleaned by core.js `cleanUrl`: http(s) only, on that site, no login
  or #part, tracking tags dropped, at most 500 chars), `tp` (sites whose titles were deleted as they got old).
  Links are only saved with a title (Page titles on), never for Private, excluded or incognito time; the 30-titles
  cap is unchanged ("other pages" has no link). Titles, hours and links are kept as long as their day (Keep
  history); the old `settings.titleWeeks` (4–16 weeks, `pruneTitles`/`dropTitles`) is gone, and `getSettings`
  drops the key. Days it trimmed still have `tp`. Never track, Erase titles, merge/replace imports and Clear all
  cover `th`/`tu`/`tp`.
  UI (recap.js `openPagePop`, `pagesFor`, `pagesWhen`): rows with pages (`.has-pages`) in Most used and in the
  day/hour views hint "Click to see each page's time …" and open `#page-pop`, a second page of the Most used card
  (`.sites-page`, absolute over the card: its own surface, corners and padding, no shadow, so it's the card turning
  into the pages). From a Most used row it grows out of that row (`.drop`: a clip-path inset from the row to the
  whole card, the popovers' timing and spring, POP 160 + 300 ms; the pages fade in with it, `.unfold`) and folds
  back into it (EASE_OUT 120 + 180 ms). From the day/hour view the card cross-fades to the pages exactly like
  Daily activity's `.view`s (out 0.34 s, in 0.42 s + slight scale/lift; CSS transitions, so they reverse from
  wherever they are); Most used scrolls into view first where it's below the window. Another site while they're up
  cross-fades `.sp-body`s the same way. Closing goes into the row when it grew from one still in the card, else the
  reverse cross-fade. State: `pages` (state, mode, anim); `openPagePop`, `buildPages`, `closePagePop`. The card's
  own content is `inert` while the pages are over it. A back button (`.pp-back`), Escape, the mouse's Back button or
  a click elsewhere close them. Page rows show the site-link ↗ on hover; "Open URL" waits for a 1 s rest the first
  time, then morphs from page to page like every tip (gone over a row without a link). An hour saved before `th`
  existed shows that day's pages with a note. Titles gone (deleted by an older version): a message. The pages close when their rows are rebuilt.
  A popover on its way out (`.pop[data-state="closing"]`) lets clicks through.
  Live refreshes (`refreshSoon`) now wait while a menu or popover is shown or still animating (they used to be
  dropped while one was open, leaving stale numbers until the next save).
  Export carries `format: 2`; files without it are announced as older, brought up to date and imported.

- Toast (5.1.5, recap.js `toast` / `hideToast`): rises in (pop), sinks away after its hold. A new one while
  it's up or sinking morphs the pill (width and height) to the new words while the old words fade up and
  away and the new ones fade in. Every move starts from the running animations' current values, so it's
  interruptible at any speed (two leaving word layers at most). The pill is `width: max-content` between
  left/right 0 (no `left: 50%`, which halved the room and wrapped long messages); the words are `flex: none`
  with the finished pill's max width, so they wrap only where it would, never while it's still growing.

- Tour card placement (tour.js `place` / `cardSpot`): a step's `alignTo()` lines the card up (left edges) under what
  it names when it goes below the light, and `flip()` says whether its buttons go to the top there. Daily average:
  under the small light the buttons stay at the bottom; once Trend opens they go to the top and the card sits
  under the trend chart's left edge. `below` may be a function: Highlights keeps its card beside the words (buttons
  at the bottom), so a category's sites drop down clear of it, and goes under the light only once a bold day or
  hour has opened in the chart. When a popover or menu covers the card's spot, the card slides along the same side
  past it (spots around light + popovers rank 0.5, their distance counted from that union, floored at the gap)
  instead of jumping to another side of the light.
- Tour (5.1.2): steps marked `autoNext` ("An hour up close") move on the moment Next has filled, without
  the full-arrow pause. The Cursor step covers Custom and Smooth cursor (a task each; a press on the locked
  Smooth cursor doesn't count).

- Limit clock inside the tour (5.1.2, recap.js `openGoalPicker`, goal.js `onClosing` / `focusBack`): while the clock
  is up the tour's dim and card are hidden (`picking`). Coming back, in turn: the dim crossfades in under the clock's
  scrim as it closes (`tour-return`), the card pops in (`scale`) once the clock has landed, then the outline
  (`tour-return-ring`). Focus goes back to the tour's Next.

- Categories legend (5.1.2, recap.js `renderDonut`): on short windows the legend sets the card's height, so a
  Week/Day switch (or a week with more categories) changes it. The rebuild runs inside `animateHeight`: the card
  glides to its new height and Most used below follows, picking up mid-glide on quick clicks (not during the intro).

- Hour grid entrance (5.1.2, recap.css `.heat-veil`, added by `buildHeat`): one card-coloured veil with a long
  slanted soft edge slides off the cells (transform only), then hides. It replaces 168 per-cell opacity fades: each
  got a compositing layer and a page-wide layout (40–70 ms) as it began, which stalled the categories ring and
  everything else arriving. Don't give many small elements their own staggered opacity animations.

- Theme change (5.1.2, theme.js `setThemePref(pref, origin, { panel, panelParts, parts, cards })`): every pick
  sends a wave, and waves follow each other without limit (light, dark, light… each rolls in behind the last; none is
  cut short). No view transition (one at a time, two images, and it routes clicks to <html>). Instead:
  - Surfaces: one fixed `.wave-layer[data-wave]` per wave (page background + the cards' shapes as `<i>`s), stacked
    under the board, revealed by a soft diagonal mask from the top-right (`--wave-p` 0→130%, 1230 ms from 270 ms).
    The first wave also lays a `base` layer of the old theme. While `:root.waving`, the board's cards are
    transparent so the layers show through. With Settings open, `.wave-panel` (inside the panel, z-index -1) fills
    in a soft circle from the clicked button (`--wave-r`, 840 ms).
  - Content: theme tokens are scoped to `[data-wave="light|dark"]` as well as `:root` (theme.css, recap.css),
    so a single element can carry a theme. `blocksIn` splits the parts into small blocks (≤ 40 000 px², or leaves;
    a small part such as the gear button switches whole). One rAF loop flips each block's `data-wave` when the middle
    of a wave's soft edge reaches its centre (the times come from the easing curve inverted in JS). A block takes
    the theme's `--label` unless it inherits another colour (`data-wave-keep`). On the frame a block switches it has
    `data-wave-now`, holding its own transitions (e.g. heat cells' 0.5 s fill) so it stays with the surface.
    There are no colour transitions; they made 1 000+ elements restyle every frame. A block carries its theme's
    `--cursor` too, so the cursor-off override covers `[data-wave]` as well as `html`.
  - Floating surfaces (`panels`: the Settings panel and, in the tour, the tour card) share one circle from the
    button; each gets a `.wave-panel` layer and always switches by its blocks (`split`), whose few descendants are
    held still for that frame too (`data-wave-deep`). The tour's dim (`fades`) switches as the sweep passes it and
    fades by its own box-shadow transition.
  - Cursor: takes the theme of the newest wave that has reached the pointer (pointer tracked from events; reading
    the cursor's box would force a restyle).
  - Landing: the newest wave settles the page (`apply`). The layers stay one more frame, so the page restyles under
    them with the cards' and panel's transitions still held (`waving`, then `wave-done`; `.morph-panel` drops its
    background-colour transition while waving). Otherwise they'd fade from the old theme out from under the layers.
    Blocks then lose `data-wave`, 60 per frame, each held still for that frame.
  - Progress bar: the line under Appearance (`.theme-progress`, `themeProgress()` in recap.js, transform only,
    cubic-bezier(0.83, 0, 0.17, 1), continuing from where it is).
  - Measured (headless Edge, Settings open): a 4-click chase is mostly under 34 ms per frame. Ten clicks 70 ms
    apart peak at 40–60 ms frames while ~10 waves overlap (~1 000 elements restyled per frame). Blocks stay in step
    with the surface under them. Nothing fades after landing.
  - Windows port: the `web/` copy needs the same `[data-wave]` token scoping.

- Going back, the ghost (5.1.5, recap.js `ghost` with `reverse`): it mirrors the opening. Opening, it
  starts on the square it came from, in that square's colour (so it reads faint), swells and fades. Back, it
  used to start full size at 0.9 opacity, a solid block over the chart. Now it starts invisible while big,
  gathers to 0.6 as it shrinks (opacity is its own linear animation; the shrink keeps EASE_OUT) and lands at
  0.9 on a square of its own colour (an hour-grid cell), becoming it; on something without a colour of its
  own (a day label, an hour column, Trend) it fades out as it lands.

- A site's pages, motion (5.1.5): grown out of a Most used row, the row is what turns into the pages.
  The surface starts as the row's highlight (`.sites-page::before`, `pages.tint`, fades as it grows); the
  row's name rides up to become the title (`.sp-head` translate + `.sp-name` scale, measured by
  `headOffset`: baselines and word widths matched, so it lands exactly on the row's name and back); the rest
  of the list fades at once (`.lifted`), and the pages' rows come in under the title once it has passed
  (210 ms). The clip's top edge keeps pace with the title (sampled keyframes, `dropFrames`: sides spring
  with POP, the top eases with the title), so the title is never clipped. Closing reverses it: rows go,
  the title rides back down onto the row's name as the surface folds in (`--sheet` curve), the list comes
  back around it, and the surface lets the row show only as it lands (`pages.fade`). Interrupted either
  way, title and surface carry on from where they are (`headPose`, `tintNow`).
  Every cross-fade in this card (from a day/hour row, between sites, closing) is now a fade-through: the
  outgoing side is gone (0.16 s) before the incoming one shows (from 0.13 s), so two lists never read on top
  of each other. The "Click to see each page's time" hint vanishes on the click itself (`tip.hide(true)`).

- Tour placement (5.1.5, tour.js `cardSpot`): a step's `follow()` adds what its tries opened elsewhere
  to the light (Daily average: the trend graph; Highlights and Activity by hour: the day or hour they open
  in Daily activity), so it's lit, usable and the card moves off it; `avoid()` (runTour option) keeps the
  card off open popovers and menus. Places beside the light are scored (covering the light, then what's
  up, then distance; right, left, below, above break ties), which gives the old placement when nothing is
  open. Settings steps keep their old placement: the owner tried the card beside the Settings panel and
  disliked it (it sat far from the light); keep the card next to the light. Highlights starts on the week.

- Tour arrows (5.1.5, tour.js `onArrow`): ← → are the tour's (Next, Back) wherever the focus is, caught at
  window/capture before the page's own handlers. "Your weeks" lends them to the page (`arrows(dir)` clicks
  ‹ / ›), so there they change the week and tick its tries. Text fields, the limit picker, its questions
  and menus keep their arrows.

- Card under the light (5.1.5, tour.js `setFlip`): a step with `below` ranks the place under its light first
  (Daily average, Highlights). Whenever the card sits under its light, `.flip` puts Back and Next at the card's top,
  nearest the pointer (it's in the light), and the dots and Skip at its foot; each part glides there (FLIP,
  0.7 s, the card's heavy ease) and the dots fade across instead of passing over the words. Sparks read
  Next's place every frame, so they land on it mid-glide. Daily average's try is a click on the change
  from last week (it opens Trend over time), no longer a hover.

- The light makes room first (5.1.5, tour.js `relight`): when the page changes what's lit, it calls
  `relight(after)` with the new layout in place but before its animation shows it. Growing, the light
  opens to the new size (300 ms, heavy) and the page's animation waits that long: `setReveal` measures the
  open layout with transitions off, `renderExcluded` holds the list's height, the chips' glide, the pop-in
  and the typed words' flight (`animateHeight` takes a `delay`). Shrinking, the page goes first and the
  light follows `after` ms later; the click-driven re-placing waits too (`holdUntil`), so the light never
  shrinks halfway. Hands-on: "What gets tracked" (switch Tracking detail, add a site to Never track) and
  "Weekly recap" (another day, another time; switching it on comes first if it was off).

- Never track, hidden (5.1.5): the sites under Never track are hidden under dust, a shimmer of fine
  specks over a soft haze, filling the whole pill, the × too (thinning towards its rounded edge).
  One click stirs it and asks "Click again to show it" (2.6 s); the second blows the dust away from where it
  landed while the name clears up from there (clip-path circle + unblur). A click on a shown name, or closing
  Settings, hides it again (fresh dust settles in). Enter twice works too. The × is hidden with the name
  (visibility, its place kept): it appears only on a shown site, 0.5 s after the reveal, so a triple tap
  can't remove the site; clicks in that half second neither remove nor re-hide it (`REVEAL_GUARD_MS`).
  The name answers anywhere on the pill (`.ex-name::after` covers its edges and the ×'s place): a hidden × takes
  no clicks, so its place used to be dead (clicks fell on the `li`, which the handler ignores). A shown × is drawn
  above it and takes its own.
  A site that's just landed (`.landing`) shows no × before it turns to dust. The newest site is first; a typed site lifts off the field the
  moment you add it (the field empties under it in the same frame, `liftTyped`), glides into the first slot
  (the others make room, FLIP) and lands exactly on the chip's name, then turns to dust after a beat.
  Drawing: `shared/dust-engine.js` (`Dust` per pill, `Runner` loop) runs in a worker (`dust-worker.js`) on
  transferred OffscreenCanvases, so it costs the page nothing; `shared/dust.js` sizes them (ResizeObserver),
  skips pills off screen (IntersectionObserver) and pauses everything when Settings is closed (900 ms after)
  or the tab is hidden. Specks are white; `--dust-ink` (a CSS filter token, recap.css) tints them per theme.
  Reduced motion: a still frame, instant reveal/hide.

- The opening (5.1.5, `welcome-intro.js`): it follows the theme (tokens `--wi-bg`, `--wi-light`, `--wi-kick` in
  recap.css). Dark: black, a soft light, platinum words, a white clock that gets its disc as it flies. Light: a soft
  white, a brighter spot, the wordmark's graphite, and the clock the Light logo all along (ink, no disc, the knob's hole
  opening through the ring once the knob is mostly in, `--lg-hole`). Before the welcome card, WELCOME TO and
  a big MEMOIR (the wordmark) arrive letter by letter from left to right while the welcome runs the page's work behind
  it (`play({ load })`: the week drawn, the tour's sample weeks made ahead and cached, `calm()`). The O is not a letter:
  the word keeps only its room (`.wi-o`, the O's advance) and the card's own clock (`.wel-mark`) sits in it, scaled up,
  its ring drawn as Unbounded Black's O (heavy: `--lg-band` 42%, a registered property; wide: `scale` 1.16; the word's
  platinum across it in the ring's `::after`, the letters' glow as a box-shadow). As soon as the word is in (or once the
  work is done, if later) it turns: band and width in one animation to the ring's own (77.632%, round) as its platinum
  gives way to the ring's fade and the clock sets itself (playLogo `fromO`); then the letters fly one after another
  (0.6 s after the clock is set), left to right, onto their own in the card's MEMOIR, the clock in the O's turn on to
  its own place (the same element, one transform to `none`: nothing hands over, so nothing can jump; owner's rule, see
  below), WELCOME TO onto the kicker, the black (or white) lifting off; it lands as the logo that follows the theme
  (`.themed`; on Light it fills the disc's room as it flies). The card's MEMOIR is cut in three (MEM, O, IR; the
  face has no kerning) so its O pops in as the second M lands to the eye, two thirds into its flight: the word fills
  in M, E, M, O, I, R. The card's entrance waits for `.cascade`. Clicks and keys
  during it do nothing; `.wel.landed` marks the end (~5.8 s). Reduced motion: no opening. Tried and dropped by the
  owner: sound, grain clouds, the word as a coloured loading bar ("too ugly"), and an O glyph crossfading into a
  separate clock ("a small correction" showed as they swapped). Owner's rule: a thing that turns into another is one
  element on one path, never two matched up (that breaks on high-DPI screens). So the big MEMOIR and WELCOME TO are the
  card's own title letters and kicker, scaled up onto the opening's word (`.wi-type` is only unseen room now) and flown
  home: the card's MEMOIR is cut into letters (no kerning in the face), the kicker is in the opening's type (Unbounded
  500, 0.34em tracking, 12 px). Each shrinks to a breath over its size 72% into its flight and glides the rest (`shrink`),
  so Chrome's redraw from big to its own size happens in flight, not as it stops; their grain tile is set finer while
  scaled up (`--wm-g`) and given back halfway. (Slow glides move in whole-pixel steps vertically: Chrome, as before.)
- The MEMOIR wordmark (5.1.5, `shared/theme.css`): wherever the name shows (popup header, welcome title and pin
  hint, tour, right-click menu title) it's the trailer's: Unbounded 900 capitals (`fonts/Unbounded-subset.woff2`,
  preloaded), platinum on Dark and graphite on Light (`--wm-fill`), a fine grain (soft-light tile), a tight glow
  (`--wm-glow`). Painted once and never again: the glow is the word's own text-shadow (its text is transparent),
  the platinum a copy on top (`::after`, background-clip text), no filters. `<span class="wordmark">Memoir</span>`;
  `.wm-in` sizes it for a line of text; a slice (one letter) sets `data-t` and `--wm-w`/`--wm-x`. In Settings it's
  plain on purpose (owner's rule): `.wordmark-plain`, Unbounded capitals only (footer, import popover, the toasts
  via `brand()`). Notifications and window titles stay plain text.
- The clock logo (5.1.5): the hourglass is gone; the logo is a clock at 10:10 with no tile behind it. The
  ring fades clockwise from 12 in opacity (not grey shades), so it fades into any background; a knob at 12
  covers the seam, with a hole right through. Masters: `M:\Code\MEMOIR\MEMOIR's logos` (`Memoir logo.svg`
  white, for dark backgrounds; `... for light backgrounds.svg` ink). In the report it's HTML, not an image
  (`.logo`, shared/logo.css; in the report header, the empty card, the welcome and the popup header, live in all but the welcome). `.themed` (header, empty card, popup) follows the theme: on Light the master for light backgrounds (ink, no disc, the clock filling the disc's room so it isn't smaller than on Dark, the knob a hole through to the page; the owner asked for it), on Dark white on a black disc (the owner asked for a round black background
  there, not a square), a conic-gradient ring masked to a band. Entrance (`playLogo`, compositor only): the
  disc pops in, the band grows in as its fade turns into place, the hands sweep from 9:00 round to 10:10, and
  the knob pops onto the seam (its middle is the disc's black). The header clock (40 px with its disc) plays it
  with the page, and so does the "No activity yet" card's (56 px, in place of the old hourglass) as it comes in;
  on a first visit it's held (`.hold`) until the welcome's clock flies into it. Those two are live (`live: true`):
  their hands sweep to the current time and keep it, and the knob (on its own layer, `.lg-sec`) goes round the ring
  once a minute with the ring's fade turning with it; compositor animations (`rotate`), set right again once a
  minute and when the page is shown; reduced motion: the hands are set, nothing turns. The hands' pivot is 8
  units below the ring's middle (right for 10:10), so on a live clock it circles the middle once an hour,
  opposite the long hand (logo.js `pivotShift`: a 60-step `translate` loop on both bars, with the minutes): the
  10:10 pose turned with the minutes, the long hand's tip 50 units from the middle at every minute (9 inside the
  ring's 59; measured with a marker at the tip). Before, around :30 it reached ~8 units into the ring. The welcome's clock stays
  at 10:10. Icons (toolbar, tab, store, notifications): `icons/iconN.png`, the white clock on the black disc, one
  set for light and dark toolbars (the owner wanted the black behind it, as on the site); small sizes are drawn
  with thicker strokes (16 px has no hole in the knob).

## Over the limit: the flame's moment (`shared/overshow.js`, styles in `shared/goal.css`)
When the popup opens over the daily limit, and when the report opens from the over-limit notification
(`recap.html#over`, from `openRecap(null, { over })` in background.js; with the report already open the hash change
plays it, the flame rising out of its ring), the ring's own flame takes the stage: a dim with a warm glow comes up at
once (220 ms), the flame grows at the middle with "42m over · your 1h daily limit", holds, then flies home into its
ring. Four sizes by how far over (each flickers harder): under 30m small, 30m big, 1h bigger plus a dry line (10 in
`OVER_LINES`, never the same twice running), 2h a wall of fire taller than the stage, rising from below; embers off
the two biggest. Holds are long enough to read (2 to 3.8 s). One element (owner's rule): the flame leaves its spot
(an empty `.gr-flame-slot` its size keeps the room), plays, lands back in it. Made flawless frame by frame: its own
laid-out size (the ring may be scaling it in), the spot measured once the flame has left it, home measured as the
flight starts, start and home on Chrome's whole pixels, size reached before the end (it glides the last stretch, so
the big-to-small redraw is in flight), the starting look set before its animations first draw, the ring's flicker
(shape and core opacity) carried over when it rises out, and its own flicker at rest exactly as it lands. Clicks go
through; reduced motion: none.

## Popup's first open
The first time the popup opens (storage key `popupIntroduced`), once: a line above Weekly Report ("Your whole week,
day by day, is one click away.") and a soft ring going out from the button three times once the popup is in (its own
`::after` layer, so the button keeps its entrance; none with reduced motion). The ring is a pill 12 px bigger than
the button, under its label, scaled up from the button's size as it fades (`pulseWeek`, popup.js): compositor only,
where the growing box-shadow it replaced repainted every frame (1,631 paints in the first 7 s, now 82).

## Windows app
Its own folder and private repo since 2026-10-18: `M:\Code\MEMOIR\Windows Memoir`, minavian/windows-memoir (its `Data` folder is
the owner's history: never commit or overwrite it; test with `Memoir.exe --data-dir=`). Ported to this extension at commit
`53e8106` (three-way merge per file; its `PORTING.md` has the method, the Windows edits and the next merge base). When a
change here touches the data, the bridge or the wording, note it there.
`Memoir.exe` is the portable x64 Windows app, with its own native foreground tracker and the same web UI. See its README and VALIDATION for build/setup, test results, and optional exact browser connector setup. Minimizing disposes WebView2. The themed tray popup runs in a temporary WPF process that exits after dismissal, so its graphics heap is released. Both mouse buttons open it; double-click restores the app. All data remains local; preserve `Windows Memoir/Data` and exclude data/test profiles from distributed copies.

## Linked with Memoir for Windows (`link.js`, 6.0)
Sync with the Windows app, on this computer only (SYNC-PLAN.md has the design and what's built). The service
worker's `link.js` talks native messaging to `Memoir.exe` (host `com.minavian.memoir`; `nativeMessaging` is an
optional permission, asked for on Link). **Storage:** this side's own days stay `day:<date>` (only the tracker
writes them); the app's arrive as `link:windows:<date>`, listed in `linkPeers`. `getDays` and `listDayKeys`
(core.js) merge them for every page, the limit and Trend; `listDayRecordKeys` is every record of both kinds,
for Never track, Erase titles, Keep history, Clear all and the storage count. Never merge incoming days into
`day:` records: the tracker adds onto those, which would count shared minutes twice. Export writes the merged
view as plain days. Clear all and Erase titles leave `wipe` / `titlesErased` markers the other side applies.
While the app is open, it sends the limit's and the week's notifications (`appOnline()`). Windows apps show by
name and category (`setApps`, from the app's `apps`), as first-letter tiles. `cleanDay` / `mergeDay` /
`anonymizeDay` are shared by Import and the link, and must match Memoir for Windows' `SyncData.cs`:
`node tests/merge.test.mjs` runs the shared cases in `tests/merge-cases` (copy the file to Windows Memoir's
`tests/merge-cases` when it changes). End-to-end testing needs the app built and a copy of the extension that
holds `nativeMessaging` up front (a headless browser can't answer the prompt); `MEMOIR_EXTRA_EXTENSION_IDS` makes
the app trust that copy's ID.
**In Settings** (Your data, above Export): the Memoir for Windows row (`recap.js` `renderLink`). Its button reads
Link, Linking…, In sync (a check grows in) or Linked (the app is closed); pressed while linked it asks Unlink? in
Clear all's red for 5 s. The status comes from `link` (local) and `linkLive` (session storage, which `link.js`
`status()` writes); the description says when it last synced, and every text fits one line so the row never
changes height. Link first asks, in a popover like Import's (`#link-pop`, `askLink`), whether to merge both
histories (`merge`) or start from today (`fresh`: only days from the day of linking cross); the answer's click asks
for `nativeMessaging` and links. A hello the app doesn't answer (it's still starting) is said again every 5 s. While linked, Clear all's steps add
"Memoir for Windows is cleared too". In Memoir for Windows it's a "Memoir in browser" row for each browser linked
with it, any that runs Chrome extensions (from the `sync` record's peers, the browser's name underneath: what the
extension said, else the program that started its host), each with its own Unlink (`link.unlink`); with none, the
row's Guide opens how to connect one (`#guide-pop`), and Connect another browser opens it later. Under Track browsing, `#startup-row` (Start with Windows) is Memoir for Windows' only: hidden here, it asks the
app (`startup.get` / `startup.set`). Test it by pressing it for real against a throwaway
Memoir for Windows, as above.

## How Memoir works (`how-it-works.html`)
Opened from Settings (How Memoir works → Open, a new tab, under Tutorial; pointed at, Open grows to show the
site links' ↗, which comes in the same way: `.open-btn .ext`). Plain text in one column like the
privacy page: same stylesheet (`privacy.css`) and script (`privacy.js`, whose email popover only runs where the
page has one). It states the tracking rules in plain words: what counts (the tab in front, every kind of tab),
when the clock stops (another app, minimised, 60 s idle unless sound plays, locked or asleep, paused), Private
time, what's kept (titles up to 30 a site a day), the daily limit's colours and lock, why other screen-time
tools differ, and that the clock is real (dot = seconds, long hand = minutes, short = hours, local time), with
a big live clock under that section (`.hw-clock`, 170–340 px; privacy.js plays it in once it's in view). **Keep it true:** when a rule in background.js / core.js changes, change this page too. The row
also balances Settings' columns (measured 542 / 533 px).

## Store listing (`store/`)
The Web Store's words (`chrome-web-store-listing.md`, `chrome-web-store-privacy.md`) and images (`images/`).
`node store/shots.cjs` remakes the five screenshots and the promo tile from the current pages, in Inter (never
SF Pro: see the listing file), with made-up data: the week and the popup whole, then a day, the limit's ring and
Trend over time (Dark) up close. `frame.html` and `tile.html` serve only that script;
`store/` is left out of the package.

## Known notes
- Unpacked "Load" counts as an install (welcome tab will appear then).
- Keep the README in sync with user-visible changes; bump `version`/`version_name` in manifest when shipping.
