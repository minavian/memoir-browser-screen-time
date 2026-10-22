# Sync between the extension and Memoir for Windows: the plan

Written 2026-10-17, updated 2026-10-18 (page titles no longer have a keep-time of their own: they go with
their day, under Keep history). The owner decided sync must work at launch (19 November).
Open questions are at the end; the plan assumes the recommended answers until they're settled.

## Built (6.0, 2026-10-18)

- **Transport:** the extension's `link.js` (service worker) and Memoir for Windows' `BrowserLink.cs` (a pipe
  that takes any number of held-open, two-way connections; the host relays both ways and says whether the
  app is open) and `Registration.cs` (host manifest and HKCU keys written at every start and every 10 minutes,
  in every Chromium browser's own registry folder: the known ones, plus any a scan finds holding a launch beacon
  or other apps' native hosts; the IDs it trusts are in `extension-ids.txt`, today the unpacked development ID).
  Any browser that runs Chrome extensions can link, several at once (one per profile).
- **The exchange** (`link.js`, `Sync.cs`): hello, rules, days in batches under 1 MB, acknowledgements, a
  per-peer list of days still to send that survives restarts, the extension's connector role, Unlink (both
  keep what they have), Clear all and Erase titles as markers, the notification hand-off.
- **One rule set:** `cleanDay`, `mergeDay`, `anonymizeDay` in `shared/core.js` and the same in C#
  (`SyncData.cs`), held together by the shared cases in `tests/merge-cases` (run by `node tests/merge.test.mjs`
  and Memoir for Windows' `tests/run.ps1`).
- **Settings:** the extension's Your data has a Memoir for Windows row: Link asks to merge both histories or
  start from today, then the button says In sync (with when it last synced) or Linked while the app is closed,
  and Unlink? when pressed again. Memoir for Windows' Settings show a "Memoir in browser" row per linked browser,
  each with its own Unlink, and a guide to connecting one. A rule changed in one browser reaches the others.
- **Not yet:** the Web Store ID in `extension-ids.txt` (a store item is needed), the "screen time" wording
  while linked, app icons in Chrome (names and categories do travel), the installer.

**A correction to "merge into its own" (below):** a side's tracker adds its new minutes to the stored day. If
incoming days were merged into that same record, the next tracker save would add onto the other side's
figure: Chrome's 60 s for 10:00–10:01, merged into Windows' 30 s, then Windows' other 30 s on top makes 90 s.
So each side keeps its own measurement where its tracker writes (`day:<date>`) and the other side's apart
(`link:<peer>:<date>`), and what's shown (and counted against the limit) is both merged. The larger-wins rule
then always compares two independent measurements, which is what makes it right. Each extension gets the
app's own days merged with other extensions' (never its own back).

## What "in sync" means

- **One history, two places to see it.** Link them once. From then on the extension shows the time the
  Windows app recorded (Windows apps, Edge, Firefox), and the app shows the browsing the extension
  recorded, including from before the app was installed.
- **One set of rules:** the daily limit and its lock, Never track, Page titles,
  Keep history (titles included), the weekly recap, category moves, pausing.
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

## Shipping the Windows app: one installer for both channels

Decided 2026-10-17: Memoir for Windows ships both as a download from the website and in the Microsoft Store.

**Recommended: one signed per-user installer (EXE), used by both.** The Microsoft Store has accepted
plain EXE/MSI installers since 2021. The listing points at the installer on our own HTTPS address and the
Store runs it, so the Store copy and the website copy are the same file. They install the same way and
register with Chrome the same way (HKCU, as above, exactly like the portable build today). That gives one
build to test.

- **Per-user, no admin:** installs to `%LOCALAPPDATA%\Programs\Memoir` and keeps data in
  `%LOCALAPPDATA%\Memoir`, so updating or uninstalling never touches history. The host and the app must
  work out the same data folder, because the pipe's name is derived from it (`BrowserLink.Name`).
- **Store rules for installers:** offline (nothing downloaded during setup), a silent-install switch, an
  address that never changes for a given version, nothing else bundled, and **signed with a certificate
  from a CA in Microsoft's Trusted Root Program** (the Store doesn't sign EXE/MSI for you; self-signed is
  refused). Signing also removes SmartScreen's "unknown publisher" warning on the website download.
- **Signing options:** Azure Artifact Signing (formerly Trusted Signing), about $9.99 a month, open to
  individuals in the USA and Canada only; otherwise an OV code-signing certificate from a CA, usually a
  few hundred dollars a year on a hardware token. Identity checks take days, so start this week.
- **Updates are the app's job** (the Store doesn't update EXE apps). There's no update check, to keep the
  "nothing is sent" promise. Instead, the extension, which Chrome keeps up to date, knows the latest
  Windows version (`WINDOWS_LATEST` in link.js: raise it with each Windows release) and says it in its hello
  (`windowsLatest`). Memoir for Windows keeps it for each linked browser; when it's newer than itself, its
  Settings shows "A newer Memoir for Windows" with Get it (the website) for as long as it's older (no X: put
  off, it never came back), and one toast says so (recap.js `renderUpdate`). Because of this, the extension must keep speaking older protocol versions for a
  while.
- **The website must be live first:** the Store submission needs the installer's permanent address.

**Not recommended for launch: MSIX in the Store.** MSIX gets free signing and Store updates, but an MSIX
app's HKCU registry writes are virtualized, so Chrome can't find the native host. Bitwarden's Store build
has no browser integration for this kind of reason. A possible fix is the `unvirtualizedResources`
restricted capability (which the Store must approve) plus an App Execution Alias for the host's path. It's
untested, and it would mean a second build. Revisit after launch.

## What syncs, and how it merges

Each side keeps tracking into its own storage, exactly as now. Sync sends records across and the
receiver keeps them beside its own; what's shown is the two merged (see the correction above). Every merge below is commutative, associative and idempotent, so both
sides end up with the same data whatever the order, the repeats or the dropped connections. There's no
"which tracker is right" logic, and no handing over between trackers (a hand-over loses time when one of
them stops unexpectedly).

| Data | Merge |
|---|---|
| `day:YYYY-MM-DD` | `mergeDay` (`recap.js`, Import's merge): per hour and site, the larger time; page times and per-hour page times the same way; `tp` as a union; links get a fixed tie-break so both sides keep the same one. Totals are recomputed from the hours. |
| `apps` (Windows: app name, category, icon) | Comes from Windows. The icon is a file name; the extension asks for the pictures it lacks (`iconWants`) and keeps them as `data:` URLs in `appIcons`. |
| `favicons` (Windows: the websites' icons) | Windows asks a linked browser for the icons of websites it has none for (`iconWants`, each once per run); the browser answers from its own favicon store (`icons`, `null` for none). Saved in `icons\sites`, named in `favicons`; Never track and Clear all remove them. |
| `origins` | Union; the newer one wins. |
| `categories` (moved sites and apps) | Per entry, the newer change wins. |
| `goal.history` | Per `from` day, the newer write wins. A limit committed on one side locks the other; the gauntlet's reset (`limit: null`) carries over. |
| `goalTrial` | The newer wins (Undo on either side removes it). |
| `goalNotify`, the weekly recap flag | OR per day (or per week): once shown anywhere, never again. |
| `settings`: `paused`, `titles`, `retention`, `weeklyReminder`, `reminderDay`, `reminderMinutes`, and Appearance: `theme`, `rainbow`, `cursor`, `cursorSmooth` | Per field, the newer change wins. Appearance lives in each place's localStorage (first paint) with these copies in settings (`shared/appearance.js`): a page puts its choice in the copy, and takes a changed copy back. |
| `settings.excluded` (Never track) | A set: additions are joined; a removal wins only over an older addition. |
| Not synced | `onboarded`, `popupIntroduced`, the session, Start with Windows (Windows only), the Apps or Browsers choice in Most used. |

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
- **Keep history:** a synced setting, so both sides prune the same way, page titles with their day.
  Incoming days past the cutoff are dropped as they arrive.
- **Unlink:** syncing stops; both keep what they have.

## Who sends notifications

When the two are linked and the app is running, the app sends the limit and weekly notifications, since
it sees everything, even with Chrome closed. The extension sends them only when it hasn't heard from the
app for 2 minutes. The OR-merged flags stop repeats. The popup's flame moment works as it does now.

## The exchange

- **On connect:** `hello` both ways (protocol version, device id, kind, a name like "Chrome · Profile 1",
  app version; the extension's also `windowsLatest`, above). The extension also speaks older protocol versions, because the app is updated by hand.
  If it can't speak the app's version, nothing syncs and Settings says which one to update.
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
- Port the writing of `th/tu/tp`, and make Never track and Erase titles
  (`Redact`) cover `th/tu/tp` too. As it stands, an excluded site's name would survive there and travel.
- `BrowserLink`: two-way, persistent, bigger frames, several instances, and self-registration at startup.
- New `Sync.cs`: peers, the change counter (from `Store.Changed`), the merge (a C# port of `mergeDay` and
  the import's cleaning), the markers, and the notification hand-off.
- Tracker: while the linked extension reports for a browser, don't record that browser's fallback key
  (`app:chrome.exe`), or the same minutes would count twice under two names.
- Settings: a "Chrome extension" row (linked profiles, last sync).
- The signed per-user installer, with a silent switch for the Store; data moves to `%LOCALAPPDATA%\Memoir`
  (the portable build's `Data` folder is imported on first run).

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
   keeps the worker alive in current Chrome. Create the Web Store draft to get the ID. **Start the
   code-signing identity check and open a Microsoft Partner Center account** (both can take days).
2. **Oct 20–26:** Windows data parity (`Normalize`, `th/tu/tp`, `Redact`). The shared merge
   cases, running on both sides.
3. **Oct 27–Nov 2:** transport (two-way host, registration, the extension's link and connector role), the
   exchange, live sync. The per-user installer, with data moved out of the program folder.
4. **Nov 3–7:** deletions; settings, limit and Never track; notifications; app keys and wording in the
   extension; Settings on both sides; privacy texts. Put the website live with the installer's permanent
   address.
5. **Nov 8–10:** end-to-end tests, run on the *signed installer* build. Submit the extension for review with
   publishing deferred (reviews of items with `nativeMessaging` can take longer). Submit the Store listing
   with a release date of the 19th (Store certification also takes days).
6. **Nov 10–19:** buffer; publish both on the 19th.

This pulls Windows work forward. "Finish the extension, then re-port" can't hold if sync has to work at
launch: the Windows data model must match the extension's before the two can share it.

## Open questions

1. ~~How does the Windows app ship?~~ Settled 2026-10-17: both on the website and in the Microsoft Store,
   with one signed installer (see "Shipping the Windows app"). Still open: which signing option (it
   depends on the country and the cost).
2. **When linked, does Chrome show Windows apps too?** Recommended: yes, one total and one limit. With
   websites only, the same limit would read differently in each place.
3. **Pausing, Clear all, Never track and the limit shared by both?** Recommended: yes. The alternative is
   that pausing in Chrome only pauses browsing, but the app would keep recording that browsing anyway.
4. **Theme and cursor: per place or shared?** Recommended: per place.
