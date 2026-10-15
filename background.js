// Memoir: Browser Screen Time — background tracker (Manifest V3 service worker).
//
// Only the active tab of the focused Chrome window is timed, and only while you're
// actually there. Time pauses when Chrome isn't focused or is minimised, after
// IDLE_SECONDS without input (unless the tab plays audio), when the screen locks,
// and when tracking is paused. Progress is saved every minute.
//
// Each day stores total time per site, per hour, per site per hour, and (only when
// "Page titles" is on) time per page title with the page's latest address; those
// are kept for the weeks chosen in Settings (4 to 16). Sites on the "Never track" list are
// saved as anonymous Private time: it counts toward totals and the daily limit,
// but no name is ever written.

import {
  APP_NAME, IDLE_SECONDS, HEARTBEAT_MINUTES, MAX_GAP_MS, SLEEP_CREDIT_MS, PRIVATE_KEY, MAX_TITLES_PER_SITE,
  domainFromUrl, isExcluded, isPrivate, cleanTitle, cleanUrl, pruneTitles, dayKey, storageKeyForDay, normalizeDay, dayTotal,
  getSettings, getSession, getDays, startOfWeek, weekDayKeys, addDays, formatDuration,
  getGoalHistory, limitOn, retentionCutoffKey, listDayKeys, withData,
} from './shared/core.js';

chrome.idle.setDetectionInterval(IDLE_SECONDS);

// Every change runs through one queue so saves never race each other, and under
// the data lock so they never race the report's imports and privacy changes either.
let chain = Promise.resolve();
function enqueue(fn) {
  chain = chain.then(() => withData(fn)).catch(err => console.warn(`[${APP_NAME}]`, err));
  return chain;
}
const sync = () => enqueue(syncNow);

// Page titles can change every few seconds (chat counters, players), so title-only
// updates are batched, and skipped entirely while titles aren't being saved.
let titleTimer = 0;
let titlesOn = null; // unknown until settings load: sync to be safe
getSettings().then(s => { titlesOn = !!s.titles; });
function syncSoon() {
  clearTimeout(titleTimer);
  titleTimer = setTimeout(sync, 1500);
}

async function currentTarget(settings) {
  if (settings.paused) return null;
  const idle = await chrome.idle.queryState(IDLE_SECONDS);
  if (idle === 'locked') return null;

  let win;
  try {
    win = await chrome.windows.getLastFocused({ windowTypes: ['normal', 'popup'] });
  } catch {
    return null;
  }
  if (!win || !win.focused || win.state === 'minimized') return null;

  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab) return null;
  const url = tab.url || tab.pendingUrl;
  const domain = domainFromUrl(url);
  if (!domain) return null;
  if (idle === 'idle' && !tab.audible) return null;

  // Private windows (when Memoir is allowed in them) count, but only as Private time.
  if (tab.incognito || isExcluded(domain, settings.excluded)) return { domain: PRIVATE_KEY, origin: null, title: null, url: null };
  let origin = null;
  try { origin = new URL(url).origin; } catch { /* ignore */ }
  const title = settings.titles ? cleanTitle(tab.title, domain) : null;
  // the page's address goes with its title (never on its own)
  const link = title ? cleanUrl(url, domain) : null;
  return { domain, origin, title, url: link };
}

async function syncNow() {
  const now = Date.now();
  const settings = await getSettings();
  const session = await getSession();
  const target = await currentTarget(settings);

  if (session) {
    const gap = now - session.start;
    // A long silence means the computer slept: only credit a little before it.
    const end = gap > MAX_GAP_MS ? session.start + SLEEP_CREDIT_MS : now;
    if (end > session.start) await commit(session, session.start, end, settings);
  }

  if (target) {
    const continuing = session && session.domain === target.domain && now - session.start <= MAX_GAP_MS;
    await chrome.storage.session.set({
      session: { ...target, start: now, since: continuing ? session.since : now },
    });
  } else if (session) {
    await chrome.storage.session.remove('session');
  }
  await checkGoal(now);
}

// Adds [start, end) to a site, split cleanly across hour and day boundaries.
async function commit(session, start, end, settings) {
  // The site may have been excluded since this slice began.
  const priv = isPrivate(session.domain) || isExcluded(session.domain, settings.excluded);
  const domain = priv ? PRIVATE_KEY : session.domain;
  const title = !priv && settings.titles && session.title ? session.title : null;

  const buckets = new Map();
  let t = start;
  while (t < end) {
    const d = new Date(t);
    const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
    const chunkEnd = Math.min(end, nextHour);
    const key = dayKey(d);
    if (!buckets.has(key)) buckets.set(key, new Map());
    const hours = buckets.get(key);
    hours.set(d.getHours(), (hours.get(d.getHours()) || 0) + (chunkEnd - t));
    t = chunkEnd;
  }

  const storageKeys = [...buckets.keys()].map(storageKeyForDay);
  const raw = await chrome.storage.local.get([...storageKeys, 'origins']);
  const patch = {};
  for (const [key, hours] of buckets) {
    const rec = normalizeDay(raw[storageKeyForDay(key)]);
    let added = 0;
    for (const [h, ms] of hours) {
      const whole = Math.round(ms);
      if (whole <= 0) continue;
      rec.h[h] += whole;
      const slot = rec.hs[h] || (rec.hs[h] = {});
      slot[domain] = (slot[domain] || 0) + whole;
      added += whole;
    }
    if (added <= 0) continue;
    rec.s[domain] = (rec.s[domain] || 0) + added;
    if (title) {
      const pages = rec.ti[domain] || (rec.ti[domain] = {});
      const k = Object.hasOwn(pages, title) || Object.keys(pages).length < MAX_TITLES_PER_SITE ? title : '';
      pages[k] = (Object.hasOwn(pages, k) ? pages[k] : 0) + added;
      // the latest address of that page (none for the "other pages" share)
      if (k && session.url) (rec.tu[domain] || (rec.tu[domain] = {}))[k] = session.url;
      // and the same time hour by hour, so an hour can show its own pages
      for (const [h, ms] of hours) {
        const whole = Math.round(ms);
        if (whole <= 0) continue;
        const slot = rec.th[h] || (rec.th[h] = {});
        const byHour = slot[domain] || (slot[domain] = {});
        byHour[k] = (Object.hasOwn(byHour, k) ? byHour[k] : 0) + whole;
      }
    }
    patch[storageKeyForDay(key)] = rec;
  }
  // Remember the exact address each site was visited on (for its icon and link).
  const origins = raw.origins || {};
  if (!priv && session.origin && origins[domain] !== session.origin) {
    patch.origins = { ...origins, [domain]: session.origin };
  }
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
}

// ---------- daily limit ----------

async function checkGoal(now) {
  const todayKey = dayKey(now);
  const history = await getGoalHistory();
  const limit = limitOn(history, todayKey);
  if (!limit) return;
  const raw = await chrome.storage.local.get([storageKeyForDay(todayKey), 'goalNotify']);
  const used = dayTotal(normalizeDay(raw[storageKeyForDay(todayKey)]));
  const prev = raw.goalNotify && raw.goalNotify.day === todayKey ? raw.goalNotify : { day: todayKey, n95: false, over: false };
  const next = { ...prev };

  if (used > limit && !prev.over) {
    next.over = true;
    next.n95 = true;
    await notify(`goal-over:${todayKey}`, 'You’ve gone over your daily limit',
      `Your ${formatDuration(limit)} limit is used up — you’re ${formatDuration(used - limit)} over.`);
  } else if (used >= limit * 0.95 && used <= limit && !prev.n95) {
    next.n95 = true;
    await notify(`goal-95:${todayKey}`, 'Almost at your daily limit',
      `${formatDuration(limit - used)} left of your ${formatDuration(limit)} limit today.`);
  }
  if (next.over !== prev.over || next.n95 !== prev.n95 || !raw.goalNotify || raw.goalNotify.day !== todayKey) {
    await chrome.storage.local.set({ goalNotify: next });
  }
}

// unpacked builds (Settings > Developer): the over-limit notification, as if this far over
async function devNotify(overMs) {
  const limit = limitOn(await getGoalHistory(), dayKey(new Date())) || 3600_000;
  await notify(`goal-over-dev:${overMs}:${Date.now()}`, 'You’ve gone over your daily limit',
    `Your ${formatDuration(limit)} limit is used up — you’re ${formatDuration(overMs)} over.`);
}

async function notify(id, title, message) {
  try {
    await chrome.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon128.png', title, message, priority: 1 });
  } catch { /* notifications may be blocked by the system */ }
}

// ---------- weekly reminder ----------

function nextReminderTime(settings, from = new Date()) {
  const day = Number.isInteger(settings.reminderDay) ? settings.reminderDay : 0;
  const mins = Number.isInteger(settings.reminderMinutes) ? settings.reminderMinutes : 19 * 60;
  const d = new Date(from);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  if (d <= from) d.setDate(d.getDate() + 7);
  return d.getTime();
}

async function scheduleWeekly(force = false) {
  if (!force && await chrome.alarms.get('weekly')) return;
  await chrome.alarms.clear('weekly');
  const settings = await getSettings();
  await chrome.alarms.create('weekly', { when: nextReminderTime(settings) });
}

async function ensureAlarms() {
  if (!(await chrome.alarms.get('heartbeat'))) {
    await chrome.alarms.create('heartbeat', { periodInMinutes: HEARTBEAT_MINUTES });
  }
  await scheduleWeekly(false);
}

async function weeklyReminder(alarm) {
  const scheduled = alarm.scheduledTime || Date.now();
  const late = Date.now() - scheduled > 2 * 24 * 3600_000;
  const settings = await getSettings();

  if (settings.weeklyReminder && !late) {
    const at = new Date(scheduled);
    // Early in the week, recap the week that just ended.
    const lastWeek = at.getDay() === 1 || at.getDay() === 2;
    const weekStart = lastWeek ? addDays(startOfWeek(at), -7) : startOfWeek(at);
    const days = await getDays(weekDayKeys(weekStart));
    const total = Object.values(days).reduce((sum, d) => sum + dayTotal(d), 0);
    if (total > 5 * 60_000) {
      const span = lastWeek ? 'last week' : at.getDay() === 0 ? 'this week' : 'this week so far';
      await notify(`weekly-recap:${dayKey(weekStart)}`, 'Your week in Memoir',
        `${formatDuration(total)} of browsing ${span}. See where your time went.`);
    }
  }
  await chrome.alarms.create('weekly', { when: nextReminderTime(settings, new Date(Date.now() + 60_000)) });
}

// over: the report opens with the flame's moment (shared/overshow.js); a number: a test
// one, that many ms over
async function openRecap(weekKey, { over = false } = {}) {
  const base = chrome.runtime.getURL('recap.html');
  const url = weekKey ? `${base}#week=${weekKey}` : over ? `${base}#over${over === true ? '' : `=${over}`}` : base;
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(t => t.url && t.url.startsWith(base));
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true, url });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

chrome.notifications.onClicked.addListener(id => {
  if (id.startsWith('weekly-recap')) openRecap(id.split(':')[1]);
  else if (id.startsWith('goal-over-dev:')) openRecap(null, { over: Number(id.split(':')[1]) });
  else if (id.startsWith('goal-')) openRecap(null, { over: id.startsWith('goal-over') });
  else return;
  chrome.notifications.clear(id);
});

// ---------- housekeeping ----------

async function pruneOldDays() {
  const settings = await getSettings();
  const cutoff = retentionCutoffKey(settings.retention);
  if (!cutoff) return;
  const old = (await listDayKeys()).filter(k => k < cutoff).map(storageKeyForDay);
  if (old.length) await chrome.storage.local.remove(old);
}

// page titles and their links older than the chosen weeks
async function pruneOldTitles() {
  const settings = await getSettings();
  await pruneTitles(settings.titleWeeks);
}

async function dailyHousekeeping() {
  const today = dayKey(new Date());
  const { lastPrune } = await chrome.storage.session.get('lastPrune');
  if (lastPrune === today) return;
  await chrome.storage.session.set({ lastPrune: today });
  await pruneOldDays();
  await pruneOldTitles();
}

async function boot() {
  await ensureAlarms();
  await enqueue(async () => { await pruneOldDays(); await pruneOldTitles(); });
  sync();
}

// ---------- events ----------

chrome.runtime.onInstalled.addListener(boot);
// a fresh install opens the report, where a welcome and a short tour are waiting
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('recap.html') });
});
chrome.runtime.onStartup.addListener(boot);

chrome.tabs.onActivated.addListener(sync);
chrome.tabs.onRemoved.addListener(sync);
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!tab.active) return;
  if (info.url || info.audible !== undefined) sync();
  else if (info.title && titlesOn !== false) syncSoon();
});
chrome.windows.onFocusChanged.addListener(sync);
chrome.idle.onStateChanged.addListener(sync);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    sync();
    const o = changes.settings.oldValue || {};
    const n = changes.settings.newValue || {};
    titlesOn = !!n.titles;
    if (o.reminderDay !== n.reminderDay || o.reminderMinutes !== n.reminderMinutes) enqueue(() => scheduleWeekly(true));
    if (o.retention !== n.retention) enqueue(pruneOldDays);
    if (o.titleWeeks !== n.titleWeeks) enqueue(pruneOldTitles);
  }
  if (changes.goal) enqueue(() => checkGoal(Date.now()));
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'heartbeat') {
    sync();
    enqueue(dailyHousekeeping);
  } else if (alarm.name === 'weekly') enqueue(() => weeklyReminder(alarm));
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === 'sync') {
    sync().then(() => reply({ ok: true }));
    return true;
  }
  if (msg && msg.type === 'devNotify' && !('update_url' in chrome.runtime.getManifest()) && msg.overMs > 0) {
    devNotify(msg.overMs).then(() => reply({ ok: true }));
    return true;
  }
  if (msg && msg.type === 'openRecap') {
    openRecap(msg.week).then(() => reply({ ok: true }));
    return true;
  }
  return false;
});

ensureAlarms();
