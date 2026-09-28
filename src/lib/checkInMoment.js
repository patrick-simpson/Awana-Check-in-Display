// @ts-check
// The words and sizes of one check-in moment, as pure functions, so the
// component (src/components/CheckInMoment.jsx) is only choreography.
//
// One moment for every kind of arrival, the catalog's club opener page
// played live: the child's club wave rises and carries the name. What
// changes between a birthday, a first-timer, a returning kid and a plain
// welcome is the kicker above the name, one line below it, and the hot
// sticker. The club colour never changes: the colour is the child's club.

/** @typedef {'birthday' | 'first' | 'back' | 'welcome'} Moment */

/**
 * Priority: birthday > first-timer > welcome-back > welcome, the same order
 * the old per-kind banners used (a rostered birthday child can never also be
 * a first-timer, and the printer never sets both first-timer and
 * welcome-back).
 * @param {{ isBirthday?: boolean, isFirstTimer?: boolean, welcomeBack?: boolean }} event
 * @returns {Moment}
 */
export function momentFor(event) {
  if (event.isBirthday) return 'birthday';
  if (event.isFirstTimer) return 'first';
  if (event.welcomeBack) return 'back';
  return 'welcome';
}

const KICKERS = {
  birthday: 'Happy birthday',
  first: 'Welcome to Awana Clubs',
  back: 'Welcome back',
  welcome: 'Welcome',
};

/**
 * The small label-voice line above the name. A recap replayed after a
 * reconnect is not an arrival happening now, so it says so.
 * @param {{ presentation?: string }} event
 * @param {Moment} moment
 */
export function kickerFor(event, moment) {
  if (event.presentation === 'replay') return 'Also joined us tonight';
  return KICKERS[moment];
}

const TAGLINES = {
  birthday: 'Hip hip hooray — it’s your special day!',
  first: 'We’re so glad you’re here for the very first time!',
  back: 'Welcome back for a brand-new season!',
};

/**
 * The one line under the name, or null.
 *
 * `ribbon` is the birthday-week label from src/lib/birthdayWeek.js ("Birthday
 * this Friday!"). The printer's isBirthday flag covers the whole ISO week, so
 * on a birthday moment the ribbon REPLACES the day-claiming tagline: "it's
 * your special day" is simply wrong on Wednesday for a Friday birthday. On a
 * plain welcome it rides along with the club's phrase, if there is one.
 *
 * @param {Moment} moment
 * @param {{ ribbon?: string | null, phrase?: string | null }} extras
 * @returns {string | null}
 */
export function sublineFor(moment, { ribbon = null, phrase = null } = {}) {
  if (moment === 'birthday') return ribbon || TAGLINES.birthday;
  if (moment === 'first' || moment === 'back') return TAGLINES[moment];
  const parts = [ribbon, phrase].filter((p) => typeof p === 'string' && p.trim() !== '');
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The hot sticker's lines, or null. Birthdays and first-timers only: the
 * catalog uses its one hot sticker for what is new or special, and a
 * sticker on every arrival would stop meaning anything.
 * @param {Moment} moment
 * @returns {string[] | null}
 */
export function stickerFor(moment) {
  if (moment === 'birthday') return ['Happy', 'birthday!'];
  if (moment === 'first') return ['New!'];
  return null;
}

/* ── The name's size ─────────────────────────────────────────────── */

// All in u, the moment's unit: 1u is 1% of a 16:9 stage's width (the CSS
// sets --u: min(1vw, 1.7778vh)). The name column runs from 24.6u to 3u shy
// of the right edge; NAME_ROOM leaves a little air for the hard shadow.
export const NAME_ROOM_U = 71;
// The catalog's own steps: short names shout biggest.
const STEPS = [[6, 10], [9, 8.6], [Infinity, 7.2]];
export const NAME_MIN_U = 3.2;

/**
 * The name's font size in u: the catalog step for its length, shrunk just
 * enough to fit the column on one line, never below NAME_MIN_U. Measured, so
 * a wide name ("WILLIAM") shrinks where a narrow one of the same length
 * ("JILLIAN") does not, and a name never breaks between letters.
 *
 * `wraps` is true only when even the smallest size cannot hold the name on
 * one line AND it has a space to break at: then it may wrap between words
 * (never inside one).
 *
 * @param {string} name       as displayed (upper-cased)
 * @param {(text: string) => number} measure  advance width at 1em
 * @returns {{ size: number, wraps: boolean }}
 */
export function nameSizeU(name, measure) {
  const text = String(name ?? '');
  const len = [...text].length;
  const step = STEPS.find(([max]) => len <= max)?.[1] ?? 7.2;
  const em = measure(text);
  const fit = em > 0 ? NAME_ROOM_U / em : step;
  const size = Math.max(NAME_MIN_U, Math.min(step, fit));
  return { size: Math.round(size * 100) / 100, wraps: fit < NAME_MIN_U && /\s/.test(text.trim()) };
}

/**
 * Per-letter animation costs a spring per glyph; past this many letters the
 * name animates per word instead, which reads the same from across a lobby.
 */
export const PER_LETTER_MAX = 14;
