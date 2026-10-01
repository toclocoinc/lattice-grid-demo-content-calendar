/**
 * Synthetic social-post data for the content-calendar demo.
 *
 * Deterministic from one seed, so the published page always shows the same
 * ~200 posts spread across 8 weeks around the day it is generated. There is
 * no server and no fetch: every row is built in the browser from this file
 * alone.
 */

/** A tiny seeded PRNG (mulberry32), so every run of this file is identical. */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20261001;
const rng = mulberry32(SEED);
const pick = (list) => list[Math.floor(rng() * list.length)];
const int = (min, max) => min + Math.floor(rng() * (max - min + 1));

/** The channel dictionary: fed to the router under `kind: 'channel'`. */
export const CHANNELS = [
  { id: 'linkedin', name: 'LinkedIn', colour: '#0a66c2' },
  { id: 'x', name: 'X', colour: '#111111' },
  { id: 'facebook', name: 'Facebook', colour: '#1877f2' },
  { id: 'instagram', name: 'Instagram', colour: '#e1306c' },
];

const ACCOUNT_NAMES = {
  linkedin: 'Nova Robotics',
  x: '@novarobotics',
  facebook: 'Nova Robotics',
  instagram: 'novarobotics',
};

const TOPICS = [
  'our warehouse robots', 'the new dashboard', 'autonomous picking',
  'fleet management', 'the safety sensor update', 'battery life',
  'the mobile app', 'customer support', 'the public API', 'onboarding',
];

const TEMPLATES = [
  (t) => `Excited to share our latest update on ${t}.`,
  (t) => `Behind the scenes: how we build ${t} at Nova Robotics.`,
  (t) => `Join us next week for a live demo of ${t}.`,
  (t) => `Customer spotlight: see how teams use ${t} every day.`,
  (t) => `We're hiring — help us grow ${t}.`,
  (t) => `Milestone reached on ${t}.`,
  (t) => `A quick tip for getting more out of ${t}.`,
  (t) => `What ${t} taught us this quarter.`,
];

const STATUS_COLOURS_FOR_SVG = ['#0a66c2', '#111111', '#1877f2', '#e1306c'];

/** A small generated SVG placeholder image, as a data URI (no third-party assets). */
function placeholderImage(seedIndex) {
  const colour = STATUS_COLOURS_FOR_SVG[seedIndex % STATUS_COLOURS_FOR_SVG.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120">`
    + `<rect width="200" height="120" fill="${colour}"/>`
    + `<circle cx="${30 + (seedIndex % 5) * 30}" cy="60" r="22" fill="#ffffff" opacity="0.25"/>`
    + `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Build one synthetic post for day offset `dayOffset` from `today` (negative = past). */
function buildPost(index, today, dayOffset) {
  const channel = pick(CHANNELS);
  const date = new Date(today);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(int(7, 20), pick([0, 15, 30, 45]), 0, 0);
  const inPast = dayOffset < 0;
  const status = inPast
    ? pick(['Posted', 'Posted', 'Posted', 'Posted', 'Posted', 'Posted', 'Posted', 'Posted', 'Failed', 'Draft'])
    : pick(['Scheduled', 'Scheduled', 'Scheduled', 'Scheduled', 'Scheduled', 'Scheduled', 'Scheduled', 'Scheduled', 'Scheduled', 'Draft']);
  const text = pick(TEMPLATES)(pick(TOPICS));
  const hasImage = rng() < 0.4;
  const post = {
    kind: 'post',
    id: `post-${index}`,
    channel: channel.id,
    accountName: ACCOUNT_NAMES[channel.id],
    text,
    image: hasImage ? placeholderImage(index) : null,
    status,
    scheduledAt: date.toISOString(),
  };
  if (status === 'Posted') {
    post.viewCount = int(80, 12000);
    post.likeCount = int(2, Math.round(post.viewCount * 0.08));
    post.commentCount = int(0, Math.round(post.likeCount * 0.3));
    post.shareCount = int(0, Math.round(post.likeCount * 0.2));
  }
  return post;
}

/** ~200 posts spread over 8 weeks (56 days) centred on today, built once at module load. */
export function generatePosts(today = new Date()) {
  const posts = [];
  const count = 200;
  for (let i = 0; i < count; i += 1) {
    const dayOffset = int(-28, 27);
    posts.push(buildPost(i + 1, today, dayOffset));
  }
  return posts;
}

export const TODAY = new Date();
export const POSTS = generatePosts(TODAY);

/** A fresh post for the "new post arrives" button, scheduled a few minutes from now. */
export function newPost(index) {
  const channel = pick(CHANNELS);
  const date = new Date();
  date.setMinutes(date.getMinutes() + int(2, 20));
  return {
    kind: 'post',
    id: `post-live-${index}`,
    channel: channel.id,
    accountName: ACCOUNT_NAMES[channel.id],
    text: pick(TEMPLATES)(pick(TOPICS)),
    image: null,
    status: 'Scheduled',
    scheduledAt: date.toISOString(),
  };
}
