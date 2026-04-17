import { useCallback, useEffect, useRef, useState } from 'react';

let nextId = 1;

/**
 * FIFO queue for check-in events. Shows one at a time — birthday /
 * first-timer events hold longer because their animations are richer.
 * Fresh events that arrive while one is on-screen join the back of the
 * queue, so nobody's moment is skipped.
 */
export function useCheckInQueue(config) {
  const [queue, setQueue] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const holdTimerRef = useRef(null);
  const gapTimerRef = useRef(null);

  const enqueue = useCallback((payload) => {
    if (!payload || !payload.firstName) return;
    setQueue((q) => [
      ...q,
      {
        id: nextId++,
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

    const hold = next.isBirthday || next.isFirstTimer
      ? config.specialDisplayMs
      : config.standardDisplayMs;

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

  useEffect(() => () => {
    clearTimeout(holdTimerRef.current);
    clearTimeout(gapTimerRef.current);
  }, []);

  return { currentEvent, enqueue, pending: queue.length };
}
