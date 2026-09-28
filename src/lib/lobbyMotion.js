// @ts-check
// The lobby's between-slides choreography (rebrand stage 4b): how one slide
// hands off to the next, and the stinger's timing that a change into or out
// of a held slide rides on. Pure numbers and pure functions only; the
// components that play them are ManualSlideshow, CatalogScene and SlideCopy.
//
// Every value is on the brand rhythm (src/lib/brand.js): one 100 ms beat and
// the four curves. Where the kit's duration table has the right length it is
// used as-is; the rest are counted in beats.

import { DUR, EASE, beats } from './brand.js';

/* ── The stinger (a change that involves a held slide) ───────────── */

/** The whole sweep: up over the lobby, a short hold, and on up and away. */
export const STINGER_SEC = DUR.stinger * 2 + 0.08;
/** Mid-cover: the wave fills the screen from 47% to 53% of its run. */
export const SWAP_AT = STINGER_SEC * 0.5;

/* ── The hand-off (an ordinary slide to an ordinary slide) ───────── */

/**
 * The approved mockup's `handOff` + `landSlide`, in seconds. The outgoing
 * kicker, words and chip lift away one after another; the house wave swells
 * once; then the incoming kicker lands, its words land one by one and its
 * chip pops last. About one second, end to end.
 */
export const HANDOFF = {
  /** Each outgoing piece lifts away on the exit curve. */
  exit: DUR.exit,
  /** …a beat's worth of stagger between pieces… */
  exitStagger: beats(0.4),
  /** …capped, so a long headline never keeps the next slide waiting. */
  exitSpread: beats(2),
  /** The incoming copy waits this long for the outgoing to clear. */
  hold: beats(5),
  /** After a video fades away (there were no words to lift). */
  reveal: beats(4.5),
  /** The very first slide after the page loads. */
  boot: beats(2),
  kicker: beats(3.6),
  wordAt: beats(1.2),
  wordStagger: beats(0.7),
  word: DUR.settle,
  lineStagger: beats(1),
  chipAt: beats(2.6),
  chip: DUR.pop,
  /** The house wave's one swell, a little after the words start to leave. */
  swellAt: beats(1.8),
  swell: beats(7),
  /** The field's crossfade when two slides have different themes. */
  field: DUR.wipe,
  /** A video or poster fading in or out over the field. */
  media: DUR.wipe,
  /** The corner tab and house waves stepping aside for a poster or video. */
  chrome: DUR.wipe,
};

/** @typedef {'boot' | 'handoff' | 'wipe' | 'reveal'} Via */
/** @typedef {'copy' | 'video' | 'promo' | null} SlideKind */

/**
 * How long a newly mounted slide's copy holds before its first piece lands.
 * A wipe lands after the stinger has gone (the mockup's `wipe`), so the words
 * arrive on a clear screen rather than under the wave.
 * @param {Via} via
 */
export function entranceHold(via) {
  if (via === 'wipe') return STINGER_SEC;
  if (via === 'handoff') return HANDOFF.hold;
  if (via === 'reveal') return HANDOFF.reveal;
  return HANDOFF.boot;
}

/**
 * When outgoing piece `i` of `n` starts to lift: one stagger step each, but
 * never later than the spread cap, so the whole exit is over by
 * `exitSpread + exit` however long the headline.
 * @param {number} i
 * @param {number} n
 */
export function exitDelay(i, n) {
  if (n <= 1 || i <= 0) return 0;
  return Math.min(HANDOFF.exitStagger, HANDOFF.exitSpread / (n - 1)) * i;
}

/**
 * The swell's keyframes: flat until `swellAt`, up to its crest at 45% of the
 * swell, back to rest. Its last keyframe is the resting wave, which is the
 * frame ?lowPower=1 shows.
 * @param {string} crest the crest's offset (e.g. '-16%')
 */
export function swellKeyframes(crest) {
  const total = HANDOFF.swellAt + HANDOFF.swell;
  return {
    animate: { y: ['0%', '0%', crest, '0%'] },
    transition: {
      duration: total,
      times: [0, HANDOFF.swellAt / total, (HANDOFF.swellAt + HANDOFF.swell * 0.45) / total, 1],
      ease: /** @type {any[]} */ (['linear', EASE.settle, EASE.settle]),
    },
  };
}

/**
 * "Hold, then land" as one keyframe list per value: sit at `from` for `at`
 * seconds, then move to `to` over `dur` on `ease`. One animation from the
 * first frame, rather than `initial` plus a `delay`, because framer-motion
 * runs opacity on the browser's own timeline and a delayed opacity can paint
 * at its target before its beat (measured on this build; see CLAUDE.md's
 * promo notes). The last keyframe is always `to`, which is what ?lowPower=1
 * jumps to.
 *
 * @param {number} at seconds of hold
 * @param {number} dur seconds of movement
 * @param {Record<string, number | string>} from
 * @param {Record<string, number | string>} to
 * @param {any} ease the moving segment's curve
 */
export function holdThenLand(at, dur, from, to, ease) {
  const hold = Math.max(0, at);
  const total = hold + dur;
  /** @type {Record<string, Array<number | string>>} */
  const animate = {};
  for (const key of Object.keys(to)) {
    const start = key in from ? from[key] : to[key];
    animate[key] = hold > 0 ? [start, start, to[key]] : [start, to[key]];
  }
  const transition = hold > 0
    ? { duration: total, times: [0, hold / total, 1], ease: ['linear', ease] }
    : { duration: total, ease };
  return { initial: { ...from }, animate, transition };
}

/**
 * The outgoing half: hold at `from` for `at`, then go to `to` over `dur`.
 * Built the same way as holdThenLand, for exit variants.
 * @param {number} at
 * @param {number} dur
 * @param {Record<string, number | string>} from
 * @param {Record<string, number | string>} to
 * @param {any} ease
 */
export function holdThenLeave(at, dur, from, to, ease) {
  const { animate, transition } = holdThenLand(at, dur, from, to, ease);
  return { ...animate, transition };
}

/**
 * Leaving under the stinger: stay exactly as you are until the wave covers
 * the screen, then go in one frame. Nothing lifts or fades where the room
 * could see it half-done.
 * @param {Record<string, number | string>} rest
 * @param {Record<string, number | string>} gone
 */
export function vanishAtSwap(rest, gone) {
  return holdThenLeave(SWAP_AT, 0.01, rest, gone, 'linear');
}

/**
 * @typedef {{
 *   key: string,
 *   special: boolean,
 *   kind: SlideKind,
 *   theme: string,
 * }} SlideShowing
 *
 * @typedef {SlideShowing & {
 *   wipe: boolean,
 *   via: Via,
 *   wipes: number,
 *   swells: number,
 * }} SlideTransition
 */

/**
 * The lobby as it first appears: nothing to hand off from.
 * @param {SlideShowing} showing
 * @returns {SlideTransition}
 */
export function firstTransition(showing) {
  return { ...showing, wipe: false, via: 'boot', wipes: 0, swells: 0 };
}

/**
 * How the lobby got from what it was showing to `next`, captured once per
 * real change. A held slide on either side wipes (the stinger); an ordinary
 * slide after an ordinary slide hands off (words lift, the house wave swells,
 * the next words land); anything after a video reveals. The field keeps its
 * theme under a video or poster, so there is nothing to crossfade when the
 * lobby comes back to the same sky. The two counters key the stinger and the
 * swell, so each change plays each exactly once.
 *
 * @param {SlideTransition} seen
 * @param {SlideShowing} next
 * @returns {SlideTransition}
 */
export function nextTransition(seen, next) {
  if (seen.key === next.key) {
    // The same showing, edited in place (an editor save that re-themes or
    // re-marks the slide on screen): take the new facts, play nothing.
    const theme = next.kind === 'copy' ? next.theme : seen.theme;
    if (seen.special === next.special && seen.kind === next.kind && seen.theme === theme) return seen;
    return { ...seen, special: next.special, kind: next.kind, theme };
  }
  const wipe = seen.special || next.special;
  /** @type {Via} */
  const via = wipe ? 'wipe' : seen.kind === 'copy' ? 'handoff' : seen.kind ? 'reveal' : 'boot';
  const swell = !wipe && seen.kind === 'copy' && next.kind === 'copy';
  return {
    key: next.key,
    special: next.special,
    kind: next.kind,
    theme: next.kind === 'copy' || !seen.theme ? next.theme : seen.theme,
    wipe,
    via,
    wipes: seen.wipes + (wipe ? 1 : 0),
    swells: seen.swells + (swell ? 1 : 0),
  };
}

/**
 * @typedef {{ index: number, at: number }} Beat
 * @typedef {{
 *   pieces: number,
 *   kicker: Beat | null,
 *   lines: Array<Beat & { words: Array<Beat & { text: string }> }>,
 *   sub: Beat | null,
 *   chip: Beat | null,
 * }} CopyBeats
 */

/**
 * The beat sheet for one slide's copy: when each piece lands (seconds after
 * mount) and its place in the exit order (kicker, words or lines, the
 * supporting line, the chip). The kicker lands first, the headline's words
 * one by one (a read-layout headline line by line), the supporting line
 * after them and the chip pops last, all after `hold`.
 *
 * @param {{ kicker: unknown, headline: { mode: 'shout' | 'read', lines: string[][] }, sub: unknown, chip: unknown }} fit
 * @param {number} hold
 * @returns {CopyBeats}
 */
export function copyBeats(fit, hold) {
  let index = 0;
  const kicker = fit.kicker ? { index: index++, at: hold } : null;
  const shout = fit.headline.mode === 'shout';
  let word = 0;
  const lines = fit.headline.lines.map((line, li) => {
    const at = hold + HANDOFF.wordAt + HANDOFF.lineStagger * li;
    const lineBeat = shout ? { index: -1, at } : { index: index++, at };
    const words = shout
      ? line.map((text) => {
        const beat = { text, index: index++, at: hold + HANDOFF.wordAt + HANDOFF.wordStagger * word };
        word += 1;
        return beat;
      })
      : [];
    return { ...lineBeat, words };
  });
  const landed = hold + HANDOFF.wordStagger * (shout ? word : lines.length);
  const sub = fit.sub ? { index: index++, at: landed + HANDOFF.wordAt + HANDOFF.lineStagger } : null;
  const chip = fit.chip ? { index: index++, at: landed + HANDOFF.chipAt + (sub ? HANDOFF.lineStagger : 0) } : null;
  return { pieces: index, kicker, lines, sub, chip };
}
