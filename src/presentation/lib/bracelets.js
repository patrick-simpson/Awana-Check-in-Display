// @ts-check
// Bracelet Time (owner, 2026-09-30): on the two bracelet club nights the
// T&T and Sparks game windows become bracelet-making instructions on the
// wall. This file is the pure half: the steps' words, and the cadence that
// decides, from the clock alone, what the wall shows at any moment.
//
//   - An EPIC how-to (EPIC_SEC, all 13 steps at a child's pace) plays
//     EPIC_LEAD_SEC after the window opens and then every EPIC_EVERY_SEC,
//     as long as it can finish before the window ends.
//   - A CHIME sounds EPIC_LEAD_SEC before each showing, so the room looks up.
//   - The rest of the time the wall shows ONE step at a time, STEP_SEC each,
//     looping; the loop starts from step 1 after every epic.
//
// A leader can nudge the loop (next / previous step) or play the epic now;
// that state lives in the view, which hands `stepOffset` and `manualEpicAt`
// in here, so this stays a pure function of its inputs.

/** @typedef {{ n: number, kind: 'bead' | 'finish' | 'knot', color?: string, title: string, words: string }} BraceletStep */

/** The handout's steps, in its own words, split into a short title and the line under it. */
export const BRACELET_STEPS = Object.freeze(/** @type {BraceletStep[]} */ ([
  { n: 1, kind: 'bead', color: 'black', title: 'Add a black bead', words: 'Slide a black bead onto the string.' },
  { n: 2, kind: 'bead', color: 'red', title: 'Add a red bead', words: 'Slide a red bead on, next to the black one.' },
  { n: 3, kind: 'bead', color: 'white', title: 'Add a white bead', words: 'Slide a white bead onto the string.' },
  { n: 4, kind: 'bead', color: 'blue', title: 'Add a blue bead', words: 'Slide a blue bead onto the string.' },
  { n: 5, kind: 'bead', color: 'green', title: 'Add a green bead', words: 'Slide a green bead onto the string.' },
  { n: 6, kind: 'bead', color: 'yellow', title: 'Add a yellow bead', words: 'Slide a yellow bead onto the string.' },
  { n: 7, kind: 'finish', title: 'Clear beads, then tie', words: 'Add 1 clear bead to each side and tie it into place.' },
  { n: 8, kind: 'knot', title: 'Cross the ends', words: 'Cross the two sides over each other. Left over right.' },
  { n: 9, kind: 'knot', title: 'Wrap three times', words: 'Set the bottom string on your pointer finger. Wrap the top string under and around it three times.' },
  { n: 10, kind: 'knot', title: 'Make an X', words: 'It should make an X.' },
  { n: 11, kind: 'knot', title: 'Pinch the loops', words: 'Pinch the loops. Take your finger out.' },
  { n: 12, kind: 'knot', title: 'Thread the end through', words: 'Thread the end of the top string through the loops.' },
  { n: 13, kind: 'knot', title: 'Pull tight', words: 'Pull tight. You made a bracelet!' },
]));

/**
 * The bracelet club nights (the calendar's "Awana meeting (Making
 * Bracelets)"), hardcoded like the season promos: the shared schedule file is
 * untouched, so no other screen changes.
 */
export const BRACELET_NIGHTS = Object.freeze(['2026-09-30', '2026-10-07']);
/** The game windows that become Bracelet Time; Puggles & Cubbies stays game time. */
export const BRACELET_CLUBS = Object.freeze(['tnt', 'sparks']);

/** @param {Date} d */
function localKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Is this schedule window, on this date, Bracelet Time? Only a single-club
 * T&T or Sparks game window on a bracelet night (the device's local date, as
 * the rest of the projector keeps it).
 *
 * @param {{ kind?: string, clubs?: string[] } | null | undefined} window
 * @param {Date} now
 */
export function isBraceletWindow(window, now) {
  return Boolean(
    window && window.kind === 'game' && Array.isArray(window.clubs) && window.clubs.length === 1
    && BRACELET_CLUBS.includes(window.clubs[0]) && BRACELET_NIGHTS.includes(localKey(now)),
  );
}

/**
 * The window's start and end as instants on `now`'s day.
 * @param {{ startMin: number, endMin: number }} window
 * @param {Date} now
 */
export function windowSpan(window, now) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { startMs: day.getTime() + window.startMin * 60_000, endMs: day.getTime() + window.endMin * 60_000 };
}

export const STEP_SEC = 10;
export const EPIC_SEC = 90;
export const EPIC_EVERY_SEC = 5 * 60;
export const EPIC_LEAD_SEC = 10;
/** An epic never runs into the window's TWO MINUTES warning. */
export const EPIC_CLEAR_OF_END_SEC = 120;

/**
 * @typedef {{
 *   mode: 'intro' | 'epic' | 'steps',
 *   stepIndex: number,
 *   stepElapsedSec: number,
 *   stepStartMs: number,
 *   epicStartMs: number | null,
 *   epicElapsedSec: number,
 *   chime: boolean,
 *   nextEpicMs: number | null,
 *   cycle: string,
 * }} BraceletFrame
 */

/**
 * Every scheduled epic start inside [startMs, endMs), each one finishing
 * before the window's TWO MINUTES warning.
 * @param {number} startMs
 * @param {number} endMs
 * @returns {number[]}
 */
export function epicStarts(startMs, endMs) {
  const out = [];
  const lastEnd = endMs - EPIC_CLEAR_OF_END_SEC * 1000;
  for (let t = startMs + EPIC_LEAD_SEC * 1000; t + EPIC_SEC * 1000 <= lastEnd; t += EPIC_EVERY_SEC * 1000) out.push(t);
  return out;
}

/**
 * What the wall shows at `nowMs` inside a bracelet window.
 *
 * @param {number} nowMs
 * @param {number} startMs  the window's start
 * @param {number} endMs    the window's end
 * @param {{ stepOffset?: number, manualEpicAt?: number | null, epics?: boolean }} [nudges]
 *   epics: false turns the scheduled showings (and so their chimes) off; a
 *   manual "play now" still plays.
 * @returns {BraceletFrame}
 */
export function braceletFrame(nowMs, startMs, endMs, { stepOffset = 0, manualEpicAt = null, epics = true } = {}) {
  const starts = epics ? epicStarts(startMs, endMs) : [];
  if (manualEpicAt != null && manualEpicAt >= startMs && manualEpicAt < endMs) {
    starts.push(manualEpicAt);
    starts.sort((a, b) => a - b);
  }
  const epicMs = EPIC_SEC * 1000;
  const current = starts.filter((s) => s <= nowMs && nowMs < s + epicMs).pop() ?? null;
  const next = starts.find((s) => s > nowMs) ?? null;
  const chime = next != null && next - nowMs <= EPIC_LEAD_SEC * 1000 && current == null;

  if (current != null) {
    return {
      mode: 'epic', stepIndex: 0, stepElapsedSec: 0, stepStartMs: current, epicStartMs: current,
      epicElapsedSec: (nowMs - current) / 1000, chime: false, nextEpicMs: next, cycle: `epic:${current}`,
    };
  }

  // Before the very first epic: the title card that the opening chime rides on.
  const lastEnd = starts.filter((s) => s + epicMs <= nowMs).map((s) => s + epicMs).pop();
  if (lastEnd == null && starts.length > 0 && nowMs < starts[0] && starts[0] - nowMs <= EPIC_LEAD_SEC * 1000) {
    return {
      mode: 'intro', stepIndex: 0, stepElapsedSec: 0, stepStartMs: nowMs, epicStartMs: null, epicElapsedSec: 0,
      chime, nextEpicMs: next, cycle: 'intro',
    };
  }

  const loopFrom = lastEnd ?? startMs;
  const elapsed = Math.max(0, (nowMs - loopFrom) / 1000);
  const raw = Math.floor(elapsed / STEP_SEC) + stepOffset;
  const count = BRACELET_STEPS.length;
  const stepIndex = ((raw % count) + count) % count;
  const stepStartMs = loopFrom + Math.floor(elapsed / STEP_SEC) * STEP_SEC * 1000;
  return {
    mode: 'steps', stepIndex, stepElapsedSec: elapsed % STEP_SEC, stepStartMs, epicStartMs: null, epicElapsedSec: 0,
    chime, nextEpicMs: next, cycle: `steps:${loopFrom}`,
  };
}
