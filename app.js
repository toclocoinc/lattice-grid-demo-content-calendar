// Wiring only. One Data Router feed carries two record kinds — 'post' and
// 'channel' — to three viewers of the same data: a grid, a kanban board and
// a calendar. Data lives in data.js; the shared card markup in
// render-card.js. Known defect to avoid (card 1604, fixed in 1.83.1): grid
// 1.83.0 draws a multi-day span bar as a band above the month grid, so this
// demo uses point events only (no endProperty) — see README.md.
import { CHANNELS, POSTS, newPost } from './data.js?v=20261003t';
import { cardHtml } from './render-card.js?v=20261003t';

const { createGrid } = LatticeGrid;
const { createDataRouter } = LatticeGridDataRouter;
const { createKanban } = LatticeGridKanban;
const { createCalendar } = LatticeGridCalendar;
const { createKPI } = LatticeGridKPI;

const el = (id) => document.getElementById(id);
const channelsById = new Map(CHANNELS.map((c) => [c.id, c]));
const colorMap = Object.fromEntries(CHANNELS.map((c) => [c.id, c.colour]));
const STATUSES = ['Draft', 'Scheduled', 'Posted', 'Failed'];

/** Whether an ISO date string falls inside the current Monday–Sunday week. */
function inThisWeek(iso) {
  if (!iso) return false;
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - day);
  const nextMonday = new Date(monday); nextMonday.setDate(monday.getDate() + 7);
  const d = new Date(iso);
  return d >= monday && d < nextMonday;
}

const router = createDataRouter({
  key: 'kind',
  rowKey: 'id',
  // Four viewers (grid, board, calendar, kpi) all route the same 'post'
  // value: fan it to every one of them rather than the first match only.
  overlap: true,
  onWrite: (change) => {
    router.apply([{ op: 'upsert', row: { ...change.row, [change.colId]: change.value } }]);
    return true;
  },
});

const columns = [
  { field: 'channel', title: 'Channel', type: 'lookup',
    lookup: { options: { router, predicate: 'channel', map: (r) => ({ id: r.id, label: r.name }) } } },
  { field: 'accountName', title: 'Account' },
  { field: 'text', title: 'Post' },
  { field: 'status', title: 'Status', edit: true, type: 'lookup', lookup: { options: STATUSES } },
  { field: 'scheduledAt', title: 'Scheduled', type: 'dateString', edit: true },
  { field: 'viewCount', title: 'Views', type: 'number' },
  { field: 'likeCount', title: 'Likes', type: 'number' },
  { field: 'commentCount', title: 'Comments', type: 'number' },
  { field: 'shareCount', title: 'Shares', type: 'number' },
];

const grid = createGrid(el('grid'), { rowKey: 'id', columns });
router.attach(grid, 'post', { writable: true });

const board = createKanban(el('board'), {
  rowKey: 'id',
  columnProperty: 'status',
  columns: STATUSES,
  cardRenderer: (card) => cardHtml(card.row, channelsById),
});
router.attach(board, 'post');

const calendar = createCalendar(el('calendar'), {
  rowKey: 'id',
  startProperty: 'scheduledAt',
  view: 'week',
  colorProperty: 'channel',
  colorMap,
  renderCard: (row, cardEl) => { cardEl.innerHTML = cardHtml(row, channelsById); },
  // Standalone (router-fed) calendar: a reschedule updates the calendar's own
  // row, then this writes it through the router so the grid and the board,
  // which see the same 'post' route, pick it up without a refresh.
  onCardMove: (event) => {
    const scheduledAt = event.to.start ? event.to.start.toISOString() : event.row.scheduledAt;
    router.apply([{ op: 'upsert', row: { ...event.row, scheduledAt } }]);
    return true;
  },
});
router.attach(calendar, 'post');

const kpi = createKPI(el('kpi'), {
  tiles: [
    { id: 'scheduledWeek', label: 'Scheduled this week', aggregation: 'count',
      filter: (r) => r.status === 'Scheduled' && inThisWeek(r.scheduledAt) },
    { id: 'posted', label: 'Posted', aggregation: 'count', filter: (r) => r.status === 'Posted' },
    { id: 'failed', label: 'Failed', aggregation: 'count', filter: (r) => r.status === 'Failed' },
  ],
});
router.attach(kpi, 'post');

router.load([...CHANNELS.map((c) => ({ kind: 'channel', id: c.id, name: c.name, colour: c.colour })), ...POSTS]);

// The three-way table / board / calendar toggle, each view keeping its place.
const views = { table: el('grid'), board: el('board'), calendar: el('calendar') };
function showView(name) {
  for (const [key, node] of Object.entries(views)) node.hidden = key !== name;
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
  }
}
for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => showView(button.dataset.view));
}
showView('table');

el('cal-week').addEventListener('click', () => calendar.setView('week'));
el('cal-month').addEventListener('click', () => calendar.setView('month'));

// A live delta: one new post pushed through the router, shown in all three views.
let liveIndex = 1;
el('new-post').addEventListener('click', () => {
  router.apply([{ op: 'upsert', row: newPost(liveIndex++) }]);
});

window.__demo = { router, grid, board, calendar, kpi, showView, channelsById };
