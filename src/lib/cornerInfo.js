// @ts-check
// The lobby's corner info, one item at a time (owner, 2026-09-27: "the lower
// right corner and upper right corner info can exist, but should only show
// one at a time, flipping in sequence with next slides and not showing up on
// paused slides. They should only update on each slide load.").
//
// Pure half: which items exist right now, which comes next, and the frozen
// snapshot of its value taken at a slide load. src/hooks/useCornerItem.js
// owns the state; App.jsx decides when a "slide load" happens and when the
// corner is hidden (a slide that holds check-ins, or the overlay feed).
//
// Problem indicators are NOT corner info: the connection / printer / name
// fault sticker keeps showing whenever there is a problem, whatever slide is
// up, because a dead pipe must never be silent.

import { weatherPresentation } from './weather.js';

/**
 * 12-hour clock parts for a timestamp, in the screen's own local time.
 * @param {number} ms
 * @returns {{ time: string, meridiem: 'AM' | 'PM' }}
 */
export function formatClock(ms) {
  const d = new Date(ms);
  const hours24 = d.getHours();
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return { time: `${hours12}:${minutes}`, meridiem };
}

/** @typedef {'clock' | 'tally' | 'weather'} CornerId */

/**
 * @typedef {{
 *   clock: boolean,
 *   tally: number,
 *   weather: { temp: number, code: number, isDay?: boolean, units?: string } | null,
 * }} CornerSource
 *
 * @typedef {{ id: CornerId, label: string, value: string, spoken: string, corner: 'top' | 'bottom' }} CornerSnapshot
 */

/**
 * The items that have something to say right now, in rotation order. The
 * tally waits for the night's first check-in, and the weather for a reading:
 * an empty chip is worse than no chip.
 * @param {CornerSource} src
 * @returns {CornerId[]}
 */
export function cornerIds(src) {
  /** @type {CornerId[]} */
  const ids = [];
  if (src.clock) ids.push('clock');
  if (Number.isFinite(src.tally) && src.tally > 0) ids.push('tally');
  if (src.weather && Number.isFinite(src.weather.temp)) ids.push('weather');
  return ids;
}

/**
 * The item after `current`, wrapping; the first one when `current` is gone
 * (its data vanished) or there was none; null when nothing exists.
 * @param {CornerId[]} ids
 * @param {CornerId | null} current
 * @returns {CornerId | null}
 */
export function nextCornerId(ids, current) {
  if (!ids.length) return null;
  const i = current ? ids.indexOf(current) : -1;
  return i === -1 ? ids[0] : ids[(i + 1) % ids.length];
}

/**
 * The item's value frozen at this moment: the corner does not tick between
 * slide loads. Clock and tally sit bottom-right, the weather top-right,
 * where the catalog pages keep them.
 * @param {CornerId} id
 * @param {CornerSource} src
 * @param {number} now
 * @returns {CornerSnapshot | null}
 */
export function snapshotCorner(id, src, now) {
  if (id === 'clock') {
    const { time, meridiem } = formatClock(now);
    return { id, label: 'Right now', value: time, spoken: `The time is ${time} ${meridiem}`, corner: 'bottom' };
  }
  if (id === 'tally') {
    const n = Math.max(0, Math.round(src.tally));
    return { id, label: 'Tonight', value: String(n), spoken: `${n} checked in tonight`, corner: 'bottom' };
  }
  if (id === 'weather' && src.weather) {
    const { label } = weatherPresentation(src.weather.code, src.weather.isDay);
    const temp = Math.round(src.weather.temp);
    return { id, label, value: `${temp}°`, spoken: `${temp} degrees, ${label}`, corner: 'top' };
  }
  return null;
}
