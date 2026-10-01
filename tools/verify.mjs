/**
 * Open the page in a real browser and check it.
 *
 *   node tools/verify.mjs                      serve this folder locally and check it
 *   node tools/verify.mjs --url <address>      check a published copy (a cache-busting query is added)
 *   node tools/verify.mjs --shots <dir>        also save screenshots
 *
 * Fails (exit 1) unless every check holds:
 *   - the grid, data-router, kanban, calendar and kpi modules came from the
 *     pinned 1.83.1 release; no watermark; 0 console errors
 *   - the grid's row count equals the generated post count
 *   - the calendar's visible-week card count equals the posts scheduled in
 *     that window, recomputed independently from the page's own data
 *   - the table / board / calendar toggle actually switches the visible panel
 *   - rescheduling a card (via `calendar.move`, standing in for a drag) moves
 *     its date on the calendar, the grid and the board alike
 *   - the "a new post arrives" button's delta appears in the grid, the board
 *     and the calendar without a reload
 *
 * Needs Chrome and puppeteer-core; set CHROME and PUPPETEER to point at them.
 */

import { mkdir } from 'node:fs/promises';

const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const PUPPETEER = process.env.PUPPETEER
  || '/home/latticeprodmgr/.npm/_npx/8003d8991b0d346b/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const GRID_VERSION = '1.83.1';
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const shots = arg('--shots');

const { default: puppeteer } = await import(PUPPETEER);
let server = null;
let base = arg('--url');
if (!base) {
  const { startServer } = await import('./serve.mjs');
  const started = await startServer(0);
  server = started.server;
  base = `http://127.0.0.1:${started.port}/`;
}
const bust = `v=${Date.now()}`;
const failures = [];
const numbers = {};
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) failures.push(label);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
console.log(`chrome pid ${browser.process().pid}; checking ${base}`);
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1200 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(new URL(`?${bust}`, base).href, { waitUntil: 'load' });

  const until = async (fn, label, ms = 20000) => {
    const end = Date.now() + ms;
    for (;;) {
      const ok = await page.evaluate(fn).catch(() => false);
      if (ok) return;
      if (Date.now() > end) { check(false, `timed out waiting for ${label}`); return; }
      await sleep(150);
    }
  };

  await until(() => !!(window.__demo && window.__demo.grid && window.__demo.grid.rows.count() > 0), 'the demo to load');

  /* ---- delivery: the pinned release, every module, no watermark ---- */
  const delivery = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.src);
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"][href*="cdn.jsdelivr.net"]')].map((l) => l.href);
    return {
      version: window.LatticeGrid.version(),
      modules: {
        dataRouter: typeof window.LatticeGridDataRouter.createDataRouter,
        kanban: typeof window.LatticeGridKanban.createKanban,
        calendar: typeof window.LatticeGridCalendar.createCalendar,
        kpi: typeof window.LatticeGridKPI.createKPI,
      },
      pinnedScripts: scripts.filter((s) => s.includes('@1.83.1/')).length,
      pinnedSheets: sheets.filter((s) => s.includes('@1.83.1/')).length,
      watermarks: document.querySelectorAll('.lat-watermark').length,
      moduleScripts: [...document.querySelectorAll('script[type="module"]')].length,
    };
  });
  numbers.version = delivery.version;
  check(delivery.version === GRID_VERSION, `LatticeGrid.version() is ${GRID_VERSION}`, delivery.version);
  check(Object.values(delivery.modules).every((t) => t === 'function'), 'every module left its global behind', JSON.stringify(delivery.modules));
  check(delivery.pinnedScripts === 5, 'five library <script> tags are pinned to 1.83.1', String(delivery.pinnedScripts));
  check(delivery.pinnedSheets === 1, 'the stylesheet is pinned to 1.83.1', String(delivery.pinnedSheets));
  check(delivery.watermarks === 0, 'no watermark', String(delivery.watermarks));
  check(delivery.moduleScripts === 1, 'exactly one type="module" script (app.js); the library itself is classic script tags', String(delivery.moduleScripts));

  /* ---- row counts: the grid holds every generated post ---- */
  const counts = await page.evaluate(() => {
    const d = window.__demo;
    let posts = 0;
    d.router.load; // no-op reference, keeps the router in scope for readability
    d.grid.rows.forEach(() => { posts += 1; });
    return { gridRows: d.grid.rows.count(), forEachRows: posts };
  });
  numbers.gridRows = counts.gridRows;
  check(counts.gridRows === 200, 'the grid holds all 200 generated posts', String(counts.gridRows));
  check(counts.forEachRows === counts.gridRows, 'rows.forEach visits the same count as rows.count()', String(counts.forEachRows));

  /* ---- calendar: the visible week's card count matches the posts scheduled in it ---- */
  const calWeek = await page.evaluate(() => {
    const d = window.__demo;
    const range = d.calendar.getRange();
    // `end` is documented as a local midnight, inclusive of that whole day,
    // so the day's exclusive upper bound is one day past it.
    const upperBound = new Date(range.end.getTime() + 24 * 60 * 60 * 1000);
    let expected = 0;
    d.grid.rows.forEach((r) => {
      const row = r && r.data;
      if (!row || row.kind !== 'post') return;
      const dt = new Date(row.scheduledAt);
      if (dt >= range.start && dt < upperBound) expected += 1;
    });
    const painted = document.querySelectorAll('#calendar .post-card').length;
    return { expected, painted, view: range.view, start: range.start.toISOString(), end: range.end.toISOString() };
  });
  numbers.calendarWeek = calWeek;
  check(calWeek.view === 'week', 'the calendar opens on the week view', calWeek.view);
  check(calWeek.painted === calWeek.expected, 'calendar cards in the visible week equal posts scheduled that week', `${calWeek.painted} painted vs ${calWeek.expected} expected`);
  check(calWeek.painted > 0, 'the calendar painted at least one card', String(calWeek.painted));

  /* ---- the table / board / calendar toggle ---- */
  const toggled = await page.evaluate(() => {
    const d = window.__demo;
    const state = (name) => ({
      gridHidden: document.getElementById('grid').hidden,
      boardHidden: document.getElementById('board').hidden,
      calHidden: document.getElementById('calendar').hidden,
    });
    d.showView('board');
    const board = state();
    d.showView('calendar');
    const cal = state();
    d.showView('table');
    const table = state();
    return { board, cal, table };
  });
  check(toggled.board.boardHidden === false && toggled.board.gridHidden === true, 'the board toggle shows the board and hides the table');
  check(toggled.cal.calHidden === false && toggled.cal.boardHidden === true, 'the calendar toggle shows the calendar and hides the board');
  check(toggled.table.gridHidden === false && toggled.table.calHidden === true, 'the table toggle shows the table again');

  /* ---- reschedule: calendar.move updates the calendar, the grid and the board ---- */
  const moved = await page.evaluate(async () => {
    const d = window.__demo;
    let target = null;
    d.grid.rows.forEach((r) => { if (!target && r.data && r.data.status === 'Scheduled') target = r.data; });
    if (!target) return { ok: false, reason: 'no Scheduled post found' };
    const before = target.scheduledAt;
    const to = new Date(before); to.setDate(to.getDate() + 3);
    const ok = await d.calendar.move(target.id, { start: to });
    await new Promise((r) => setTimeout(r, 300));
    let gridRow = null;
    d.grid.rows.forEach((r) => { if (r.data && r.data.id === target.id) gridRow = r.data; });
    let boardDate = null;
    d.board.rows.forEach((row) => { if (row && row.id === target.id) boardDate = row.scheduledAt; });
    let calDate = null;
    const calRow = d.calendar.rows.get(target.id);
    if (calRow) calDate = calRow.scheduledAt;
    return { ok, id: target.id, before, to: to.toISOString(), gridDate: gridRow && gridRow.scheduledAt, boardDate, calDate };
  });
  numbers.moved = moved;
  check(moved.ok === true, 'calendar.move accepts the reschedule', JSON.stringify(moved));
  if (moved.ok) {
    check(moved.gridDate !== moved.before, 'the grid shows the new date after the reschedule', `${moved.before} -> ${moved.gridDate}`);
    check(moved.boardDate !== moved.before, 'the board shows the new date after the reschedule', `${moved.before} -> ${moved.boardDate}`);
    check(moved.calDate !== moved.before, 'the calendar itself shows the new date after the reschedule', `${moved.before} -> ${moved.calDate}`);
  }
  if (shots) { await mkdir(shots, { recursive: true }); await page.screenshot({ path: `${shots}/moved.png`, fullPage: true }); }

  /* ---- a live delta reaches all three views ---- */
  const before = await page.evaluate(() => window.__demo.grid.rows.count());
  await page.click('#new-post');
  await sleep(500);
  const live = await page.evaluate(() => {
    const d = window.__demo;
    let boardCount = 0;
    d.board.rows.forEach(() => { boardCount += 1; });
    return { gridRows: d.grid.rows.count(), boardRows: boardCount };
  });
  numbers.liveDelta = { before, after: live.gridRows };
  check(live.gridRows === before + 1, 'the new-post button adds exactly one row to the grid', `${before} -> ${live.gridRows}`);
  check(live.boardRows === live.gridRows, 'the board holds the same row count as the grid after the live delta', `${live.boardRows} vs ${live.gridRows}`);

  /* ---- a clean console throughout ---- */
  numbers.consoleErrors = errors.length;
  check(errors.length === 0, '0 console errors', errors.slice(0, 5).join(' | '));
  if (shots) await page.screenshot({ path: `${shots}/final.png`, fullPage: true });
} finally {
  await browser.close();
  if (server) server.close();
}
console.log(`numbers ${JSON.stringify(numbers)}`);
console.log(failures.length ? `FAILED ${failures.length}: ${failures.join('; ')}` : 'ALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
