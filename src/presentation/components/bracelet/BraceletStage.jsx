import React, { useEffect, useState } from 'react';
import { currentTime } from '../../hooks/useClock.js';
import { useLowPower } from '../../hooks/useLowPower.js';
import {
  EPIC_BEATS, EPIC_SEC, IDENTITY_CAMERA, currentEpicStep, epicShot, stepProgress,
} from '../../lib/braceletArt.js';
import { StepArt } from './StepArt.jsx';

// Bracelet Time on the wall: the clock drives the pictures. Both stages read
// currentTime() from useClock.js (so ?now= and ?freeze=1 hold here too) on a
// requestAnimationFrame loop capped near 30 fps, and hand StepArt nothing but
// numbers. `still` (or the projector's low-power switch, which also covers
// ?vr=1 and the OS's reduced motion) shows each step's finished picture with
// no camera: the loop then only wakes a few times a second, to notice the
// epic moving on to its next beat.

export { currentEpicStep };

const MOVING_FPS = 30;
/** A still stage only wakes to notice the epic's next beat; the caption under
 *  the stage reads the beat at the same rate (useEpicStep), so the two turn
 *  over together. */
const STILL_FPS = 15;

const raf = (fn) => (typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame(fn)
  : setTimeout(() => fn(Date.now()), 1000 / MOVING_FPS));
const caf = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

const secondsSince = (startMs) => (currentTime().getTime() - Number(startMs)) / 1000;
const exact = (sec) => (Number.isFinite(sec) ? Math.round(sec * 1000) / 1000 : 0);

/**
 * `pick(seconds since startMs)`, re-read at most `fps` times a second while
 * `on`. A pick that comes back unchanged renders nothing (React bails out),
 * so a still stage or a frozen clock costs no renders at all.
 */
function useStageClock(startMs, pick, fps, on) {
  const [value, setValue] = useState(() => pick(secondsSince(startMs)));
  useEffect(() => {
    if (!on) return undefined;
    let id = 0;
    let last = -Infinity;
    let alive = true;
    const every = 1000 / fps - 2;
    const tick = (now) => {
      if (!alive) return;
      if (now - last >= every) {
        last = now;
        setValue(pick(secondsSince(startMs)));
      }
      id = raf(tick);
    };
    id = raf(tick);
    return () => {
      alive = false;
      caf(id);
    };
  }, [startMs, pick, fps, on]);
  return value;
}

const beatIndexAt = (sec) => {
  const t = Number.isFinite(sec) ? sec : 0;
  if (t >= EPIC_SEC) return EPIC_BEATS.length - 1;
  const i = EPIC_BEATS.findIndex((b) => t >= b.start && t < b.end);
  return i < 0 ? 0 : i;
};

/**
 * One step, looping: the action at a child's pace, then its finished
 * picture held until the view moves on.
 *
 * @param {{ step: number, startMs: number, still?: boolean, className?: string }} props
 */
export function BraceletStage({ step, startMs, still = false, className }) {
  const lowPower = useLowPower();
  const frozen = still || lowPower;
  const sec = useStageClock(startMs, exact, MOVING_FPS, !frozen);
  const p = frozen ? 1 : stepProgress(step, sec);
  return <StepArt step={step} p={p} className={className} />;
}

/**
 * The 90 second epic: the intro, all 13 steps, the finale, with its camera.
 *
 * @param {{ startMs: number, still?: boolean, className?: string }} props
 */
export function EpicStage({ startMs, still = false, className }) {
  const lowPower = useLowPower();
  const frozen = still || lowPower;
  const moving = useStageClock(startMs, exact, MOVING_FPS, !frozen);
  const beatIndex = useStageClock(startMs, beatIndexAt, STILL_FPS, frozen);
  if (frozen) {
    const beat = EPIC_BEATS[beatIndex];
    return <StepArt step={beat.kind === 'step' ? beat.step : beat.kind} p={1} camera={IDENTITY_CAMERA} className={className} />;
  }
  const shot = epicShot(moving);
  return <StepArt step={shot.step ?? shot.beat.kind} p={shot.p} camera={shot.camera} className={className} />;
}

const stepAt = (sec) => currentEpicStep(Number.isFinite(sec) ? sec : 0);

/**
 * The epic's current step (0-12, or null for its intro and finale), read on
 * the stages' own clock rather than the page's one-second tick, so the
 * caption and the rail under the epic change in the same frame as its art.
 *
 * @param {number} startMs
 * @returns {number | null}
 */
export function useEpicStep(startMs) {
  return useStageClock(startMs, stepAt, STILL_FPS, true);
}

export default BraceletStage;
