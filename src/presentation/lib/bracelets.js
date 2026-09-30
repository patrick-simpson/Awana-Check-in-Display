// @ts-check
// Bracelet Time (owner, 2026-09-30): on the two bracelet club nights the
// T&T and Sparks game windows become bracelet-making instructions on the
// wall. This file is the pure half: the steps' words, and the cadence that
// decides, from the clock alone, what the wall shows at any moment.
//
//   - An EPIC how-to (EPIC_SEC, all 13 steps at a child's pace) plays
//     EPIC_LEAD_SEC after the window opens and then every EPIC_EVERY_SEC,
//     as long as it can finish before the window ends.
//   - A CHIME sounds EPIC_LEAD_SEC before each showing, so the room looks up,
//     and the corner counts it down; the wall itself keeps showing its step.
//   - The rest of the time the wall shows ONE step at a time, each for its
//     own slot (STEP_SLOTS: a bead step is quick, a knot step gets the time
//     a child needs), looping; the loop starts from step 1 after every epic.
//
// A leader can play the epic now; that state lives in the view, which hands
// `manualEpicAt` in here, so this stays a pure function of its inputs.

/** @typedef {{ n: number, kind: 'bead' | 'finish' | 'knot', color?: string, title: string, words: string }} BraceletStep */

/** The handout's steps, in its own words, split into a short title and the line under it. */
export const BRACELET_STEPS = Object.freeze(/** @type {BraceletStep[]} */ ([
  { n: 1, kind: 'bead', color: 'black', title: 'Add a black bead', words: 'Slide a black bead onto the string.' },
  { n: 2, kind: 'bead', color: 'red', title: 'Add a red bead', words: 'Slide a red bead on, next to the black one.' },
  { n: 3, kind: 'bead', color: 'white', title: 'Add a white bead', words: 'Slide a white bead on, next to the red one.' },
  { n: 4, kind: 'bead', color: 'blue', title: 'Add a blue bead', words: 'Slide a blue bead on, next to the white one.' },
  { n: 5, kind: 'bead', color: 'green', title: 'Add a green bead', words: 'Slide a green bead on, next to the blue one.' },
  { n: 6, kind: 'bead', color: 'yellow', title: 'Add a yellow bead', words: 'Slide a yellow bead on, next to the green one.' },
  { n: 7, kind: 'finish', title: 'Clear beads, then knots', words: 'Add a clear bead on each side of your colors. Tie a knot next to each one.' },
  { n: 8, kind: 'knot', title: 'Cross the ends', words: 'Cross the two ends. Left over right.' },
  { n: 9, kind: 'knot', title: 'Wrap 3 times', words: 'Lay the bottom string along your pointer finger. Wrap the top string under and around it 3 times.' },
  { n: 10, kind: 'knot', title: 'See the X?', words: 'Your two strings should cross in an X on your finger.' },
  { n: 11, kind: 'knot', title: 'Pinch the loops', words: 'Pinch the 3 loops. Slide your finger out.' },
  { n: 12, kind: 'knot', title: 'Push the end through', words: 'Push the end of the top string through the 3 loops.' },
  { n: 13, kind: 'knot', title: 'Pull tight', words: 'Pull both ends tight. You made a bracelet!' },
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
 * Is `now` (the device's local date) a bracelet night? The controls panel and
 * its B shortcut exist only then, so no other night changes at all.
 * @param {Date} now
 */
export function isBraceletNight(now) {
  return BRACELET_NIGHTS.includes(localKey(now));
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
 * A single-club T&T or Sparks game window, on any date: what Bracelet Time
 * takes over on a bracelet night, and the window whose own club and end time
 * a forced wall ("Show Bracelet Time now") keeps.
 * @param {{ kind?: string, clubs?: string[] } | null | undefined} window
 */
export function isBraceletClubWindow(window) {
  return Boolean(
    window && window.kind === 'game' && Array.isArray(window.clubs) && window.clubs.length === 1
    && BRACELET_CLUBS.includes(window.clubs[0]),
  );
}

/**
 * The window a forced wall runs in outside the T&T and Sparks game windows:
 * T&T's (owner, 2026-09-30), from the moment the switch went on until
 * midnight, when the switch turns itself off. It has no end time to show.
 * @param {number} forceMs when "Show Bracelet Time now" went on
 * @param {Date} now
 */
export function forcedBraceletWindow(forceMs, now) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return {
    kind: 'game',
    clubs: ['tnt'],
    title: 'Bracelet Time',
    startMin: Math.max(0, Math.min(24 * 60, (forceMs - day) / 60_000)),
    endMin: 24 * 60,
  };
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

/**
 * How long each step stays up in the one-step loop, seconds: time for its
 * action at a child's pace, then a few seconds on the finished picture. The
 * bead steps are quick; step 7 and the knot steps get the time they need
 * (knot 3 is only a look at the X).
 */
export const STEP_SLOTS = Object.freeze([9, 9, 9, 9, 9, 9, 14, 15, 16, 12, 15, 16, 15]);
/** A step never starts less than this long before a showing. */
const LAST_SLOT_MIN_SEC = 4;
/** One pass through all the steps, seconds. */
export const LOOP_SEC = STEP_SLOTS.reduce((a, b) => a + b, 0);
/** Step i's slot, seconds. @param {number} i */
export const stepSlotSec = (i) => STEP_SLOTS[((Math.round(i) % STEP_SLOTS.length) + STEP_SLOTS.length) % STEP_SLOTS.length];
export const EPIC_SEC = 90;
export const EPIC_EVERY_SEC = 5 * 60;
export const EPIC_LEAD_SEC = 10;
/** An epic never runs into the window's TWO MINUTES warning. */
export const EPIC_CLEAR_OF_END_SEC = 120;

/**
 * @typedef {{
 *   mode: 'epic' | 'steps',
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
 * @param {{ manualEpicAt?: number | null, epics?: boolean }} [nudges]
 *   epics: false turns the scheduled showings (and so their chimes) off; a
 *   manual "play now" still plays.
 * @returns {BraceletFrame}
 */
export function braceletFrame(nowMs, startMs, endMs, { manualEpicAt = null, epics = true } = {}) {
  const epicMs = EPIC_SEC * 1000;
  let starts = epics ? epicStarts(startMs, endMs) : [];
  // "Play it now" wins over any scheduled showing it overlaps: that one is
  // dropped, so a press shortly before a scheduled epic is never cut off and
  // restarted from the top. It counts from the window's start on, and still
  // plays on a wall kept up past its end (a QuickNav pick when a club runs
  // late); a press made on an earlier window's wall never carries over.
  if (manualEpicAt != null && manualEpicAt >= startMs) {
    starts = starts.filter((s) => s + epicMs <= manualEpicAt || s >= manualEpicAt + epicMs);
    starts.push(manualEpicAt);
    starts.sort((a, b) => a - b);
  }
  const current = starts.filter((s) => s <= nowMs && nowMs < s + epicMs).pop() ?? null;
  const next = starts.find((s) => s > nowMs) ?? null;
  const chime = next != null && next - nowMs <= EPIC_LEAD_SEC * 1000 && current == null;

  if (current != null) {
    return {
      mode: 'epic', stepIndex: 0, stepElapsedSec: 0, stepStartMs: current, epicStartMs: current,
      epicElapsedSec: (nowMs - current) / 1000, chime: false, nextEpicMs: next, cycle: `epic:${current}`,
    };
  }

  // No title card, even before the very first epic (owner, 2026-09-30: the
  // countdown must not take the whole screen): the wall opens on step 1, and
  // the ten seconds before every showing are the corner's countdown chip and
  // the chime, the first one included.
  const lastEnd = starts.filter((s) => s + epicMs <= nowMs).map((s) => s + epicMs).pop();

  const loopFrom = lastEnd ?? startMs;
  const elapsed = Math.max(0, (nowMs - loopFrom) / 1000);
  // Whole passes, then slot by slot through this one.
  const count = BRACELET_STEPS.length;
  let stepIndex = 0;
  let slotStart = Math.floor(elapsed / LOOP_SEC) * LOOP_SEC;
  while (slotStart + STEP_SLOTS[stepIndex] <= elapsed) {
    slotStart += STEP_SLOTS[stepIndex];
    stepIndex = (stepIndex + 1) % count;
  }
  // A step that would be up for only a moment before a showing never
  // starts: the one before it stays up until the showing (the wall's first
  // ten seconds are step 1 alone).
  if (next != null && slotStart > 0 && next - (loopFrom + slotStart * 1000) < LAST_SLOT_MIN_SEC * 1000) {
    stepIndex = (stepIndex - 1 + count) % count;
    slotStart -= STEP_SLOTS[stepIndex];
  }
  return {
    mode: 'steps', stepIndex, stepElapsedSec: elapsed - slotStart, stepStartMs: loopFrom + slotStart * 1000, epicStartMs: null, epicElapsedSec: 0,
    chime, nextEpicMs: next, cycle: `steps:${loopFrom}`,
  };
}
