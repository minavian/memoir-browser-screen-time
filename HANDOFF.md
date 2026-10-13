# Memoir: Browser Screen Time — handoff notes

Chrome MV3 extension by **Mina Vian** ("Made by Mina Vian" credit stays everywhere).
Logs browsing time and shows today in a popup and the whole week in a full-page report.
Current version: **5.1.5** (`manifest.json`). Load unpacked from this folder; after edits,
press reload on the extension in `chrome://extensions` and refresh the report tab.

## What the owner cares about (apply to every change)
- **Themes:** Light / Dark / Pink. Default follows the system and is never Pink.
  **From 2026-10-12 on, work on Light and Dark only.** Leave Pink as it is: don't test, tune or
  screenshot it (it burns tokens for nothing); it will be replaced with a new theme soon.
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
- `popup.*` — 380×600 "today" popup.
- `recap.html/css/js` — the weekly report (main orchestrator, ~3000 lines).
- `trend.js` — Trend over time line chart. `tour.js` — guided tutorial. `gauntlet.js` — "reset the limit" questions.
- `welcome.js` — first-run welcome screen (styles at the end of `recap.css`). `welcome-intro.js` — its opening;
  `fonts/Unbounded-subset.woff2` — the trailer's face, MEMOIR/WELCOME TO only.
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
  is unset the report shows the welcome (`welcome.js`): the clock pops and sets itself, letters rise, cards cascade,
  pin hint points at the toolbar. "Take the tour" flies the clock into the header logo while the page
  reveals, then the tutorial runs; "Skip for now" (or Esc) just sets `onboarded`. Replay the tour from Settings.
- Welcome (5.1.2): a single card on the tour's own dim (`--tour-dim`, no colour orbs, no feature cards). Its surface
  is `.wel-card::before`, so the clock inside can fly off on its own (blurring and fading into the header logo).
  "Take the tour" starts the tour at once, under the card, while the words fade; the dims swap in one frame
  (`.tour.handoff` skips the spot's fade); once the words are gone and the page is calm (`calm()`), a shell reshapes
  the card into the tour's first card (`handoff(card)` from `runTour`). The board's first render waits until it has
  landed (`onHanded`), so it never competes with the reshape. The real week renders behind the dim just after the
  welcome starts playing in (`onShown`, 120 ms), so the page isn't blank and its follow-up work (about 2.5 s of
  small tasks) is done before most clicks; the tour path redraws it as the sample week after landing.
  Card radius 40 px (reshapes to the tour card's 18). Pin hint: a straight up arrow, `right: 72px` (tip ~104 px
  from the right edge), aimed at the Extensions (puzzle) button.
  Measured: reshape frames are a steady 6 ms once the GPU shader cache is warm; a brand-new browser profile may drop
  a frame or two on its very first run (GPU shader compilation, not page work).
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

- Data lock (5.1.2): every read-then-write of tracked data holds `withData` (core.js, a Web Lock named
  `memoir-data`): the tracker's queue (`enqueue` in background.js) and the report's import, Never-track
  anonymizing, title erasing and Clear all. Never await the tracker (`sendMessage({type:'sync'})`) inside it.
- Import (5.1.2): `readImport` only keeps names the tracker could have written (`siteKey`: `domainFromUrl`
  round-trip; titles through `safeKey`). Days that already have time open the merge/replace popover
  (`#import-pop`, MorphPopover from the Import button). Merge = larger time per site per hour (`mergeDay`),
  idempotent; days without per-hour detail keep the fuller record.
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
  cap is unchanged ("other pages" has no link). Titles, hours and links are kept `settings.titleWeeks` (4, 8, 12,
  16; `pruneTitles`/`dropTitles`, run by the tracker at start, daily, and when the setting changes, and by
  Settings when you pick a shorter time, after a confirm). Never track, Erase titles, merge/replace imports and
  Clear all cover `th`/`tu`/`tp`.
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
  existed shows that day's pages with a note. Titles gone: a message, with Open Settings when a longer time could
  have kept them (within 16 weeks and the setting is shorter than 16). The pages close when their rows are rebuilt.
  A popover on its way out (`.pop[data-state="closing"]`) lets clicks through.
  Live refreshes (`refreshSoon`) now wait while a menu or popover is shown or still animating (they used to be
  dropped while one was open, leaving stale numbers until the next save).
  Export carries `format: 2`; files without it are announced as older, brought up to date (titles past the
  setting dropped) and imported. Toasts that change while showing cross-fade and ease to the new width.

- Tour (5.1.2): steps marked `autoNext` ("An hour up close") move on the moment Next has filled, without
  the full-arrow pause. The Cursor step covers Custom and Smooth cursor (a task each; a press on the locked
  Smooth cursor doesn't count).

- Limit clock inside the tour (5.1.2, recap.js `openGoalPicker`, goal.js `onClosing` / `focusBack`): while the clock
  is up the tour's dim and card are hidden (`picking`). Coming back, in turn: the dim crossfades in under the clock's
  scrim as it closes (`tour-return`), the card pops in (`scale`) once the clock has landed, then the outline
  (`tour-return-ring`). Focus goes back to the tour's Next, not the page: from the page, ← → change the week.

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
  - Content: theme tokens are scoped to `[data-wave="light|dark|pink"]` as well as `:root` (theme.css, recap.css),
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

- Never track, hidden (5.1.5): the sites under Never track are hidden under dust, a shimmer of fine
  specks over a soft haze, filling the whole pill, the × too (thinning towards its rounded edge).
  One click stirs it and asks "Click again to show it" (2.6 s); the second blows the dust away from where it
  landed while the name clears up from there (clip-path circle + unblur). A click on a shown name, or closing
  Settings, hides it again (fresh dust settles in). Enter twice works too. The × is hidden with the name
  (visibility, its place kept): it appears only on a shown site, 0.5 s after the reveal, so a triple tap
  can't remove the site; clicks in that half second neither remove nor re-hide it (`REVEAL_GUARD_MS`).
  A site that's just landed (`.landing`) shows no × before it turns to dust. The newest site is first; a typed site lifts off the field the
  moment you add it (the field empties under it in the same frame, `liftTyped`), glides into the first slot
  (the others make room, FLIP) and lands exactly on the chip's name, then turns to dust after a beat.
  Drawing: `shared/dust-engine.js` (`Dust` per pill, `Runner` loop) runs in a worker (`dust-worker.js`) on
  transferred OffscreenCanvases, so it costs the page nothing; `shared/dust.js` sizes them (ResizeObserver),
  skips pills off screen (IntersectionObserver) and pauses everything when Settings is closed (900 ms after)
  or the tab is hidden. Specks are white; `--dust-ink` (a CSS filter token, recap.css) tints them per theme.
  Reduced motion: a still frame, instant reveal/hide.

- The opening (5.1.5, `welcome-intro.js`): before the welcome card, on black with a light drifting in, WELCOME TO and
  a big MEMOIR (the wordmark) arrive letter by letter from left to right while the welcome runs the page's work behind
  it (`play({ load })`: the week drawn, the tour's sample weeks made ahead and cached, `calm()`). The O is not a letter:
  the word keeps only its room (`.wi-o`, the O's advance) and the card's own clock (`.wel-mark`) sits in it, scaled up,
  its ring drawn as Unbounded Black's O (heavy: `--lg-band` 42%, a registered property; wide: `scale` 1.16; the word's
  platinum across it in the ring's `::after`, the letters' glow as a box-shadow). As soon as the word is in (or once the
  work is done, if later) it turns: band and width in one animation to the ring's own (77.632%, round) as its platinum
  gives way to the ring's fade and the clock sets itself (playLogo `fromO`); then the letters fly one after another
  (0.6 s after the clock is set), left to right, onto their own in the card's MEMOIR, the clock in the O's turn on to
  its own place (the same element, one transform to `none`: nothing hands over, so nothing can jump; owner's rule, see
  below), WELCOME TO onto the kicker, the black lifting off; the card's entrance waits for `.cascade`. Clicks and keys
  during it do nothing; `.wel.landed` marks the end (~5.8 s). Reduced motion: no opening. Tried and dropped by the
  owner: sound, grain clouds, the word as a coloured loading bar ("too ugly"), and an O glyph crossfading into a
  separate clock ("a small correction" showed as they swapped). Owner's rule: a thing that turns into another is one
  element on one path, never two matched up (that breaks on high-DPI screens). The flying letters and the kicker still
  hand over to the card's own at landing.
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
  (`.logo`, shared/logo.css; in the report header, the empty card, the welcome and the popup header, live in all but the welcome): white on a black disc in every theme (the owner asked for a round black background
  there, not a square), a conic-gradient ring masked to a band. Entrance (`playLogo`, compositor only): the
  disc pops in, the band grows in as its fade turns into place, the hands sweep from 9:00 round to 10:10, and
  the knob pops onto the seam (its middle is the disc's black). The header clock (40 px with its disc) plays it
  with the page, and so does the "No activity yet" card's (56 px, in place of the old hourglass) as it comes in;
  on a first visit it's held (`.hold`) until the welcome's clock flies into it. Those two are live (`live: true`):
  their hands sweep to the current time and keep it, and the knob (on its own layer, `.lg-sec`) goes round the ring
  once a minute with the ring's fade turning with it; compositor animations (`rotate`), set right again once a
  minute and when the page is shown; reduced motion: the hands are set, nothing turns. The welcome's clock stays
  at 10:10. Icons (toolbar, tab, store, notifications): `icons/iconN.png`, the white clock on the black disc, one
  set for light and dark toolbars (the owner wanted the black behind it, as on the site); small sizes are drawn
  with thicker strokes (16 px has no hole in the knob).

## Possible next step
A small one-time welcome touch in the popup the first time it opens (a line + pulse on Weekly Report).

## Windows app
`Windows Memoir/Memoir.exe` is the portable x64 Windows app (5.0.2), with its own native foreground tracker and the same web UI. See its README and VALIDATION for build/setup, test results, and optional exact browser connector setup. Minimizing disposes WebView2. The themed tray popup runs in a temporary WPF process that exits after dismissal, so its graphics heap is released. Both mouse buttons open it; double-click restores the app. All data remains local; preserve `Windows Memoir/Data` and exclude data/test profiles from distributed copies.

## Known notes
- Unpacked "Load" counts as an install (welcome tab will appear then).
- Keep the README in sync with user-visible changes; bump `version`/`version_name` in manifest when shipping.
