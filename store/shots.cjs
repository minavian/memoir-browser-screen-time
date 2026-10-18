// The Chrome Web Store images, made from Memoir's own pages: five 1280 × 800 screenshots and the
// 440 × 280 small promo tile, written to store/images/.
//
//   node store/shots.cjs
//
// Needs Playwright and Microsoft Edge (Chrome ignores --load-extension); set PLAYWRIGHT and EDGE if
// they aren't where they are on the owner's PC. The extension is loaded unpacked from this folder,
// with half a year of made-up browsing (nobody's real history). Text is in Inter, Memoir's own
// bundled font (fonts/InterVariable-memoir.woff2), even where the shots are made on a Mac: SF Pro must
// never appear in them (its licence covers Apple platforms only). The clock shows as it does in the
// app, with the Rainbow clock off (the owner's yes, 2026-10-18).
//
// 1 the week, whole; 2 the popup; then features up close, so the five don't all look alike:
// 3 a day opened (its hours and its sites); 4 the daily limit's ring, being set; 5 Trend over time, on Dark.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'C:/Users/messo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const EXT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'images');
// The screenshots are 1280 × 800, of the pages laid out at 1440 × 900 (a usual laptop's room), drawn
// at that scale by Chrome itself so text stays sharp
const W = 1280, H = 800, LAYOUT = { width: 1440, height: 900 };

// Inter on any computer, and no drawn cursor, text caret or Rainbow clock. Added once the page is parsed: a style
// added before that goes away with the blank document a page starts as.
function storeLook() {
  try { localStorage.setItem('bst-cursor', 'off'); localStorage.removeItem('bst-rainbow'); } catch {}
  document.addEventListener('readystatechange', () => {
    const s = document.createElement('style');
    s.textContent = ':root, :root[data-theme] { --font: "Memoir Inter", sans-serif !important; --font-display: "Memoir Inter", sans-serif !important; } * { caret-color: transparent !important; }';
    document.head.appendChild(s);
  }, { once: true });
}

// Half a year of believable browsing: about three hours a day by now, a little more each week further
// back (so Trend over time slopes gently down), busiest mid-morning and evening, a limit of 3 h 30 m
// set ten days ago. A fixed seed, so every run draws the same weeks.
function seed({ withLimit }) {
  let x = 11;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const pad = n => String(n).padStart(2, '0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sites = [['youtube.com', 9], ['github.com', 7], ['docs.google.com', 6], ['mail.google.com', 5],
    ['reddit.com', 4], ['stackoverflow.com', 4], ['netflix.com', 3], ['wikipedia.org', 3], ['notion.so', 3],
    ['figma.com', 3], ['open.spotify.com', 2], ['nytimes.com', 2], ['amazon.com', 2], ['duolingo.com', 1]];
  const total = sites.reduce((a, [, w]) => a + w, 0);
  const pick = () => { let r = rnd() * total; for (const [d, w] of sites) if ((r -= w) <= 0) return d; return sites[0][0]; };
  const m = 60000, now = new Date(), DAYS = 26 * 7;
  const data = { onboarded: true, popupIntroduced: true, origins: {} };
  for (const [d] of sites) data.origins[d] = `https://${d}`;
  const weekly = Array.from({ length: 27 }, () => 0.9 + rnd() * 0.2);
  for (let back = DAYS - 1; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const drift = (1 + 0.45 * (back / DAYS)) * weekly[Math.floor(back / 7)];
    const s = {}, h = new Array(24).fill(0), hs = {};
    const last = back === 0 ? now.getHours() : 23;
    for (let hr = 8; hr <= last; hr++) {
      const peak = (hr >= 9 && hr <= 11) || (hr >= 19 && hr <= 22);
      let left = Math.round(60 * (peak ? 0.42 : 0.13) * (weekend ? 1.2 : 1) * drift * (0.55 + rnd() * 0.7)) * m;
      left = Math.min(left, 60 * m);
      while (left > 0) {
        const d = pick(), t = Math.min(left, Math.round(2 + rnd() * 14) * m);
        s[d] = (s[d] || 0) + t; h[hr] += t; (hs[hr] ??= {})[d] = (hs[hr][d] || 0) + t; left -= t;
      }
    }
    data[`day:${key(day)}`] = { s, h, hs, ti: {}, th: {}, tu: {}, tp: [] };
  }
  if (withLimit) data.goal = { history: [{ from: key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10)), limit: 210 * m }] };
  return chrome.storage.local.set(data);
}

async function browser(scheme, { withLimit = true, viewport = LAYOUT, scale = W / LAYOUT.width } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mx'));
  const ctx = await chromium.launchPersistentContext(dir, {
    executablePath: EDGE, headless: true, colorScheme: scheme, viewport, deviceScaleFactor: scale,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  // nothing of the shoot itself is counted (Memoir's own tab would show up in Most used):
  // the tracker sees a locked screen, ends the visit in progress, and the made-up weeks go in after
  await sw.evaluate(() => { chrome.idle.queryState = async () => 'locked'; });
  for (const p of ctx.pages()) await p.close().catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  await sw.evaluate(seed, { withLimit });
  await sw.evaluate(() => chrome.storage.session.clear());
  await ctx.addInitScript(storeLook);
  const open = async (file, wait = 4000) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error(`${file}: ${e.message}`));
    await page.goto(`chrome-extension://${id}/${file}`);
    await page.evaluate(() => document.fonts.load('700 44px "Memoir Inter"'));
    await page.waitForTimeout(wait);
    return page;
  };
  return { open, close: () => ctx.close().then(() => fs.rmSync(dir, { recursive: true, force: true })) };
}

const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, name), ...opts }).then(() => console.log('made', name));

// Up close: a 16:10 part of the page around `box` (with `margin` of room), drawn at the scale that
// makes it 1280 × 800, so it's as sharp as the rest (not an enlarged screenshot)
async function closeUp(page, box, name, margin) {
  let w = Math.max(box.width + 2 * margin, (box.height + 2 * margin) * (W / H));
  w = Math.min(Math.ceil(w / 16) * 16, LAYOUT.width); // whole pixels both ways (16:10), so it comes out exactly 1280 × 800
  const h = w * (H / W);
  const x = Math.min(Math.max(0, box.x + box.width / 2 - w / 2), LAYOUT.width - w);
  const y = Math.min(Math.max(0, box.y + box.height / 2 - h / 2), LAYOUT.height - h);
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: w, height: h, scale: W / w + 1e-7 } });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'));
  console.log('made', name);
  await cdp.detach();
}

// one card on its own: everything else on the page out of sight, the page's background around it
const alone = (page, selector) => page.addStyleTag({ content: `.head, .card:not(${selector}) { visibility: hidden !important; }` });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // 1: the week, whole; 3: the week's busiest day opened from Daily activity, up close
  {
    const b = await browser('light');
    const page = await b.open('recap.html');
    await shot(page, '1-report.png');
    await page.evaluate(() => {
      const cols = [...document.querySelectorAll('#plot .col')];
      const height = c => c.querySelector('.stack')?.offsetHeight || 0;
      cols.reduce((a, c) => (height(c) > height(a) ? c : a), cols[0]).querySelector('.day-btn').click();
    });
    await page.waitForTimeout(2500);
    await page.mouse.move(LAYOUT.width - 2, LAYOUT.height - 2);
    await alone(page, '#chart-card');
    await closeUp(page, await page.locator('#chart-card').boundingBox(), '3-day.png', 40);
    await b.close();
  }

  // 2: the popup, as it opens from the toolbar, on the page's own background
  {
    const b = await browser('light');
    const page = await b.open('store/frame.html', 4500);
    await shot(page, '2-popup.png');
    await b.close();
  }

  // 4: the daily limit's ring, being set to 3 h 30 m (no limit yet), up close over the dimmed report
  {
    const b = await browser('light', { withLimit: false });
    const page = await b.open('recap.html');
    await page.click('#goal-ring .gr-set');
    await page.waitForTimeout(1400);
    await page.keyboard.type('3', { delay: 120 });
    await page.waitForTimeout(700);
    await page.keyboard.type('30', { delay: 120 });
    await page.waitForTimeout(1200);
    await closeUp(page, await page.locator('.pk').boundingBox(), '4-limit.png', 70);
    await b.close();
  }

  // 5: Trend over time, 24 weeks, on Dark, up close
  {
    const b = await browser('dark');
    const page = await b.open('recap.html');
    await page.click('#trend-btn');
    await page.waitForTimeout(1600);
    await page.click('#chart-card [data-weeks="24"]');
    await page.waitForTimeout(2200);
    await page.mouse.move(LAYOUT.width - 2, LAYOUT.height - 2);
    await alone(page, '#chart-card');
    await closeUp(page, await page.locator('#chart-card').boundingBox(), '5-trend-dark.png', 40);
    await b.close();
  }

  // the small promo tile: the clock and MEMOIR, on Dark
  {
    const b = await browser('dark', { viewport: { width: 440, height: 280 }, scale: 1 });
    const page = await b.open('store/tile.html', 1500);
    await shot(page, 'promo-440x280.png');
    await b.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
