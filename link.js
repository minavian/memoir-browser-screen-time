/*! Made with care and love by Mina Vian */
// The link with Memoir for Windows (SYNC-PLAN.md), the service worker's side. Linked, this browser's own
// days (day:<date>) go to the app, and the app's (its own merged with any other browser profile's) come
// back and are kept as they are (link:windows:<date>); what's shown is both merged (core.js getDays), so the
// same minutes measured on both sides never add up. Settings, Never track, the limit's history and moved
// categories go to whichever side changed them last; Clear all and Erase titles travel as markers. Icons go
// where they're missing: the app's icons for its apps come here (`appIcons`), and the websites' icons the
// browser has go to the app, each when the other side asks. It also tells the app which tab is in front (the
// old Memoir Windows Connector's job), so both count the same names. All of it on this computer: native
// messaging to Memoir.exe, which relays over a pipe only this Windows account can open. No network.

import {
  siteFromUrl, dayKey, storageKeyForDay, normalizeDay, linkKey, linkPeers, recordDate,
  listDayRecordKeys, cleanDay, mergeDay, anonymizeDay, isExcluded, getSettings, siteKey, isApp, isPage, ICON_FILE,
} from './shared/core.js';

const HOST = 'com.minavian.memoir';
const PROTOCOL = 1;
// The newest Memoir for Windows when this copy of the extension was made. A linked Memoir for Windows older than this
// says a newer one is out (it never looks online itself; this extension is kept up to date by its store). Raise it
// with each Memoir for Windows release.
const WINDOWS_LATEST = '0.9.0';
const PEER = 'windows';                // the app's days: link:windows:<date>
// (Appearance too: theme, rainbow, cursor and cursorSmooth are copies of this place's choices, shared/appearance.js)
const SETTINGS_FIELDS = ['paused', 'titles', 'retention', 'weeklyReminder', 'reminderDay', 'reminderMinutes', 'theme', 'rainbow', 'cursor', 'cursorSmooth'];
const BATCH_BYTES = 600 * 1024;        // the host takes up to 4 MB; batches stay small
const ICON_BYTES = 64 * 1024;          // one icon, at most (they're 32 to 40 px)
const DATE = /^\d{4}-\d{2}-\d{2}$/;

let enqueue = fn => fn();              // the tracker's queue (background.js), so saves never race
let flushTracker = async () => {};     // the tracker's sync: the time being counted, saved (before a restart)
let port = null;
let app = null;                        // the app's hello, while it's open
let lastHeard = 0;
let seq = 0;
let rulesDue = false;
let sendTimer = 0;
let helloTimer = 0;                    // says hello again until the app answers
const inflight = new Map();            // seq → dates sent, not yet acknowledged
const askedIcons = new Set();          // app icons asked for while connected (each once)
const expect = new Map();              // key → JSON this module just wrote (not a change of the user's)

// While the app is open it sends the limit's and the week's notifications (it sees everything, even with
// the browser closed); the extension only does when it hasn't heard from it for 2 minutes.
export const appOnline = () => !!(port && app && Date.now() - lastHeard < 120_000);

// ---------- the link's record: { linked, mode, since, device, lastSync, pending, meta } ----------
async function getLink() {
  const { link } = await chrome.storage.local.get('link');
  return link && typeof link === 'object' ? link : { linked: false };
}
async function write(patch) {
  for (const [k, v] of Object.entries(patch)) expect.set(k, JSON.stringify(v));
  await chrome.storage.local.set(patch);
}
async function setLink(change) {
  const link = { ...(await getLink()), ...change };
  await write({ link });
  return link;
}
function meta(link) {
  const m = link.meta && typeof link.meta === 'object' ? link.meta : {};
  return { settingsAt: {}, excluded: {}, categoriesAt: {}, goalAt: 0, wipe: 0, titlesErased: 0, ...m };
}
const wanted = (link, date) => link.mode !== 'fresh' || date >= dayKey(new Date(link.since || 0));

// what Settings shows: off, connecting, insync, offline (the app is closed), notfound (no Memoir for
// Windows on this computer), denied (no permission), update (versions that can't talk)
async function status(state, extra = {}) {
  const { lastSync = 0 } = await getLink();
  try { await chrome.storage.session.set({ linkLive: { state, at: Date.now(), lastSync, appVersion: app ? app.version : null, ...extra } }); } catch { /* no session storage */ }
}

// anything across, either way, is a sync: Settings say when the last one was (at most every 5 s)
async function synced() {
  const link = await getLink();
  if (link.linked && Date.now() - (link.lastSync || 0) > 5000) { await setLink({ lastSync: Date.now() }); status('insync'); }
}

// ---------- connecting ----------
async function connect() {
  const link = await getLink();
  if ((!link.linked && !link.unlinkOwed) || port) return;
  if (!(await chrome.permissions.contains({ permissions: ['nativeMessaging'] }))) { if (link.linked) status('denied'); return; }
  // allowed after this worker started: Chromium gives it the permission's new APIs, but not runtime.connectNative,
  // which only a fresh worker has. So Memoir restarts once, then links (restartForLink)
  if (typeof chrome.runtime.connectNative !== 'function') { if (link.linked && await restartForLink()) return; if (link.linked) status('notfound'); retry(); return; }
  try { port = chrome.runtime.connectNative(HOST); } catch { port = null; if (link.linked) status('notfound'); retry(); return; }
  if (link.linked) status('connecting');
  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(async () => {
    const error = (chrome.runtime.lastError && chrome.runtime.lastError.message) || '';
    port = null; app = null;
    clearTimeout(helloTimer);
    requeue();
    const now = await getLink();
    // forbidden: Memoir for Windows is there but doesn't know this copy of Memoir yet (an older version)
    if (now.linked) status(/forbidden|not allowed/i.test(error) ? 'update' : /not found/i.test(error) ? 'notfound' : 'offline');
    if (now.linked || now.unlinkOwed) retry();
  });
}
function retry() { chrome.alarms.create('link-retry', { delayInMinutes: 0.5 }); }
// The restart: the time being counted is saved first, and Settings open again where Link was pressed
// (startLink). Once a minute at most, so it can never loop.
async function restartForLink() {
  const { linkRestart = 0 } = await chrome.storage.local.get('linkRestart');
  if (Date.now() - linkRestart < 60_000) return false;
  await chrome.storage.local.set({ linkRestart: Date.now(), linkReopen: true });
  try { await flushTracker(); } catch { /* the restart goes ahead */ }
  chrome.runtime.reload();
  return true;
}
function post(message) { try { port && port.postMessage(message); return !!port; } catch { return false; } }

// The browser's name when it says it (Chrome, Edge, Brave, Opera); otherwise none, and Memoir for Windows names
// it from the program that started its host (Arc, Comet, Vivaldi… only say "Chromium").
function browserName() {
  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const brand = brands.map(b => b.brand).find(b => /Edge|Chrome|Brave|Opera|Vivaldi/.test(b)) || '';
  return brand.replace('Microsoft ', '').replace('Google ', '');
}
// The app answers with its own hello. One it didn't hear (still starting up) is said again until it does.
async function sayHello() {
  clearTimeout(helloTimer);
  const link = await getLink();
  post({ type: 'hello', protocol: PROTOCOL, device: link.device, kind: 'extension', name: browserName(), version: chrome.runtime.getManifest().version, windowsLatest: WINDOWS_LATEST, linked: { mode: link.mode, since: link.since } });
  helloTimer = setTimeout(() => { if (port && !app) sayHello(); }, 5000);
}

async function onMessage(message) {
  if (!message || typeof message !== 'object') return;
  lastHeard = Date.now();
  if (message.type === 'host') {
    if (message.app === 'online') sayHello();
    else { clearTimeout(helloTimer); app = null; requeue(); if ((await getLink()).linked) status('offline'); }
  } else if (message.type === 'hello') {
    app = message;
    askedIcons.clear();
    if (message.protocol !== PROTOCOL) { status('update'); return; }
    const link = await getLink();
    // unlinked while the app was closed: it hears it now
    if (!link.linked) { if (link.unlinkOwed) post({ type: 'unlink' }); return; }
    rulesDue = true;
    await setLink({ lastSync: Date.now() });
    await status('insync');
    sendTab();
    send();
  } else if (message.type === 'unlinked') {
    if (unlinkDone) unlinkDone();
    const link = await getLink();
    if (!link.linked) { await setLink({ unlinkOwed: false }); disconnect(); }
  } else if (message.type === 'unlink') {
    // unlinked in Memoir for Windows' own Settings
    if ((await getLink()).linked) await unlink({ tell: false });
  } else if (!app) {
    // nothing before the app has said hello
  } else if (message.type === 'rules') enqueue(async () => { await applyRules(message); await synced(); });
  else if (message.type === 'days') enqueue(async () => { await applyDays(message); await synced(); });
  else if (message.type === 'iconWants') sendFavicons(message.sites);
  else if (message.type === 'icons') enqueue(() => keepIcons(message.apps));
  else if (message.type === 'ack') {
    inflight.delete(message.seq);
    await synced();
  }
}
// sent but not acknowledged: back on the list
async function requeue() {
  if (!inflight.size) return;
  const dates = [...inflight.values()].flat();
  inflight.clear();
  const link = await getLink();
  await setLink({ pending: [...new Set([...(link.pending || []), ...dates])] });
}

// ---------- what goes across ----------
function soon() { clearTimeout(sendTimer); sendTimer = setTimeout(send, 1500); }
async function send() {
  if (!port || !app || app.protocol !== PROTOCOL) return;
  const link = await getLink();
  if (!link.linked) return;
  if (rulesDue) { rulesDue = false; post(await rules(link)); }
  const pending = [...new Set(link.pending || [])].sort().reverse(); // newest first: this week shows up first
  if (!pending.length) return;
  const raw = await chrome.storage.local.get(pending.map(storageKeyForDay));
  let batch = {}, size = 0;
  const flush = () => {
    if (!Object.keys(batch).length) return;
    const n = ++seq;
    if (post({ type: 'days', seq: n, days: batch })) inflight.set(n, Object.keys(batch).map(k => k.slice(4)));
    batch = {}; size = 0;
  };
  for (const date of pending) {
    const day = raw[storageKeyForDay(date)];
    if (!day) continue;
    const bytes = JSON.stringify(day).length;
    if (size + bytes > BATCH_BYTES) flush();
    batch[storageKeyForDay(date)] = day;
    size += bytes;
  }
  flush();
  await setLink({ pending: [] });
}
async function rules(link) {
  const m = meta(link);
  const settings = await getSettings();
  const raw = await chrome.storage.local.get(['goal', 'categories', 'goalNotify', 'origins']);
  return {
    type: 'rules',
    settings: Object.fromEntries(SETTINGS_FIELDS.map(f => [f, settings[f]])), settingsAt: m.settingsAt,
    excluded: m.excluded,
    goal: { history: (raw.goal && raw.goal.history) || [], at: m.goalAt },
    categories: raw.categories || {}, categoriesAt: m.categoriesAt,
    wipe: m.wipe, titlesErased: m.titlesErased,
    goalNotify: raw.goalNotify || {}, origins: raw.origins || {},
  };
}

// ---------- what changes here (background.js passes storage changes on) ----------
let settingsSeen = null;
export async function onStorageChanged(changes) {
  // what this module wrote itself isn't a change of the user's
  const fromLink = new Set();
  for (const k of Object.keys(changes)) {
    if (!expect.has(k)) continue;
    if (expect.get(k) === JSON.stringify(changes[k].newValue)) fromLink.add(k);
    expect.delete(k);
  }
  const ours = k => fromLink.has(k);
  const link = await getLink();
  if (!link.linked) { if (changes.settings) settingsSeen = changes.settings.newValue || null; return; }
  const m = meta(link);
  const now = Date.now();
  let rulesChanged = false;
  // this side's own days (the link only ever writes link:… records)
  const dates = Object.keys(changes).filter(k => /^day:/.test(k) && changes[k].newValue).map(recordDate).filter(d => d && wanted(link, d));
  if (changes.settings && !ours('settings')) {
    const before = settingsSeen || changes.settings.oldValue || {};
    const after = changes.settings.newValue || {};
    for (const f of SETTINGS_FIELDS) if (JSON.stringify(before[f]) !== JSON.stringify(after[f])) { m.settingsAt[f] = now; rulesChanged = true; }
    const was = new Set(before.excluded || []), is = new Set(after.excluded || []);
    for (const s of is) if (!was.has(s)) { m.excluded[s] = { on: true, at: now }; rulesChanged = true; }
    for (const s of was) if (!is.has(s)) { m.excluded[s] = { on: false, at: now }; rulesChanged = true; }
  }
  if (changes.settings) settingsSeen = changes.settings.newValue || null;
  if (changes.goal && !ours('goal')) { m.goalAt = now; rulesChanged = true; }
  if (changes.categories && !ours('categories')) {
    const before = changes.categories.oldValue || {}, after = changes.categories.newValue || {};
    for (const s of new Set([...Object.keys(before), ...Object.keys(after)])) if (before[s] !== after[s]) { m.categoriesAt[s] = now; rulesChanged = true; }
  }
  for (const marker of ['wipe', 'titlesErased']) {
    if (changes[marker] && !ours(marker) && (changes[marker].newValue || 0) > m[marker]) { m[marker] = changes[marker].newValue; rulesChanged = true; }
  }
  if ((changes.goalNotify && !ours('goalNotify')) || (changes.origins && !ours('origins'))) rulesChanged = true;
  if (!dates.length && !rulesChanged) return;
  if (rulesChanged) rulesDue = true;
  await setLink({ meta: m, pending: [...new Set([...(link.pending || []), ...dates])] });
  soon();
}

// ---------- what arrives ----------
async function applyDays(message) {
  const link = await getLink();
  if (!link.linked) return;
  const m = meta(link);
  const { excluded } = await getSettings();
  const patch = {};
  for (const [key, value] of Object.entries(message.days || {})) {
    const date = key.startsWith('day:') ? key.slice(4) : '';
    if (!DATE.test(date) || !wanted(link, date)) continue;
    const day = cleanDay(value);
    if (!day || !trim(date, day, m)) continue;
    anonymizeDay(day, excluded);
    patch[linkKey(PEER, date)] = day;
  }
  if (!(await linkPeers()).includes(PEER)) patch.linkPeers = [...(await linkPeers()), PEER];
  if (Object.keys(patch).length) await write(patch);
  post({ type: 'ack', seq: message.seq });
}
// Clear all and Erase titles, from either side: nothing from before a marker comes back
function trim(date, day, m) {
  if (m.wipe) {
    const wipeDay = dayKey(new Date(m.wipe));
    if (date < wipeDay) return false;
    if (date === wipeDay) dropHours(day, new Date(m.wipe).getHours());
  }
  if (m.titlesErased && date <= dayKey(new Date(m.titlesErased))) Object.assign(day, { ti: {}, th: {}, tu: {}, tp: [] });
  return Object.values(day.s).some(v => v > 0) || Object.keys(day.ti).length > 0;
}
function dropHours(day, through) {
  for (let h = 0; h <= through; h++) { delete day.hs[h]; delete day.th[h]; day.h[h] = 0; }
  day.s = {};
  for (const slot of Object.values(day.hs)) for (const [d, ms] of Object.entries(slot)) day.s[d] = (day.s[d] || 0) + ms;
}

async function applyRules(remote) {
  const link = await getLink();
  if (!link.linked) return;
  const m = meta(link);
  const raw = await chrome.storage.local.get(['settings', 'goal', 'categories', 'origins', 'goalNotify']);
  const settings = await getSettings();
  const patch = {};
  let settingsChanged = false, privacy = false;
  // settings: each field from whichever side changed it last
  for (const f of SETTINGS_FIELDS) {
    const theirs = (remote.settingsAt || {})[f] || 0;
    if (theirs > (m.settingsAt[f] || 0) && remote.settings && f in remote.settings) { settings[f] = remote.settings[f]; m.settingsAt[f] = theirs; settingsChanged = true; }
  }
  // Never track: a set, each name on or off by its latest change
  for (const [site, entry] of Object.entries(remote.excluded || {})) {
    if (siteKey(site) === null || !entry || typeof entry !== 'object') continue;
    if ((entry.at || 0) > ((m.excluded[site] && m.excluded[site].at) || 0)) m.excluded[site] = { on: !!entry.on, at: entry.at };
  }
  const list = Object.entries(m.excluded).filter(([, e]) => e.on).map(([s]) => s).sort();
  if (JSON.stringify(list) !== JSON.stringify([...settings.excluded].sort())) { settings.excluded = list; settingsChanged = privacy = true; }
  if (settingsChanged) patch.settings = settings;
  // the limit's history: every entry of both; the same day's entry from whichever side wrote last
  const goal = remote.goal || {};
  const theirsNewer = (goal.at || 0) > (m.goalAt || 0);
  const entries = new Map(((raw.goal && raw.goal.history) || []).map(e => [e.from, e]));
  for (const e of Array.isArray(goal.history) ? goal.history : []) {
    if (!e || typeof e.from !== 'string' || !DATE.test(e.from) || !(e.limit === null || (Number.isFinite(e.limit) && e.limit >= 0))) continue;
    if (!entries.has(e.from) || theirsNewer) entries.set(e.from, { from: e.from, limit: e.limit });
  }
  const history = [...entries.values()].sort((a, b) => (a.from < b.from ? -1 : 1));
  if (JSON.stringify(history) !== JSON.stringify((raw.goal && raw.goal.history) || [])) patch.goal = { history };
  if (theirsNewer) m.goalAt = goal.at;
  // moved categories: each name's from whichever side moved it last
  const categories = { ...(raw.categories || {}) };
  let moved = false;
  for (const [site, at] of Object.entries(remote.categoriesAt || {})) {
    if (!(at > (m.categoriesAt[site] || 0)) || siteKey(site) === null) continue;
    m.categoriesAt[site] = at;
    const cat = (remote.categories || {})[site];
    if (typeof cat === 'string' && cat) categories[site] = cat; else delete categories[site];
    moved = true;
  }
  if (moved) patch.categories = categories;
  // site addresses this side doesn't have yet; Windows apps' names and categories
  const origins = { ...(raw.origins || {}) };
  let found = false;
  for (const [site, origin] of Object.entries(remote.origins || {})) {
    if (!origins[site] && siteKey(site) !== null && typeof origin === 'string' && /^https?:\/\/[^/]+$/.test(origin)) { origins[site] = origin; found = true; }
  }
  if (found) patch.origins = origins;
  let apps = null;
  if (remote.apps && typeof remote.apps === 'object') {
    apps = {};
    for (const [key, a] of Object.entries(remote.apps)) {
      if (siteKey(key) === null || !a || typeof a.name !== 'string') continue;
      apps[key] = { name: a.name.slice(0, 160), category: typeof a.category === 'string' ? a.category : 'other', icon: ICON_FILE.test(a.icon || '') ? a.icon : null };
    }
    patch.apps = apps;
  }
  // the limit's notices: once shown on either side, never again that day
  const notify = raw.goalNotify || {}, theirs = remote.goalNotify || {};
  if (typeof theirs.day === 'string' && theirs.day >= (notify.day || '')) {
    const same = theirs.day === notify.day;
    const next = { day: theirs.day, n95: !!theirs.n95 || (same && !!notify.n95), over: !!theirs.over || (same && !!notify.over) };
    if (JSON.stringify(next) !== JSON.stringify(notify)) patch.goalNotify = next;
  }
  // markers from the other side
  const wiped = (remote.wipe || 0) > m.wipe, titlesGone = (remote.titlesErased || 0) > m.titlesErased;
  if (wiped) m.wipe = remote.wipe;
  if (titlesGone) m.titlesErased = remote.titlesErased;
  patch.link = { ...link, meta: m };
  await write(patch);
  if (settingsChanged) settingsSeen = settings;
  if (wiped) await wipe(m.wipe);
  if (titlesGone) await eraseTitles(m.titlesErased);
  if (privacy) await anonymizeAll(settings.excluded);
  if (apps) await askIcons(apps);
}

// ---------- icons ----------
// The app's apps: the pictures this side doesn't have yet are asked for (icons the app no longer uses go)
async function askIcons(apps) {
  const files = new Set(Object.values(apps).map(a => a.icon).filter(Boolean));
  const { appIcons = {} } = await chrome.storage.local.get('appIcons');
  const kept = Object.fromEntries(Object.entries(appIcons).filter(([f]) => files.has(f)));
  if (Object.keys(kept).length !== Object.keys(appIcons).length) await write({ appIcons: kept });
  const want = [...files].filter(f => !kept[f] && !askedIcons.has(f)).slice(0, 500);
  if (!want.length) return;
  want.forEach(f => askedIcons.add(f));
  post({ type: 'iconWants', apps: want });
}
async function keepIcons(icons) {
  if (!icons || typeof icons !== 'object') return;
  const { apps = {}, appIcons = {} } = await chrome.storage.local.get(['apps', 'appIcons']);
  const used = new Set(Object.values(apps).map(a => a && a.icon).filter(Boolean));
  const next = { ...appIcons };
  for (const [file, data] of Object.entries(icons)) {
    if (ICON_FILE.test(file) && used.has(file) && typeof data === 'string' && data.startsWith('data:image/png;base64,') && data.length < ICON_BYTES * 1.4) next[file] = data;
  }
  if (Object.keys(next).length !== Object.keys(appIcons).length) await write({ appIcons: next });
}

// The websites' icons, for the app: what this browser shows for each (its own favicon store, the same as the
// report's), or null when it has none. Chrome keys icons by the exact address visited, so the address the site
// was visited on comes first, then the usual spellings; its grey globe means none.
const favUrl = page => chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(page)}&size=32`);
async function pngData(page) {
  const res = await fetch(favUrl(page));
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 8 || bytes.length > ICON_BYTES || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(text)}`;
}
let globe = null;
async function favicon(domain, origins) {
  if (!globe) globe = pngData('https://memoir-no-icon.invalid/').catch(() => null);
  const none = await globe;
  const pages = new Set([origins[domain] && `${origins[domain]}/`, `https://${domain}/`, `https://www.${domain}/`, `http://${domain}/`, `http://www.${domain}/`].filter(Boolean));
  for (const page of pages) {
    const data = await pngData(page).catch(() => null);
    if (data && data !== none) return data;
  }
  return null;
}
let faviconsBusy = Promise.resolve();
function sendFavicons(sites) {
  if (!Array.isArray(sites)) return;
  faviconsBusy = faviconsBusy.then(async () => {
    const { origins = {} } = await chrome.storage.local.get('origins');
    const settings = await getSettings();
    const list = [...new Set(sites)].filter(d => typeof d === 'string' && siteKey(d) === d && !isApp(d) && !isPage(d) && !d.startsWith('~') && !isExcluded(d, settings.excluded)).slice(0, 500);
    let batch = {}, size = 0;
    const flush = () => { if (Object.keys(batch).length) post({ type: 'icons', sites: batch }); batch = {}; size = 0; };
    // a few at a time
    for (let i = 0; i < list.length; i += 6) {
      const part = list.slice(i, i + 6);
      const found = await Promise.all(part.map(d => favicon(d, origins).catch(() => null)));
      part.forEach((d, j) => {
        const bytes = found[j] ? found[j].length : 4;
        if (size + bytes > BATCH_BYTES) flush();
        batch[d] = found[j];
        size += bytes + d.length;
      });
    }
    flush();
  }).catch(() => {});
}
async function wipe(at) {
  const wipeDay = dayKey(new Date(at));
  const keys = await listDayRecordKeys();
  const raw = await chrome.storage.local.get(keys.filter(k => recordDate(k) === wipeDay));
  const patch = {};
  for (const [k, v] of Object.entries(raw)) { const d = normalizeDay(v); dropHours(d, new Date(at).getHours()); patch[k] = d; }
  await chrome.storage.local.remove([...keys.filter(k => recordDate(k) < wipeDay), 'categories', 'origins', 'apps', 'appIcons', 'goalNotify']);
  if (Object.keys(patch).length) await write(patch);
}
async function eraseTitles(at) {
  const until = dayKey(new Date(at));
  const keys = (await listDayRecordKeys()).filter(k => recordDate(k) <= until);
  const raw = await chrome.storage.local.get(keys);
  const patch = {};
  for (const [k, v] of Object.entries(raw)) patch[k] = { ...v, ti: {}, th: {}, tu: {}, tp: [] };
  if (Object.keys(patch).length) await write(patch);
}
async function anonymizeAll(list) {
  const keys = await listDayRecordKeys();
  const raw = await chrome.storage.local.get([...keys, 'origins', 'categories']);
  const patch = {};
  for (const k of keys) { if (!raw[k]) continue; const d = normalizeDay(raw[k]); if (anonymizeDay(d, list)) patch[k] = d; }
  const origins = raw.origins || {}, cats = raw.categories || {};
  const o2 = Object.fromEntries(Object.entries(origins).filter(([d]) => !isExcluded(d, list)));
  const c2 = Object.fromEntries(Object.entries(cats).filter(([d]) => !isExcluded(d, list)));
  if (Object.keys(o2).length !== Object.keys(origins).length) patch.origins = o2;
  if (Object.keys(c2).length !== Object.keys(cats).length) patch.categories = c2;
  if (Object.keys(patch).length) await write(patch);
}

// ---------- the tab in front (the connector's job) ----------
async function sendTab() {
  if (!port || !app) return;
  try {
    const win = await chrome.windows.getLastFocused();
    const [tab] = win && win.id != null ? await chrome.tabs.query({ active: true, windowId: win.id }) : [];
    const site = tab ? siteFromUrl(tab.url || tab.pendingUrl || '', chrome.runtime.id) : null;
    let url = '';
    try { const u = new URL(tab && tab.url); if (/^https?:$/.test(u.protocol)) url = u.origin; } catch { /* not a web page */ }
    post({ type: 'tab', tab: {
      focused: !!(win && win.focused), incognito: !!(tab && tab.incognito), url,
      page: site && site.startsWith('~') ? site : '',
      title: tab && !tab.incognito ? (tab.title || '').slice(0, 120) : '',
      audible: !!(tab && tab.audible), muted: !!(tab && tab.mutedInfo && tab.mutedInfo.muted),
    } });
  } catch { /* the browser is closing */ }
}

// ---------- link, unlink (from Settings), and start ----------
// mode: 'merge' (both histories, everything so far) or 'fresh' (only from today)
export async function link(mode) {
  const now = Date.now();
  const before = await getLink();
  const settings = await getSettings();
  const { categories = {} } = await chrome.storage.local.get('categories');
  // this side's rules start as the shared ones (an older change on the other side loses to them)
  const m = {
    settingsAt: Object.fromEntries(SETTINGS_FIELDS.map(f => [f, now])),
    excluded: Object.fromEntries(settings.excluded.map(s => [s, { on: true, at: now }])),
    categoriesAt: Object.fromEntries(Object.keys(categories).map(s => [s, now])),
    goalAt: now, wipe: 0, titlesErased: 0,
  };
  const link = { linked: true, mode: mode === 'fresh' ? 'fresh' : 'merge', since: now, device: before.device || crypto.randomUUID(), lastSync: 0, meta: m };
  const dates = (await listDayRecordKeys()).filter(k => k.startsWith('day:')).map(recordDate).filter(d => wanted(link, d));
  await write({ link: { ...link, pending: dates }, linkPeers: [...new Set([...(await linkPeers()), PEER])] });
  settingsSeen = settings;
  rulesDue = true;
  await connect();
  if (port && app) send();
}
// Unlinked, both keep what they have: the app's days fold into this side's own. The app hears it now
// (and says so), or the next time it's open (tell: false when the unlinking came from the app).
let unlinkDone = null;
export async function unlink({ tell = true } = {}) {
  let heard = !tell;
  if (tell && port && app) {
    heard = await new Promise(resolve => {
      const timer = setTimeout(() => { unlinkDone = null; resolve(false); }, 3000);
      unlinkDone = () => { clearTimeout(timer); unlinkDone = null; resolve(true); };
      post({ type: 'unlink' });
    });
  }
  disconnect();
  await enqueue(async () => {
    const keys = (await listDayRecordKeys()).filter(k => k.startsWith(`link:${PEER}:`));
    const own = keys.map(k => storageKeyForDay(recordDate(k)));
    const raw = await chrome.storage.local.get([...keys, ...own]);
    const patch = {};
    for (const k of keys) { const date = recordDate(k); patch[storageKeyForDay(date)] = mergeDay(normalizeDay(raw[storageKeyForDay(date)]), normalizeDay(raw[k])); }
    const { device } = await getLink();
    await write({ ...patch, link: { linked: false, device, unlinkOwed: !heard }, linkPeers: (await linkPeers()).filter(p => p !== PEER) });
    await chrome.storage.local.remove(keys);
  });
  status('off');
  if (!heard) retry(); // the app hears it next time it's open
}
function disconnect() {
  try { port && port.disconnect(); } catch { /* gone */ }
  port = null; app = null; inflight.clear();
}

export async function startLink(queue, flush) {
  enqueue = queue;
  if (flush) flushTracker = flush;
  // back from the restart that finishes a Link: Settings again, where it was pressed
  const { linkReopen } = await chrome.storage.local.get('linkReopen');
  if (linkReopen) { await chrome.storage.local.remove('linkReopen'); chrome.tabs.create({ url: chrome.runtime.getURL('recap.html#link') }); }
  const link = await getLink();
  settingsSeen = await getSettings();
  if (link.linked || link.unlinkOwed) connect();
  if (!link.linked) status('off');
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'link-retry') connect();
  else if (alarm.name === 'link-tab') sendTab();
});
chrome.alarms.create('link-tab', { periodInMinutes: 0.5 });
chrome.tabs.onActivated.addListener(sendTab);
chrome.tabs.onUpdated.addListener((id, change, tab) => { if (tab.active && ['url', 'title', 'audible', 'mutedInfo', 'status'].some(k => k in change)) sendTab(); });
chrome.windows.onFocusChanged.addListener(sendTab);
chrome.permissions.onAdded.addListener(p => { if ((p.permissions || []).includes('nativeMessaging')) connect(); });
chrome.permissions.onRemoved.addListener(p => { if ((p.permissions || []).includes('nativeMessaging')) { try { port && port.disconnect(); } catch { /* gone */ } port = null; app = null; status('denied'); } });
