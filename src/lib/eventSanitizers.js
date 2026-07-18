// @ts-check
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
//
// The typedefs below ARE the display's data surface: if a field isn't
// named here, nothing downstream can see it.

/**
 * @typedef {Object} CheckinEvent
 * @property {string} firstName First name only — never a full name.
 * @property {string} club
 * @property {boolean} isBirthday
 * @property {boolean} isFirstTimer
 * @property {string} [id] Producer uuid for live-vs-replay dedupe.
 * @property {number} [at] Epoch ms.
 */

/**
 * @typedef {Object} RecapEvent
 * @property {CheckinEvent[]} entries Deduplicatable entries only (id + at present).
 * @property {number} at Epoch ms.
 */

/**
 * @typedef {Object} TallyEvent
 * @property {Record<string, number>} counts Per-club whole counts.
 * @property {number} total
 * @property {number} at Epoch ms.
 */

/**
 * @typedef {Object} BirthdayEntry
 * @property {string} firstName
 * @property {string} club
 * @property {number} month 1–12 — calendar month only, never a year.
 * @property {number} day 1–31
 */

/**
 * @typedef {Object} BirthdaysEvent
 * @property {BirthdayEntry[]} entries
 */

/**
 * @typedef {Object} OpsEvent
 * @property {'print-failure'|'canary'|'selector-fail'} type
 * @property {number} at Epoch ms.
 * @property {string} [club]
 */

/**
 * @typedef {Object} CanaryEvent
 * @property {number} at Epoch ms.
 * @property {string} [nonce]
 */

const NAME_MAX = 40;
const ID_MAX = 64;
const RECAP_MAX = 30;
const BIRTHDAYS_MAX = 40;
const TALLY_CLUBS_MAX = 30;

/** @type {ReadonlyArray<OpsEvent['type']>} */
const OPS_TYPES = ['print-failure', 'canary', 'selector-fail'];

/**
 * @param {unknown} v
 * @param {number} max
 * @returns {string}
 */
function cleanString(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// ISO string or epoch → epoch ms, or null when unparseable.
/**
 * @param {unknown} v
 * @returns {number | null}
 */
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
 * @param {unknown} payload
 * @returns {CheckinEvent | null}
 */
export function sanitizeCheckin(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = /** @type {Record<string, unknown>} */ (payload);
  const firstName = cleanString(raw.firstName, NAME_MAX);
  if (!firstName) return null;
  /** @type {CheckinEvent} */
  const safe = {
    firstName,
    club: cleanString(raw.club, NAME_MAX),
    isBirthday: raw.isBirthday === true,
    isFirstTimer: raw.isFirstTimer === true,
  };
  const id = cleanString(raw.id, ID_MAX);
  if (id) safe.id = id;
  const at = toEpochMs(raw.at);
  if (at !== null) safe.at = at;
  return safe;
}

/**
 * `recap` — replay buffer of recent checkins. Entries without id + at
 * can't be deduped against live delivery, so they're dropped rather
 * than risk a double banner.
 * @param {unknown} payload
 * @returns {RecapEvent | null}
 */
export function sanitizeRecap(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = /** @type {Record<string, unknown>} */ (payload);
  if (!Array.isArray(raw.entries)) return null;
  /** @type {CheckinEvent[]} */
  const entries = [];
  for (const item of raw.entries.slice(0, RECAP_MAX)) {
    const safe = sanitizeCheckin(item);
    if (!safe || !safe.id || safe.at === undefined) continue;
    entries.push(safe);
  }
  const at = toEpochMs(raw.at);
  return { entries, at: at !== null ? at : Date.now() };
}

/**
 * `tally` — per-club counts. Numbers only: any non-numeric value (a
 * name smuggled into a count) is dropped, never passed through.
 * @param {unknown} payload
 * @returns {TallyEvent | null}
 */
export function sanitizeTally(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const obj = /** @type {Record<string, unknown>} */ (payload);
  const raw = obj.counts;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const at = toEpochMs(obj.at);
  if (at === null) return null;
  /** @type {Record<string, number>} */
  const counts = {};
  for (const [club, n] of Object.entries(raw).slice(0, TALLY_CLUBS_MAX)) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) continue;
    const key = cleanString(club, NAME_MAX);
    if (!key) continue;
    counts[key] = Math.floor(n);
  }
  const total = typeof obj.total === 'number' && Number.isFinite(obj.total) && obj.total >= 0
    ? Math.floor(obj.total)
    : Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total, at };
}

/**
 * `birthdays` — this week's birthday kids: first name, club, and the
 * birthday's calendar month/day only. No years, no last names, ever.
 * @param {unknown} payload
 * @returns {BirthdaysEvent | null}
 */
export function sanitizeBirthdays(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = /** @type {Record<string, unknown>} */ (payload);
  if (!Array.isArray(raw.entries)) return null;
  /** @type {BirthdayEntry[]} */
  const entries = [];
  for (const item of raw.entries.slice(0, BIRTHDAYS_MAX)) {
    if (!item || typeof item !== 'object') continue;
    const entry = /** @type {Record<string, unknown>} */ (item);
    const firstName = cleanString(entry.firstName, NAME_MAX);
    if (!firstName) continue;
    const month = typeof entry.month === 'number' ? Math.floor(entry.month) : NaN;
    const day = typeof entry.day === 'number' ? Math.floor(entry.day) : NaN;
    if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) continue;
    entries.push({ firstName, club: cleanString(entry.club, NAME_MAX), month, day });
  }
  return { entries };
}

/**
 * `ops` — operator telemetry. type/club/at only; anything else (and any
 * unknown type) is refused. These surface on status widgets, NEVER as a
 * public banner.
 * @param {unknown} payload
 * @returns {OpsEvent | null}
 */
export function sanitizeOps(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = /** @type {Record<string, unknown>} */ (payload);
  const type = OPS_TYPES.find((t) => t === raw.type);
  if (!type) return null;
  /** @type {OpsEvent} */
  const safe = { type, at: toEpochMs(raw.at) ?? Date.now() };
  const club = cleanString(raw.club, NAME_MAX);
  if (club) safe.club = club;
  return safe;
}

/**
 * `canary` — end-to-end pipe test.
 * @param {unknown} payload
 * @returns {CanaryEvent | null}
 */
export function sanitizeCanary(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = /** @type {Record<string, unknown>} */ (payload);
  const at = toEpochMs(raw.at);
  if (at === null) return null;
  /** @type {CanaryEvent} */
  const safe = { at };
  const nonce = cleanString(raw.nonce, ID_MAX);
  if (nonce) safe.nonce = nonce;
  return safe;
}
