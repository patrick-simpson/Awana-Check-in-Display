// PRIVACY INVARIANT — DO NOT relax. One strict allowlist sanitizer per
// event type on the shared Pusher channel. Every incoming payload is
// reduced to exactly its allowlisted fields before anything else sees
// it: allergy info, contact info, last names, photos, and any future
// fields the check-in system might send must never reach the display.
//
// Each sanitizer returns null on garbage and never throws. Payload
// shapes are pinned by src/lib/__fixtures__/contract-vectors.json — a
// byte-identical mirror of the canonical copy in the printer repo
// (Print-TwoTimTwo-Labels/contract-vectors.json).

const NAME_MAX = 40;
const ID_MAX = 64;
const RECAP_MAX = 30;
const BIRTHDAYS_MAX = 40;
const TALLY_CLUBS_MAX = 30;

const OPS_TYPES = ['print-failure', 'canary', 'selector-fail'];

function cleanString(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// ISO string or epoch → epoch ms, or null when unparseable.
function toEpochMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/**
 * `checkin` v2 — the original four public fields plus optional `id`
 * (producer uuid, for live-vs-replay dedupe) and `at` (→ epoch ms).
 * Both stay optional so producer/consumer deploy order never matters.
 */
export function sanitizeCheckin(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const firstName = cleanString(payload.firstName, NAME_MAX);
  if (!firstName) return null;
  const safe = {
    firstName,
    club: cleanString(payload.club, NAME_MAX),
    isBirthday: payload.isBirthday === true,
    isFirstTimer: payload.isFirstTimer === true,
  };
  const id = cleanString(payload.id, ID_MAX);
  if (id) safe.id = id;
  const at = toEpochMs(payload.at);
  if (at !== null) safe.at = at;
  return safe;
}

/**
 * `recap` — replay buffer of recent checkins. Entries without id + at
 * can't be deduped against live delivery, so they're dropped rather
 * than risk a double banner.
 */
export function sanitizeRecap(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (!Array.isArray(payload.entries)) return null;
  const entries = [];
  for (const item of payload.entries.slice(0, RECAP_MAX)) {
    const safe = sanitizeCheckin(item);
    if (!safe || !safe.id || safe.at === undefined) continue;
    entries.push(safe);
  }
  const at = toEpochMs(payload.at);
  return { entries, at: at !== null ? at : Date.now() };
}

/**
 * `tally` — per-club counts. Numbers only: any non-numeric value (a
 * name smuggled into a count) is dropped, never passed through.
 */
export function sanitizeTally(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = payload.counts;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const at = toEpochMs(payload.at);
  if (at === null) return null;
  const counts = {};
  for (const [club, n] of Object.entries(raw).slice(0, TALLY_CLUBS_MAX)) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) continue;
    const key = cleanString(club, NAME_MAX);
    if (!key) continue;
    counts[key] = Math.floor(n);
  }
  const total = typeof payload.total === 'number' && Number.isFinite(payload.total) && payload.total >= 0
    ? Math.floor(payload.total)
    : Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total, at };
}

/**
 * `birthdays` — this week's birthday kids: first name, club, and the
 * birthday's calendar month/day only. No years, no last names, ever.
 */
export function sanitizeBirthdays(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (!Array.isArray(payload.entries)) return null;
  const entries = [];
  for (const item of payload.entries.slice(0, BIRTHDAYS_MAX)) {
    if (!item || typeof item !== 'object') continue;
    const firstName = cleanString(item.firstName, NAME_MAX);
    if (!firstName) continue;
    const month = typeof item.month === 'number' ? Math.floor(item.month) : NaN;
    const day = typeof item.day === 'number' ? Math.floor(item.day) : NaN;
    if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) continue;
    entries.push({ firstName, club: cleanString(item.club, NAME_MAX), month, day });
  }
  return { entries };
}

/**
 * `ops` — operator telemetry. type/club/at only; anything else (and any
 * unknown type) is refused. These surface on status widgets, NEVER as a
 * public banner.
 */
export function sanitizeOps(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (!OPS_TYPES.includes(payload.type)) return null;
  const safe = { type: payload.type, at: toEpochMs(payload.at) ?? Date.now() };
  const club = cleanString(payload.club, NAME_MAX);
  if (club) safe.club = club;
  return safe;
}

/** `canary` — end-to-end pipe test. */
export function sanitizeCanary(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const at = toEpochMs(payload.at);
  if (at === null) return null;
  const safe = { at };
  const nonce = cleanString(payload.nonce, ID_MAX);
  if (nonce) safe.nonce = nonce;
  return safe;
}
