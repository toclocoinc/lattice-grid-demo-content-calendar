/**
 * The DemandFlow-style post card, as one HTML string, shared by the
 * calendar's `renderCard` and the kanban board's `cardRenderer`, so the two
 * views draw the same card from the same row.
 *
 * Colours follow the status table in DEMANDFLOW-FULLCALENDAR-USAGE.md.
 */

const STATUS_COLOURS = {
  Posted: { text: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  Scheduled: { text: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  Failed: { text: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  Draft: { text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

/** Escape text for safe placement inside the card's HTML. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * Render one post row as a card: channel dot + account, the post text
 * clamped to 3 lines, an image when present, a status badge with the time,
 * and a metrics row once the post has gone out.
 * @param {object} row a post row
 * @param {Map<string, {name: string, colour: string}>} channelsById the channel dictionary, keyed by id
 * @returns {string} the card's inner HTML
 */
export function cardHtml(row, channelsById) {
  const colours = STATUS_COLOURS[row.status] || STATUS_COLOURS.Draft;
  const channel = channelsById.get(row.channel);
  const time = row.scheduledAt
    ? new Date(row.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  const metrics = row.status === 'Posted'
    ? `<div class="post-card__metrics">${row.viewCount ?? 0} views &middot; ${row.likeCount ?? 0} likes &middot; ${row.commentCount ?? 0} comments &middot; ${row.shareCount ?? 0} shares</div>`
    : '';
  const image = row.image ? `<img class="post-card__image" src="${row.image}" alt="" />` : '';
  return `
    <div class="post-card" style="background:${colours.bg};border-top:3px solid ${colours.border}">
      <div class="post-card__head">
        <span class="post-card__dot" style="background:${channel ? channel.colour : '#999'}"></span>
        <span class="post-card__account">${escapeHtml(channel ? channel.name : row.channel)} &middot; ${escapeHtml(row.accountName)}</span>
        <span class="post-card__time">${time}</span>
      </div>
      <div class="post-card__text">${escapeHtml(row.text)}</div>
      ${image}
      <div class="post-card__status" style="color:${colours.text}">${escapeHtml(row.status)}</div>
      ${metrics}
    </div>
  `;
}
