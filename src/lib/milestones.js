// @ts-check
// Big-number night milestones.
//
// Distinct from the two existing milestone paths:
//   • config.milestoneEvery     — every Nth check-in this DEVICE saw (local).
//   • config.clubMilestoneEvery — every Nth check-in per club (broadcast).
//
// These are the church-wide round numbers ("the 100th kid tonight"), taken from
// the printer's authoritative `tonight.checkedIn` broadcast rather than a local
// count, because a screen that booted late or dropped its connection would hit
// its own "100" at the wrong moment — and two screens in the same building would
// disagree about when it happened.

/**
 * Thresholds that earn their own celebration, ascending.
 * @type {ReadonlyArray<number>}
 */
export const NIGHT_MILESTONES = [50, 100, 150, 200, 250, 300];

/**
 * Which thresholds a count crossed moving from `prev` to `next`.
 *
 * Crossing is judged on the TRANSITION, never on `next` alone, for two reasons
 * that both really happen:
 *   • the broadcast can jump by more than one (a batch reconcile, or a screen
 *     that missed a few events), so `next % 50 === 0` would miss 100 entirely
 *     if the count went 98 → 103;
 *   • a reconnect re-delivers the current total, and celebrating on arrival
 *     would re-fire every milestone already passed.
 *
 * Returns them ascending so a single big jump celebrates in order.
 *
 * @param {number} prev
 * @param {number} next
 * @param {ReadonlyArray<number>} [thresholds]
 * @returns {number[]}
 */
export function crossedMilestones(prev, next, thresholds = NIGHT_MILESTONES) {
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return [];
  if (next <= prev) return [];
  return thresholds.filter((t) => prev < t && next >= t).sort((a, b) => a - b);
}

/**
 * Copy for a night milestone. Deliberately not the generic "N kids!" the
 * every-Nth toast uses — the point of a named threshold is that it reads as an
 * occasion rather than another routine toast.
 *
 * @param {number} count
 * @returns {{ label: string, headline: string }}
 */
export function nightMilestoneCopy(count) {
  if (count >= 200) {
    return { label: 'Tonight is huge', headline: `${count} kids in the building!` };
  }
  if (count >= 100) {
    return { label: 'Triple digits', headline: `${count} kids tonight!` };
  }
  return { label: 'Milestone', headline: `${count} kids and counting!` };
}

/**
 * Is this milestone big enough for the escalated confetti burst?
 * @param {number} count
 * @returns {boolean}
 */
export function isBigMilestone(count) {
  return count >= 100;
}

/**
 * English ordinal for a kid-milestone night count: 5 → "5th", 25 → "25th".
 * Handles the 11/12/13 exceptions for completeness even though the current
 * milestone set (5/10/25/50) never hits them.
 * @param {number} n
 * @returns {string}
 */
export function ordinalNight(n) {
  const v = Math.abs(Math.trunc(n));
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] ?? 'th';
  return `${v}${suffix}`;
}
