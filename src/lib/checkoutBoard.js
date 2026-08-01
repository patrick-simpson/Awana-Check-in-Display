// @ts-check
// Should the who's-still-here board be on screen right now, and if so, may it
// name individuals?
//
// This is a PURE function on purpose, kept out of the component, because it is
// the safety-relevant part of the feature and it needs to be tested exhaustively
// rather than eyeballed in a browser.
//
// WHY THE BOARD IS GATED AT ALL
//
// The board's data is a list of children who are not yet with a parent. That is
// genuinely useful during pickup — a volunteer can see at a glance who is still
// waiting — and it is the one payload on this system where being wrong, or being
// read by the wrong person, actually matters. Three separate things are wrong
// with showing it unconditionally:
//
//  1. IT IS NOT A HEADCOUNT. It reflects whether volunteers PERFORMED checkout
//     in TwoTimTwo, which during a pickup rush they frequently do not. So it can
//     be *fresh* and *confidently wrong* — a state no staleness check can catch,
//     because the data really did just arrive.
//
//  2. A SHORT LIST IDENTIFIES INDIVIDUALS. Forty names is anonymising; two names
//     is a statement about two specific unattended children, arriving exactly
//     when the room has emptied and a stranger is most conspicuous. And
//     `checkin` already published those names earlier in the evening, so the
//     board is not adding a name — it is adding "and this one is still alone".
//
//  3. IT GOES QUIET NORMALLY. The scraper only runs while a volunteer has the
//     TwoTimTwo tab open, so silence is the expected end-of-night state, not a
//     fault. A frozen list that still looks live is the worst rendering.
//
// So: off by default, time-windowed, name-suppressed below a threshold, and
// aged rather than frozen.

/** Board states the component knows how to render. */
export const BOARD_HIDDEN = 'hidden';
export const BOARD_NAMES = 'names';
export const BOARD_ANONYMOUS = 'anonymous';
export const BOARD_STALE = 'stale';
export const BOARD_EMPTY = 'empty';

/**
 * @typedef {object} BoardDecision
 * @property {'hidden'|'names'|'anonymous'|'stale'|'empty'} state
 * @property {string} [reason] Why it is hidden/limited — for the operator, not the wall.
 * @property {number} [ageMin] How old the data is, when that matters.
 */

/**
 * @param {object} input
 * @param {{entries: {firstName: string, club: string}[], at: number, printed?: number}|null} input.checkout
 *   Latest sanitized `checkout` payload, or null if none has arrived.
 * @param {string} input.mode 'off' | 'pickup' | 'always'
 * @param {number} input.namesAbove Suppress names at or below this count. 0 disables.
 * @param {number} input.staleMin Minutes before the data is stale.
 * @param {string} input.phase Program phase from useSchedule ('off', 'pickup', …).
 * @param {number} input.now Epoch ms.
 * @returns {BoardDecision}
 */
export function decideBoard({ checkout, mode, namesAbove, staleMin, phase, now }) {
  if (mode !== 'pickup' && mode !== 'always') {
    return { state: BOARD_HIDDEN, reason: 'the board is switched off in Settings' };
  }
  // Nothing has ever arrived. Show NOTHING rather than an empty board: an empty
  // board reads as "everyone has been picked up", and we do not know that.
  if (!checkout || !Number.isFinite(checkout.at)) {
    return { state: BOARD_HIDDEN, reason: 'no checkout data has arrived yet' };
  }

  // 'pickup' restricts it to the part of the evening it is for. The board has no
  // business on the wall at 6:10pm when every child has just arrived.
  if (mode === 'pickup' && !PICKUP_PHASES.has(phase)) {
    return { state: BOARD_HIDDEN, reason: `not in the pickup window (phase: ${phase})` };
  }

  const ageMin = (now - checkout.at) / 60000;
  // A future timestamp means the two clocks disagree. Treat it as age zero
  // rather than as "fresh forever" — a skewed producer clock must not be able to
  // pin the board open indefinitely.
  const age = ageMin < 0 ? 0 : ageMin;
  if (age > staleMin) {
    return { state: BOARD_STALE, ageMin: Math.round(age), reason: 'the checkout tab is probably closed' };
  }

  const count = checkout.entries.length;
  // An empty board is real information and is safe to show: nobody is named, and
  // "everyone has been picked up" is exactly what a volunteer wants at 8:15.
  if (count === 0) return { state: BOARD_EMPTY, ageMin: Math.round(age) };

  if (namesAbove > 0 && count <= namesAbove) {
    return {
      state: BOARD_ANONYMOUS,
      ageMin: Math.round(age),
      reason: `only ${count} left — naming them would single out unattended children`,
    };
  }
  return { state: BOARD_NAMES, ageMin: Math.round(age) };
}

/**
 * Phases in which a pickup-mode board is allowed on screen.
 *
 * Deliberately generous at the tail: pickup runs past the end of the program,
 * and a board that vanishes the moment the schedule says "off" would disappear
 * precisely when the last few children are still waiting. The name-suppression
 * threshold, not the clock, is what protects that moment.
 */
export const PICKUP_PHASES = new Set(['closing', 'pickup', 'dismissal', 'after', 'off']);

/**
 * Group entries by club for rendering, largest club first, names sorted.
 * Deterministic so a re-render never reshuffles the wall.
 *
 * @param {{firstName: string, club: string}[]} entries
 * @returns {{club: string, names: string[]}[]}
 */
export function groupByClub(entries) {
  /** @type {Map<string, string[]>} */
  const byClub = new Map();
  for (const e of entries || []) {
    const club = e.club || 'Other';
    if (!byClub.has(club)) byClub.set(club, []);
    (byClub.get(club) || []).push(e.firstName);
  }
  return [...byClub.entries()]
    .map(([club, names]) => ({ club, names: [...names].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => b.names.length - a.names.length || a.club.localeCompare(b.club));
}
