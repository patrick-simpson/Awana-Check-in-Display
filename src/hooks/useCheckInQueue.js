import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * FIFO queue for check-in events. Shows one at a time — birthday /
 * first-timer events hold longer because their animations are richer.
 * Fresh events that arrive while one is on-screen join the back of the
 * queue, so nobody's moment is skipped.
 *
 * Burst mode: when a carpool's worth of kids scan at once, holding every
 * banner for the full 6s would put the screen minutes behind the door.
 * Once more than BURST_THRESHOLD events are waiting, each additional one
 * shrinks the hold by 15%, down to a floor that still reads comfortably.
 * The queue drains, then durations return to normal on their own.
 */
export const BURST_THRESHOLD = 2;
const BURST_FLOOR_MS = 2500;
const MAX_QUEUE = 100; // sanity cap against a runaway/duplicated feed

export function effectiveHoldMs(configuredMs, waiting) {
  const base = Number.isFinite(configuredMs) && configuredMs > 0 ? configuredMs : 6000;
  const over = Math.max(0, waiting - BURST_THRESHOLD);
  return Math.round(Math.max(BURST_FLOOR_MS, base * Math.pow(0.85, over)));
}

export function useCheckInQueue(config) {
  const [queue, setQueue] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const holdTimerRef = useRef(null);
  const gapTimerRef = useRef(null);
  const nextIdRef = useRef(1);

  const enqueue = useCallback((payload) => {
    if (!payload || !payload.firstName) return;
    setQueue((q) => [
      ...q.slice(0, MAX_QUEUE - 1),
      {
        id: nextIdRef.current++,
        firstName: payload.firstName,
        club: payload.club || '',
        isBirthday: !!payload.isBirthday,
        isFirstTimer: !!payload.isFirstTimer,
      },
    ]);
  }, []);

  useEffect(() => {
    if (currentEvent) return;
    if (queue.length === 0) return;
    // While the between-banner gap is running, wait for it to finish.
    if (gapTimerRef.current) return;

    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrentEvent(next);

    const configured = next.isBirthday || next.isFirstTimer
      ? config.specialDisplayMs
      : config.standardDisplayMs;
    // effectiveHoldMs also guards against bad config so a banner never
    // flashes (NaN/0 timeout) or sticks forever.
    const hold = effectiveHoldMs(configured, rest.length);

    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      setCurrentEvent(null);
      // Small gap so exit/enter animations don't clip into each other.
      gapTimerRef.current = setTimeout(() => {
        gapTimerRef.current = null;
        // Nudge the effect to re-run so it picks up any waiting event.
        setQueue((q) => q.slice());
      }, config.gapBetweenBannersMs);
    }, hold);
  }, [
    queue,
    currentEvent,
    config.standardDisplayMs,
    config.specialDisplayMs,
    config.gapBetweenBannersMs,
  ]);

  const skipCurrent = useCallback(() => {
    clearTimeout(holdTimerRef.current);
    clearTimeout(gapTimerRef.current);
    setCurrentEvent(null);
    gapTimerRef.current = setTimeout(() => {
      gapTimerRef.current = null;
      setQueue((q) => q.slice());
    }, config.gapBetweenBannersMs);
  }, [config.gapBetweenBannersMs]);

  useEffect(() => () => {
    clearTimeout(holdTimerRef.current);
    clearTimeout(gapTimerRef.current);
  }, []);

  return { currentEvent, enqueue, skipCurrent, pending: queue.length };
}
