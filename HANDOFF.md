# Memoir: Browser Screen Time — handoff notes

Chrome MV3 extension by **Mina Vian** ("Made by Mina Vian" credit stays everywhere).
Logs browsing time and shows today in a popup and the whole week in a full-page report.
Current version: **5.0.2** (`manifest.json`). Load unpacked from this folder; after edits,
press reload on the extension in `chrome://extensions` and refresh the report tab.

## What the owner cares about (apply to every change)
- **Themes:** Light / Dark / Pink. Default follows the system and is never Pink.
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
- `shared/theme.css` — tokens per theme, buttons, switches, cursor styles. `shared/theme-boot.js` sets theme/cursor before paint.
- `shared/cursor.js` — custom animated cursor (toggle in Settings).
- `shared/goal.js` / `goal.css` — limit ring and circular limit picker.
- `popup.*` — 380×600 "today" popup.
- `recap.html/css/js` — the weekly report (main orchestrator, ~3000 lines).
- `trend.js` — Trend over time line chart. `tour.js` — guided tutorial. `gauntlet.js` — "reset the limit" questions.
- `welcome.js` — first-run welcome screen (styles at the end of `recap.css`).
- `fonts/` — Inter variable subset (OFL) used by the Clear-all label.

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
- Keep history: shorter period asks **twice** (Remove → glowing "Delete forever", 9 s auto-disarm).
- Clear all: two-step (sure → SURE variable-font morph).
- Sample week uses the user's real limit (no fake limit).
- First run (4.3.0): a fresh install opens `recap.html` (`onInstalled`, reason `install`). While `onboarded`
  is unset the report shows the welcome (`welcome.js`): hourglass pops and pours, letters rise, cards cascade,
  pin hint points at the toolbar. "Take the tour" flies the hourglass into the header logo while the page
  reveals, then the tutorial runs; "Skip for now" (or Esc) just sets `onboarded`. Replay the tour from Settings.
- Limit lock (4.3.0): a committed limit stays locked on later days too (`limitLocked` = any limit in effect).
  Only the Settings gauntlet unlocks it (`resetLimit` writes `{from: today, limit: null}`; past days keep theirs).
- Limit picker (4.3.0): knob rides a critically damped spring (`FOLLOW`/`SETTLE`/`GLIDE` in goal.js), follows the
  pointer continuously and settles onto the value on release; dragging past an end through the top gap pins it.
  Minutes are 0–59 in 1-minute steps (`GOAL_MIN_MS` = 1 min). Tick dots sit on the track, numbers outside,
  Cancel in the centre column. The ✓ centres with `translate`, hovers with `scale`, and pops via WAAPI `transform`,
  so its animations never restart or fight each other.
- Picker look (4.3.0): colours follow the theme (light picker on Light, dark on Dark, deep pink on Pink;
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
- Custom cursor: smoothed follow (`SMOOTH_MS = 22` in cursor.js), whole-pixel free, hover = tilt/shrink on
  `.cc-inner`, press = extra squeeze on `.cc-arrow` (same everywhere), popup edge guard hides it when the
  pointer leaves fast. Off setting works in all themes.

- First load is queued (4.3.0): cards enter 110 ms apart, row by row (`--i`: header 0, summary 1, chart 2,
  categories 3, limit 4, by hour 5, most used 6). While `body.intro` is on (first render + 2.6 s), everything
  inside a card waits for its card: CSS adds `--intro-wait` (= --i x 110 ms) to its delays, JS uses
  `introWait(sel)`. Heat squares ripple (--d) on the first render too. On a first visit the first render runs
  as the welcome leaves (`show()` in init), so the entrance is seen instead of playing behind the welcome.

- Tour (4.3.0) is hands-on: steps with `tasks` (or `interactive`) cut a hole in `.tour-block` over the light
  (clip-path evenodd), so what's lit is clickable; each task `{ text, watch(done) => cleanup }` turns its dot
  green when done (onClick/onHover/onScroll/onChange helpers in startTour). Next always works. Steps that could
  change real data (limit, tracking, history, Clear all) stay closed. While `body.touring`, .pop/.menu/.tip sit
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

- Data lock (5.0.3): every read-then-write of tracked data holds `withData` (core.js, a Web Lock named
  `memoir-data`): the tracker's queue (`enqueue` in background.js) and the report's import, Never-track
  anonymizing, title erasing and Clear all. Never await the tracker (`sendMessage({type:'sync'})`) inside it.
- Import (5.0.3): `readImport` only keeps names the tracker could have written (`siteKey`: `domainFromUrl`
  round-trip; titles through `safeKey`). Days that already have time open the merge/replace popover
  (`#import-pop`, MorphPopover from the Import button). Merge = larger time per site per hour (`mergeDay`),
  idempotent; days without per-hour detail keep the fuller record.
- Private windows (5.0.3): when allowed in incognito, those tabs record as `~private`.
- Title-only tab updates sync only while titles are on (`titlesOn` in background.js).
- Background tab (5.0.3): `onStorageChanged` folds changes while `document.hidden` and applies them once on
  `visibilitychange` (`applyHiddenChanges`), so a hidden report does no DOM work per tab switch and is current
  as soon as it's seen. `goalTick` and the cursor's recheck timer also stop while hidden.
- Scrolling (5.0.3): in-page lists no longer use `overscroll-behavior: contain` (popover lists still do), and
  scroll.js latches a wheel gesture to what it started on (`GESTURE_GAP_MS`): a list that runs out holds the
  rest of that gesture, the next one carries on to the page.
- Right-click menu (5.0.3): right-clicking while it's open glides it (translate + height, WAAPI) to the new spot;
  the old rows ride along in `.context-ghost` and fade while the new ones enter.
- Bug reports (5.0.3): hovering/focusing "Mina Vian" in the Settings footer morphs `#author-pop` out of it
  (120 ms hover intent, 220 ms grace to cross into it; Tab steps in, Escape returns to the name).
- MorphPopover is fully interruptible (5.0.3, all popovers): open/close take over the shell still in flight
  (`takeShell`) and continue from its current rect, radius and opacity, so there's only ever one surface. The
  remaining trip sets the duration, and an interrupted trip turns from rest (`TURN` easing) instead of snapping.

## Possible next step
A small one-time welcome touch in the popup the first time it opens (a line + pulse on Weekly Report).

## Windows app
`Windows Memoir/Memoir.exe` is the portable x64 Windows app (5.0.2), with its own native foreground tracker and the same web UI. See its README and VALIDATION for build/setup, test results, and optional exact browser connector setup. Minimizing disposes WebView2. The themed tray popup runs in a temporary WPF process that exits after dismissal, so its graphics heap is released. Both mouse buttons open it; double-click restores the app. All data remains local; preserve `Windows Memoir/Data` and exclude data/test profiles from distributed copies.

## Known notes
- Unpacked "Load" counts as an install (welcome tab will appear then).
- Keep the README in sync with user-visible changes; bump `version`/`version_name` in manifest when shipping.
