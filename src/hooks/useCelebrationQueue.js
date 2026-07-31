// @ts-check
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Show one celebration at a time, queueing the rest.
 *
 * Three milestone paths can fire in the same instant — a night threshold, a
 * per-club threshold, and the every-Nth tally toast — and on a busy night they
 * cluster precisely because they're all driven by the same arriving children.
 * Before this, each rendered its own toast into the same corner and each fired
 * its own confetti burst, so a rush produced overlapping text and doubled
 * particles.
 *
 * Same idea as the check-in banner queue: nobody's moment gets stolen, it just
 * waits its turn.
 *
 * @param {number} holdMs How long each celebration stays up.
 * @returns {{ current: any, enqueue: (item: any) => void, depth: () => number }}
 */
export function useCelebrationQueue(holdMs) {
  const [current, setCurrent] = useState(/** @type {any} */ (null));
  const queueRef = useRef(/** @type {any[]} */ ([]));
  // Bumped on every enqueue so the promotion effect re-runs even when
  // `current` hasn't changed (queue grew while something was already showing).
  const [rev, setRev] = useState(0);

  const enqueue = useCallback((/** @type {any} */ item) => {
    if (item == null) return;
    queueRef.current.push(item);
    setRev((/** @type {number} */ n) => n + 1);
  }, []);

  // Promote the next celebration whenever the stage is free.
  useEffect(() => {
    if (current != null) return;
    if (queueRef.current.length === 0) return;
    setCurrent(queueRef.current.shift());
  }, [current, rev]);

  // Retire the current one after its hold, freeing the stage for the next.
  useEffect(() => {
    if (current == null) return undefined;
    const timer = setTimeout(() => setCurrent(null), holdMs);
    return () => clearTimeout(timer);
  }, [current, holdMs]);

  const depth = useCallback(() => queueRef.current.length, []);

  return { current, enqueue, depth };
}
