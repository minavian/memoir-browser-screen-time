# Memoir: Browser Screen Time

Quietly logs where your browsing time goes, keeps you to a daily limit if you
want one, and shows your whole week at a glance, on one screen with no
scrolling. Light and Dark themes, and an optional **Rainbow clock**.

The Windows app is in **Windows Memoir**. Open `Memoir.exe` there; see
[its instructions](Windows%20Memoir/README.md) for Windows app tracking and the optional browser connector.

## Install

1. Unzip this folder somewhere it can stay. Chrome loads it from here.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `memoir-browser-screen-time` folder.
4. Pin it from the puzzle-piece menu in the toolbar.

Right after installing, the report opens with a short opening (MEMOIR on black,
its O turning into the clock), then a welcome (and a hint for
pinning Memoir to the toolbar), then a hands-on tour shows you around on a
sample week, so nothing of yours is touched. Whatever is lit up can be clicked:
each step suggests something to try, and its dot turns green once you have.
The tour ends with a walk through Settings. You can skip it, or replay it any
time from Settings. After that, click the clock for today, then **Weekly Report** for
the week.

**Replacing an older version (Browser Screen Time 3.x)?** Remove the old one
from `chrome://extensions` (or turn it off) so only one is tracking. To keep
your history:
- **Easiest:** replace the files inside the folder you originally loaded, then
  press the reload arrow on that extension. Chrome keeps the data because it's
  the same folder.
- **Or:** in the old version choose **Export**, then here open Settings →
  **Import**. Exports from any earlier version work.

Days recorded before this version have no per-hour site detail, so opening one
of their hours shows the time but not the sites.

## Daily limit

The **Today's limit** card (and the row in the popup) shows how much of your
limit is left. Press **Set limit** and a circle opens:

- Slide around the ring, or type. Hours come first; once you've picked them it
  moves to minutes by itself. Click the minutes to start there instead.
- Sliding snaps to the dots: every hour, and every 5 minutes. To fine-tune,
  slow down: creep along the ring and the minutes go one at a time, until you
  sweep quickly again. Arrow keys go a minute at a time too (hold Shift for
  five), so the smallest limit is 1 minute.
- Press **✓** at the top, then **Commit**. The limit is then locked, and it stays
  locked on the days after too: it doesn't open up again at midnight.
- Trying it during the tour is safe: for 24 hours, Settings shows **Undo**, which
  removes that limit in one click. After that, the usual questions apply.

The ring is green, turns yellow at 75%, orange at 90% and red at 95% (you get a
notification). Past the limit it turns deep red with a flame, and you're
notified once more.

## The report

- **Summary:** daily average, total, busiest day, most-used site and
  highlights. Bold words do something: a category opens its sites, a day or
  an hour opens that view, and site names open the site (look for the ↗).
  Hover the change from last week and it becomes a button for **Trend over
  time**: your daily average week by week over 4, 12 or 24 weeks, or a year.
  Click a week on the line to open it.
- **Daily activity:** each day stacked by category, with average and limit
  lines. A red dot marks days over the limit. Click a day for **that day's
  activity**: its hours and its sites.
- **Activity by hour:** click any square for what you did in that hour. Click
  a day name for the whole day. An outline shows what's open and glides along
  as you move.
- **Categories:** hover a slice to highlight it everywhere; click it for its
  sites. **Week / Day** starts on **Day**: today, or whichever day you have open
  in Daily activity. Switch to **Week** for the whole week.
- **Most used** follows the same switch.
- **Most used:** click a site's category to move it, or to never track it. With
  page titles on, click the rest of a site's row and the card turns into that site's
  pages, with the time on each (for the week or the day); a page opens again with a
  click, and ‹ goes back. Sites in a day or an hour
  of Daily activity do the same, for that day or hour.
  Long lists scroll.

In a day or an hour, **‹ ›** (or the ← → keys) step to the previous or next one.
**Back** (or Esc) returns one step; the round **«** button goes straight back to
the daily chart.

On smaller windows (under about 1100 px wide) the cards stack and the page
scrolls. Scrollable pages, Settings, and lists use a long, smooth glide with the
mouse wheel and scrolling keys, and follow your computer's reduced-motion setting.

## Settings

Open the gear in the top-right corner of the report.

- **Appearance:** System (default, follows your computer), Light or Dark.
  **Rainbow clock**, in support of the LGBTQ+ community, puts the clock's ring and the
  MEMOIR wordmark in rainbow colours, in either theme, here and on the toolbar icon. It's
  off unless you turn it on. (If you had Pink or Pride picked, you're on System.)
- **Custom cursor:** the animated cursor. Turning it off is highly recommended on
  low-end devices; you get your system's pointer instead.
- **Smooth cursor:** off by default. The custom cursor glides after your mouse, a
  touch behind it, instead of sitting exactly on it. Needs Custom cursor on.
- **Tracking detail:** *Domains only* (default) or *Page titles*, which saves the
  titles of pages and their links, so you can see which pages took your time (click
  a site in Most used, or in a day or an hour) and open them again. They're kept as
  long as your history (Keep history, below) and deleted with it.
- **Track browsing:** pause and resume. Only here: the popup and the right-click
  menus can resume tracking but never pause it.
- **Never track:** sites you add are still timed and still count toward your
  totals and limit, but only as *Private*. Their names are never saved or shown,
  and their past time is made Private too. In Settings each one stays hidden under
  a shimmer of dust, its remove button too: click it twice to see it, and the ×
  appears half a second later (a click hides it again, and so does closing
  Settings). The newest is first.
- **Weekly recap reminder:** the day and time you get your recap notification.
- **Daily limit:** once committed, a limit can only be undone here, after a
  long run of increasingly pointed questions. They never come in the same order
  twice. Days before keep the limit they had.
- **Keep history:** Forever (default), 1 year, 6 months or 3 months. Hover an
  option to see about how much space it uses. Under it: how much Memoir uses so
  far, and how much of that is page titles. If a shorter option would delete
  older days, it asks twice before anything is removed.
- **Sample week** and **Tutorial:** look around with made-up data, or replay
  the tour.
- **How Memoir works:** opens a page that explains, in plain words, what counts as
  time, when the clock stops, what counts as Private, what’s kept, and how the daily limit
  works.
- **Your data:** Export, Import, and **Clear all**, which asks twice. Clearing
  keeps your settings and today's limit. If a file has days that already have
  time here, Import asks first: **Merge** keeps the larger time for each site in
  each hour, so importing the same file twice never counts anything twice;
  **Replace** uses the file's version of those days. Other days are always added.
  Your daily limits come along too: into a Memoir with no limit yet, all of them,
  today's included (locked, as a limit you commit is); into one with its own
  limits, only the days before them, so an import can never change today's limit.
- **Found a bug?** Hover (or tab to) **Mina Vian** at the bottom of Settings for
  the address to send it to.

## What counts as time

Only the active tab of the focused Chrome window is timed, whatever it shows. Tabs
that aren't websites count too, each kind under one name: **Memoir** (this report),
**New Tab**, **Browser pages** (Settings, History, Downloads and the like),
**Extensions** (other extensions' pages) and **Files** (files opened from your
computer). They have no link, and can't be added to Never track. The clock pauses when:

- another app is in front, or Chrome is minimised
- you've been idle for 60 seconds (unless video or music is playing)
- the screen locks or the computer sleeps
- you pause tracking

Incognito windows aren't tracked unless you allow Memoir in them (Details →
Allow in Incognito on `chrome://extensions`); then their time counts only as
Private.

Everything is stored locally in this browser. Nothing is ever sent anywhere.

**Keyboard:** ← / → switch weeks (or step through a day or hour) · arrow keys
move around the hour grid and Enter opens a square · Esc closes menus, settings
and detail views. Your mouse's **Back** button does the same as Esc (and goes to
the previous step in the tour); with nothing left to close, it's the browser's
usual Back.

Right-click anywhere for a menu that matches your theme; right-click again while
it's open and it glides to the new spot. Site rows offer open,
copy, and category actions; text fields offer editing actions. Elsewhere, quickly
open Settings or the weekly report, pause tracking, or refresh. Use ↑ / ↓ to move
through the menu, Enter to choose, and Esc to close it.

Text is set in Inter (SIL Open Font License, see `fonts/Inter-LICENSE.txt`),
bundled with Memoir so it looks the same on every PC; on a Mac it uses the
Mac's own font, SF Pro.

## Licence

Memoir for Chrome is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any
later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. The licence's full text is in [LICENSE](LICENSE).

Copyright © 2026 Mina Vian.

**Over a network too.** A changed version that people use over a network, on a website or as an online service, has to
offer them its source, just as a copy that's shared does (section 13 of the AGPL).

**The name and the clock.** The licence covers the code, not the name "Memoir" or its clock logo (an additional term
under section 7(e) of the AGPL): a changed version may be shared under the AGPL, but under a name and a logo of its own.

**What it's built with** keeps its own licences: the Inter and Unbounded fonts, under the SIL Open Font License 1.1 (`fonts/Inter-LICENSE.txt`, `fonts/Unbounded-LICENSE.txt`).

Memoir's other half: [Memoir for Windows](https://github.com/minavian/windows-memoir) and [Memoir for
Chrome](https://github.com/minavian/memoir-browser-screen-time) are both open source under the same licence.

Made by Mina Vian
