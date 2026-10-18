# Chrome Web Store: the Privacy practices tab

These are the answers for the developer dashboard (Item > Privacy practices), checked against the code of version 6.0.0. If a permission or a data flow changes, update this file and the dashboard together.

## Single purpose

> Memoir shows you where your browsing time goes. It measures how long you spend on each website, keeps you to a daily limit if you set one, and shows your day and week in a popup and a weekly report. Everything stays on your computer. If you choose, it syncs with Memoir for Windows on the same computer, so both show the same week.

## Permission justifications

| Permission | Justification |
|---|---|
| `tabs` | To read the address of the active tab so its time is counted towards the right site, and the page's title only when the user has turned on "Page titles". Nothing is read from page contents. |
| `storage` | To save the user's time log and settings in the browser (`chrome.storage.local`, plus `chrome.storage.session` for the visit in progress). Nothing is synced online or sent over the network. |
| `unlimitedStorage` | History is kept "forever" unless the user chooses otherwise. Years of daily records, with optional page titles, can exceed the default 10 MB, and the log must not stop saving when it does. |
| `idle` | To stop counting when the computer is idle or locked, so time away isn't counted as browsing. Only the active, idle or locked state is used. |
| `alarms` | To save the visit in progress every minute (MV3 service workers can stop at any time), to clear old history as the user's retention setting asks, and for the weekly reminder. |
| `notifications` | To tell the user when they're close to or over their own daily limit, and for the weekly recap reminder they can turn off in Settings. |
| `favicon` | To show each site's icon in the list from Chrome's own icon cache, so sites are never contacted to fetch icons. |
| `nativeMessaging` (optional) | Asked for only when the user presses Link in Settings (Your data), to sync with Memoir for Windows, the developer's own desktop app, on the same computer. It is used only to talk to that app's program (`Memoir.exe`, native host `com.minavian.memoir`), which passes messages on over a named pipe only the user's Windows account can open. It carries the user's own daily totals, settings and the tab in front between the two. Nothing goes over the network, and Memoir works fully without it. |

Host permissions: none. Content scripts: none.

## Remote code

**No, I am not using remote code.** Every script is in the package. There is no `eval`, no remote scripts and no network requests.

## Data usage

**What user data do you plan to collect from users now or in the future?**

Tick only **Web history**: the sites visited, the time spent on them, and (only if the user turns on Page titles) page titles and addresses.

Leave every other category unticked:
- Personally identifiable information
- Health information
- Financial and payment information
- Authentication information
- Personal communications
- Location
- User activity
- Website content

The "User activity" category covers clicks, mouse position, scrolling and keystrokes. Memoir only uses Chrome's idle state (active, idle or locked), which isn't any of those.

Memoir keeps this data only on the user's computer and never transmits it off the computer. If the user links Memoir for Windows (optional), it is shared with that app on the same computer through native messaging, never online and never with anyone else. Google's form is about data an item "collects", so a local-only extension could arguably tick nothing. Ticking Web history is the honest and safe choice, because the extension does handle browsing history. The listing's privacy section then says the data is handled as described below.

**Certifications** (tick all three):
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

The dashboard needs a public web address. The policy is in [`PRIVACY.md`](../PRIVACY.md), and the same text ships in the extension as `privacy.html`, linked from Settings. This repository is private, so publish the policy somewhere public first and paste that address. For example:
- a page on Memoir's website
- a public GitHub Gist of `PRIVACY.md`
- GitHub Pages from a small public repository holding only the policy

When the policy changes, change all three together: `PRIVACY.md`, `privacy.html` and the public page.
