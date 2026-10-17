# Sync between the extension and Memoir for Windows: the plan

Written 2026-10-17. Nothing here is built yet. The owner decided sync must work at launch (19 November).
Open questions are at the end; the plan assumes the recommended answers until they're settled.

## What "in sync" means

- **One history, two places to see it.** Link them once. From then on the extension shows the time the
  Windows app recorded (Windows apps, Edge, Firefox), and the app shows the browsing the extension
  recorded, including from before the app was installed.
- **One set of rules:** the daily limit and its lock, Never track, Page titles and how long they're kept,
  Keep history, the weekly recap, category moves, pausing.
- **On this computer only:** no account, no network, no local web server. That's what the website
  already promises ("right on your computer: no account, no cloud").
- **Either can be closed.** They catch up the next time both run. The app doesn't start with Windows,
  so syncing happens while it's open (a "Start with Windows" option would help tracking and sync alike).

## How they talk: native messaging

The only private way for an extension to reach a local app is native messaging (the alternatives are a
localhost server, which Windows Memoir's README promises never to open, or host permissions). The app
already does native messaging: Chrome starts `Memoir.exe chrome-extension://…` as the host
(`Program.cs`), which relays to the running app over a named pipe that only this Windows account can open
(`BrowserLink.cs`). Build on it:

1. **Extension:** `nativeMessaging` is an *optional* permission, requested when the user presses Link in
   Settings, so people without the Windows app get no extra install warning.
   `chrome.runtime.connectNative('com.minavian.memoir')` runs from the service worker. An open port keeps
   the worker alive (Chrome 105+; we require 116), so the link stays live while both run.
2. **The extension takes over the Browser Connector's job:** it sends the same active-tab message
   (focused, origin, title, audible, muted, incognito). The separate "Memoir Windows Connector"
   extension and the Register/Unregister scripts are retired. Users install two things, not three.
3. **The host becomes a long-lived two-way relay.** Today the pipe only goes one way (`PipeDirection.In`),
   carries one message per connection, allows one server instance and caps frames at 32 KB. Change that
   to InOut, one connection held open per host process, several instances (one per linked Chrome
   profile) and frames up to 1 MB. If the app isn't running, the host answers `{ app: 'offline' }` and
   keeps retrying the pipe every few seconds, so the link comes up by itself once the app opens.
4. **Registration:** the app writes its host manifest and the HKCU registry key itself at every start.
   No admin rights are needed, and moving the folder fixes itself. `allowed_origins` is the Web Store ID.
5. **A fixed extension ID:** create the Web Store item now (uploading a draft is enough) to get its ID
   and public key. Unpacked dev builds put that key in `manifest.json` as `key`, so they get the same ID.
   The packaging step strips `key` from the store zip.
6. **Size:** Chrome accepts at most 1 MB per message from the host, so history goes over one day per
   message.

**Risk:** if the Windows app ships as MSIX through the Microsoft Store, its HKCU registry writes are
virtualized and Chrome won't find the host. A portable download, or a Store listing that uses an EXE/MSI
installer, avoids this (question 1).

## What syncs, and how it merges

Each side keeps tracking into its own storage, exactly as now. Sync sends records across and the
receiver merges them into its own. Every merge below is commutative, associative and idempotent, so both
sides end up with the same data whatever the order, the repeats or the dropped connections. There's no
"which tracker is right" logic, and no handing over between trackers (a hand-over loses time when one of
them stops unexpectedly).

| Data | Merge |
|---|---|
| `day:YYYY-MM-DD` | `mergeDay` (`recap.js`, Import's merge): per hour and site, the larger time; page times and per-hour page times the same way; `tp` as a union; links get a fixed tie-break so both sides keep the same one. Totals are recomputed from the hours. |
| `apps` (Windows: app name, category, icon) | Comes from Windows. Icons travel as small `data:` URLs. |
| `origins` | Union; the newer one wins. |
| `categories` (moved sites and apps) | Per entry, the newer change wins. |
| `goal.history` | Per `from` day, the newer write wins. A limit committed on one side locks the other; the gauntlet's reset (`limit: null`) carries over. |
| `goalTrial` | The newer wins (Undo on either side removes it). |
| `goalNotify`, the weekly recap flag | OR per day (or per week): once shown anywhere, never again. |
| `settings`: `paused`, `titles`, `titleWeeks`, `retention`, `weeklyReminder`, `reminderDay`, `reminderMinutes` | Per field, the newer change wins. |
| `settings.excluded` (Never track) | A set: additions are joined; a removal wins only over an older addition. |
| Not synced | `onboarded`, `popupIntroduced`, the session, theme and cursor (localStorage, per place). |

**Why the larger and not the sum:** while both run, they measure the same browser minutes under the same
site and hour, so the larger figure is the real time, not double. Windows apps exist only on the Windows
side, so they simply arrive.

**"The newer change wins" needs to know when each change happened.** That stays out of the data shape: each
side keeps a `sync` record with a timestamp per synced field and entry, stamped when its own storage changes.
In the extension that's `chrome.storage.onChanged` in the service worker, which sees every page's writes; in
the app it's `Store.Changed`. Nothing that writes settings today has to change.

## Deleting (what a larger-wins merge can't do alone)

Taking the larger value can't delete anything: whatever is removed on one side would come back from the
other. So deletions travel as rules, and every incoming record passes through them before it's merged.

- **Never track:** the receiver makes incoming records anonymous with its own list first (as `writeImport`
  does with `anonymizeSites` today). The list goes across before any records in each exchange. Otherwise
  youtube.com 30m from one side and Private 30m from the other add up to an hour, and the name comes back.
- **Clear all:** writes a `wipe` marker (a time). A side that sees a newer marker deletes its days up to
  that hour and drops incoming time from before it. The confirmation must say it clears Memoir for Windows
  too. At most the rest of that one hour is lost on the other side.
- **Erase titles:** a `titlesErased` marker that works the same way, for page titles and links only.
- **Keep history / Keep page titles:** both are synced settings, so both sides prune the same way.
  Incoming days past the cutoff are dropped (or lose their titles) as they arrive.
- **Unlink:** syncing stops; both keep what they have.

## Who sends notifications

When the two are linked and the app is running, the app sends the limit and weekly notifications, since
it sees everything, even with Chrome closed. The extension sends them only when it hasn't heard from the
app for 2 minutes. The OR-merged flags stop repeats. The popup's flame moment works as it does now.

## The exchange

- **On connect:** `hello` both ways (protocol version, device id, kind, a name like "Chrome · Profile 1",
  app version). If the protocol versions differ, nothing syncs and Settings says which one to update.
- Next comes the `sync` record (settings, markers, Never track, limit, categories), then every key
  changed since the other side last acknowledged. Each side keeps a change counter; a first link sends
  everything, one day per message, newest first so this week shows up first. The receiver merges each
  batch under the data lock (`withData` in the extension, the UI thread in the app), then acknowledges it.
- **Live:** after each save (the extension's every minute, the app's every 30 s) the changed day goes
  across. A side never sends back a record it has just received unchanged, so nothing ping-pongs.
- **Several Chrome profiles:** each one is its own peer. The app is the hub and passes each profile's
  time on to the others. Known limit: two profiles used in the same hour *while the app was closed* count
  as the larger of the two, not the sum.

## What changes where

### Windows (needs the data half of the re-port first)
- `Engine.Normalize` must keep every field. Right now it keeps only `s/h/hs/ti`, so every Windows save
  would strip `th/tu/tp` from a synced day.
- Port the writing of `th/tu/tp` and the `titleWeeks` pruning, and make Never track and Erase titles
  (`Redact`) cover `th/tu/tp` too. As it stands, an excluded site's name would survive there and travel.
- `BrowserLink`: two-way, persistent, bigger frames, several instances, and self-registration at startup.
- New `Sync.cs`: peers, the change counter (from `Store.Changed`), the merge (a C# port of `mergeDay` and
  the import's cleaning), the markers, and the notification hand-off.
- Tracker: while the linked extension reports for a browser, don't record that browser's fallback key
  (`app:chrome.exe`), or the same minutes would count twice under two names.
- Settings: a "Chrome extension" row (linked profiles, last sync).

### Extension
- `mergeDay`, the cleaning in `readImport` and `anonymizeSites` move from `recap.js` into shared code, so
  the service worker can use them.
- A new sync module in the service worker: Link/Unlink, the port, the connector messages, the exchange,
  the change counter, the markers.
- App keys (`app:name.exe`) work everywhere. The Windows edits listed in `Windows Memoir/PORTING.md`
  (categorize, normalizeSite, isExcluded, app names, icons, `readImport`'s `siteKey`) move into the shared
  code, which also makes every later re-port smaller.
- Wording: while linked, "browsing" becomes "screen time" wherever totals are named (popup, summary,
  notifications).
- Settings: a "Memoir for Windows" section with Link (the permission prompt), a status (Not found /
  Not running / In sync · 12:04) and Unlink. Clear all's confirmation mentions both.
- Privacy texts: `PRIVACY.md`, `privacy.html`, the website's privacy page, and
  `store/chrome-web-store-privacy.md` (a `nativeMessaging` justification; the single purpose stays time
  tracking; still no network).

## Tests

- **Shared merge cases:** a folder of JSON files (two records in, one out) that both the C# tests
  (`EngineTests`) and a small Node test of the shared JS run, so the two merges always agree.
- **End to end** in headless Edge, with the unpacked extension (fixed key) and `Memoir.exe --data-dir` on a
  test folder:
  - a first link with a year of history on both sides
  - both tracking the same hour
  - hours with only Windows apps
  - Never track added on one side while unlinked
  - Clear all
  - Keep history shortened
  - a limit committed on one side locking the other, and the gauntlet's reset
  - pausing
  - the app killed, and the service worker killed, mid-exchange
  - two profiles
- **One invariant everywhere:** no hour holds more than 60 minutes. Breaking it means double counting.

## Order and dates (33 days to 19 November)

1. **Oct 18–20, spike:** check that `nativeMessaging` granted at runtime works and that `connectNative`
   keeps the worker alive in current Chrome. Create the Web Store draft to get the ID. Settle question 1.
2. **Oct 20–26:** Windows data parity (`Normalize`, `th/tu/tp`, `Redact`, `titleWeeks`). The shared merge
   cases, running on both sides.
3. **Oct 27–Nov 2:** transport (two-way host, registration, the extension's link and connector role), the
   exchange, live sync.
4. **Nov 3–7:** deletions; settings, limit and Never track; notifications; app keys and wording in the
   extension; Settings on both sides; privacy texts.
5. **Nov 8–10:** end-to-end tests. Submit the extension for review with publishing deferred (reviews of
   items with `nativeMessaging` can take longer).
6. **Nov 10–19:** buffer and Windows packaging; publish both on the 19th.

This pulls Windows work forward. "Finish the extension, then re-port" can't hold if sync has to work at
launch: the Windows data model must match the extension's before the two can share it.

## Open questions

1. **How does the Windows app ship on the 19th?** A portable download from the website (as now), a
   Microsoft Store listing with an EXE/MSI installer, or MSIX? MSIX needs extra work for Chrome to find
   the app.
2. **When linked, does Chrome show Windows apps too?** Recommended: yes, one total and one limit. With
   websites only, the same limit would read differently in each place.
3. **Pausing, Clear all, Never track and the limit shared by both?** Recommended: yes. The alternative is
   that pausing in Chrome only pauses browsing, but the app would keep recording that browsing anyway.
4. **Theme and cursor: per place or shared?** Recommended: per place.
