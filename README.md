# Content calendar — one feed, three viewers

A social content calendar: ~200 synthetic posts, generated once from a fixed
seed, shown as a table, a kanban board and a week/month calendar — all three
views of the same data, switchable with one toggle.

**[See it running](https://toclocoinc.github.io/lattice-grid-demo-content-calendar/)**

| | |
| --- | --- |
| Grid on npm | [@toclocoinc/lattice-grid](https://www.npmjs.com/package/@toclocoinc/lattice-grid) |
| Grid repository | [toclocoinc/latticegrid](https://github.com/toclocoinc/latticegrid) |
| Product site | [latticegrid.dev](https://www.latticegrid.dev) |

## What it shows

- **One feed, three viewers.** A single `createDataRouter({ key: 'kind', rowKey: 'id' })`
  carries two record kinds — `post` and `channel` — and routes them to a grid, a kanban
  board and a calendar, each attached with `router.attach(view, 'post')`. Edit a cell in
  the grid, drag a card on the board, or reschedule a card on the calendar, and the other
  two views pick it up without a refresh — no glue code keeps them in sync, the router is
  the sync.
- **The channel dictionary is a lookup, live.** The `channel` records (id, name, colour)
  feed the grid's Channel column through `lookup.options: { router, predicate: 'channel' }`
  and the calendar's `colorProperty`, so both read the same four channels from the same feed.
- **Table / board / calendar toggle**, plus a week/month toggle on the calendar.
- **Drag to reschedule.** The calendar is a direct router target (not grid-bound), so a
  reschedule updates the calendar's own row and then writes the new date through the
  router — the grid and the board update from that write, the same as any other delta.
- **A live delta.** "A new post arrives" pushes one upsert through the router; it appears
  in the table, the board and the calendar at once.
- **KPI row:** scheduled this week, posted, failed — the same router feed, reduced.

## Point events, not spans

Every post is a single point in time (`scheduledAt`, no end) — the calendar is built with
`startProperty: 'scheduledAt'` and no `endProperty`. That is the natural shape for a
scheduled social post: it goes out at one moment, not across a span of days, so this demo
never asks the calendar to draw a multi-day bar.

## Data

All data is generated in the browser from one seeded, deterministic generator
(`data.js`) — no server, no fetch, the same ~200 posts on every load. Four channels
(LinkedIn, X, Facebook, Instagram), post text from a small set of templates, a generated
SVG placeholder image on roughly 40% of posts (no third-party images), and
Posted/Scheduled/Failed/Draft statuses dated sensibly around today. Posted posts carry
view/like/comment/share counts.

## Architecture

```
data.js            the seeded post + channel generator
render-card.js      the DemandFlow-style card, shared by the calendar and the board
app.js              wiring: the router, the three views, the toggles, the live button
index.html          the page; the library loaded by pinned, SRI-checked <script> tags
```

## Running it locally

```
node tools/serve.mjs      # serves this folder; prints the local address
node tools/verify.mjs     # headless browser check (needs Chrome + puppeteer-core)
```

## Licence

Code in this repository: MIT (see `LICENSE`). The page carries a Lattice Grid licence key
bound to `toclocoinc.github.io`; it does nothing on any other domain, and `localhost` needs
no key at all.
