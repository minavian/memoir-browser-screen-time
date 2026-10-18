# Chrome Web Store: the Store listing tab

The words for the developer dashboard (Item > Store listing), checked against version 6.0.0. When a feature
named here changes, change this file and the dashboard together. The privacy answers are in
[`chrome-web-store-privacy.md`](chrome-web-store-privacy.md).

## Item

| Field | Value |
|---|---|
| Name | Memoir: Browser Screen Time (from `manifest.json`) |
| Summary | Quietly logs where your browsing time goes, keeps you to a daily limit, and shows your whole week at a glance. (from `manifest.json`, 110 of 132 characters) |
| Category | Productivity › Workflow & Planning |
| Language | English |

## Description

Paste as it is (the dashboard keeps line breaks, and shows no formatting):

```text
Memoir shows you where your browsing time goes.

It times the tab in front of you, and stops when you look away. Click the clock for today, or open the Weekly Report for your whole week on one screen.

Today, at a click
• Your time today, by category and by site
• How far above or below your daily average you are
• How much of your daily limit is left

Your week on one screen
• Daily average, total, busiest day, most-used site and highlights
• Each day stacked by category: click a day for its hours and its sites
• Activity by hour: click any square to see what you did in that hour
• Categories and Most used, for the whole week or a single day
• Trend over time: your daily average week by week, over 4, 12 or 24 weeks, or a year

A daily limit that holds
• Set it on a ring. Once you commit, it's locked, and it stays locked on the days after
• The ring turns yellow, orange and red as you get close, with a notification at 95% and when you go over

Only the time you spend looking
• The clock stops when another app is in front, the browser is minimised, the screen locks, or after 60 seconds without the mouse or keyboard (unless sound is playing)
• Never track a site: its time counts only as one nameless "Private" total
• Page titles, if you want them: see which pages took the time (off unless you turn it on)

Private by design
• Everything stays in your browser, on your computer
• No account, no servers, no analytics, no ads. Memoir makes no network requests
• Export your history to a file, import it again, or clear it all at once

Light and Dark themes, and a weekly reminder to look back at your week (you can turn it off). The first time, a hands-on tour shows you around on a sample week, so nothing of yours is touched.

Made by Mina Vian.
```

Two lines to add when they're true (not yet):
- Once sync with Memoir for Windows works: "Have Memoir for Windows? Link the two and see your whole computer's screen time in one place, right on your computer: no account, no cloud."
- The Rainbow clock, only if the owner wants it named in the listing (it's the visible stance; ask first).

## Graphics

| Asset | Size | Status |
|---|---|---|
| Store icon | 128 × 128 PNG | `icons/icon128.png` |
| Screenshots | 1280 × 800 PNG, 1 to 5 | `images/1-report.png` … `5-trend-dark.png` |
| Small promo tile | 440 × 280 PNG | `images/promo-440x280.png` |
| Marquee promo tile | 1400 × 560 PNG | optional, only used if Google features the item |

`node store/shots.cjs` makes them all again from the current pages (run it after any visible change). Two
show the whole thing, three come up close on one feature each, so they don't all look like the report:
1. The Weekly Report: the whole week on one screen.
2. The popup: today at a click (`frame.html`: the popup at 1.2 ×, on the report's background).
3. Up close: a day opened from Daily activity (the week's busiest), its hours and its sites; the card on its own.
4. Up close: the daily limit's ring, being set to 3 h 30 m, over the dimmed report.
5. Up close, on Dark: Trend over time, 24 weeks, sloping down; the card on its own.

The promo tile is `tile.html`: the clock at 10:10 and MEMOIR on Dark, with "Where your browsing time goes".

Rules for every image:
- **Inter, never SF Pro** (the owner's choice, 2026-10-18). Memoir uses Inter everywhere but on a Mac; the
  script sets Memoir's own Inter on every page, so the images are the same wherever they're made.
- **The clock** shows as in the app, **the Rainbow clock** stays off (the owner's yes, 2026-10-18).
- **No personal history:** half a year made up (about 3 h a day by now, more further back, a 3 h 30 m limit),
  and nothing of the shoot itself is tracked.
- Pages laid out at 1440 × 900 and drawn at exactly 1280 × 800 by Chrome itself, close-ups at a larger scale,
  so text stays sharp.

## Contact and links

| Field | Value |
|---|---|
| Support email | iamminavian@gmail.com |
| Homepage | Memoir's website, once it's live |
| Privacy policy | the website's privacy page, once it's live (see the privacy file) |
