// The Chrome Web Store images, made from Memoir's own pages: five 1280 × 800 screenshots and the
// 440 × 280 small promo tile, written to store/images/.
//
//   node store/shots.cjs
//
// Needs Playwright and Microsoft Edge (Chrome ignores --load-extension); set PLAYWRIGHT and EDGE if
// they aren't where they are on the owner's PC. The extension is loaded unpacked from this folder,
// with a made-up fortnight of browsing (nobody's real history). Text is set in Inter (store/fonts,
// Open Font License), the font picked for the images on 2026-10-18; Memoir itself is unchanged, and
// SF Pro must never appear in them (its licence covers Apple platforms only). The clock shows as it
// does in the app, with the Rainbow clock off (the owner's yes, 2026-10-18).

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

// Inter in place of the system font, before anything is drawn (frames too: the popup's shot)
function interEverywhere() {
  const css = `@font-face { font-family: "Store Inter"; src: url("/store/fonts/InterVariable.ttf"); font-weight: 100 900; }
    :root, :root[data-theme] { --font: "Store Inter", sans-serif !important; --font-display: "Store Inter", sans-serif !important; }`;
  const add = () => {
    const s = document.createElement('style');
    s.textContent = css;
    document.documentElement.appendChild(s);
  };
  if (document.documentElement) add(); else document.addEventListener('readystatechange', add, { once: true });
  try { localStorage.setItem('bst-cursor', 'off'); localStorage.removeItem('bst-rainbow'); } catch {}
}

// Two weeks of believable browsing: about three hours a day, busiest mid-morning and evening,
// a limit of 3 h 30 m set ten days ago. A fixed seed, so every run draws the same weeks.
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
  const m = 60000, now = new Date();
  const data = { onboarded: true, popupIntroduced: true, origins: {} };
  for (const [d] of sites) data.origins[d] = `https://${d}`;
  for (let back = 13; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const s = {}, h = new Array(24).fill(0), hs = {};
    const last = back === 0 ? now.getHours() : 23;
    for (let hr = 8; hr <= last; hr++) {
      const peak = (hr >= 9 && hr <= 11) || (hr >= 19 && hr <= 22);
      let left = Math.round(60 * (peak ? 0.42 : 0.13) * (weekend ? 1.2 : 1) * (0.55 + rnd() * 0.7)) * m;
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
  await ctx.addInitScript(interEverywhere);
  const open = async (file, wait = 4000) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error(`${file}: ${e.message}`));
    await page.goto(`chrome-extension://${id}/${file}`);
    await page.evaluate(() => document.fonts.load('700 44px "Store Inter"'));
    await page.waitForTimeout(wait);
    return page;
  };
  return { ctx, open, url: file => `chrome-extension://${id}/${file}`, close: () => ctx.close().then(() => fs.rmSync(dir, { recursive: true, force: true })) };
}

const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, name), ...opts }).then(() => console.log('made', name));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // 1, 3 and 5: the report in Light and Dark, and a day opened from Daily activity
  for (const scheme of ['light', 'dark']) {
    const b = await browser(scheme);
    const page = await b.open('recap.html');
    await shot(page, scheme === 'light' ? '1-report.png' : '5-report-dark.png');
    if (scheme === 'light') {
      // the busiest weekday of the week shown
      await page.evaluate(() => {
        const cols = [...document.querySelectorAll('#plot .col')];
        const tallest = cols.reduce((a, c) => (c.querySelector('.stack')?.offsetHeight || 0) > (a.querySelector('.stack')?.offsetHeight || 0) ? c : a, cols[0]);
        tallest.querySelector('.day-btn').click();
      });
      await page.waitForTimeout(2500);
      await page.mouse.move(W - 4, H - 4);
      await shot(page, '3-day.png');
    }
    await b.close();
  }

  // 2: the popup, as it opens from the toolbar, on the page's own background
  {
    const b = await browser('light');
    const page = await b.open('store/frame.html', 4500);
    await shot(page, '2-popup.png');
    await b.close();
  }

  // 4: the daily limit's ring, being set (no limit yet)
  {
    const b = await browser('light', { withLimit: false });
    const page = await b.open('recap.html');
    await page.click('#goal-ring .gr-set');
    await page.waitForTimeout(1400);
    // 3 hours, then 30 minutes, typed as a person would
    await page.keyboard.type('3', { delay: 120 });
    await page.waitForTimeout(700);
    await page.keyboard.type('30', { delay: 120 });
    await page.waitForTimeout(1200);
    await shot(page, '4-limit.png');
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
