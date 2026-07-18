import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckInQueue, effectiveHoldMs, BURST_THRESHOLD } from './useCheckInQueue.js';
import { BURST_FLOOR_MS, DEFAULT_HOLD_MS, MAX_QUEUE } from '../lib/constants.js';

const config = {
  standardDisplayMs: 6000,
  specialDisplayMs: 8000,
  gapBetweenBannersMs: 400,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useCheckInQueue', () => {
  it('shows queued events one at a time in FIFO order', () => {
    const { result } = renderHook(() => useCheckInQueue(config));

    act(() => {
      result.current.enqueue({ firstName: 'Amelia', club: 'Sparks' });
      result.current.enqueue({ firstName: 'Noah', club: 'Trek' });
    });

    expect(result.current.currentEvent.firstName).toBe('Amelia');
    expect(result.current.pending).toBe(1);

    // Standard banner expires, then the gap runs, then the next shows.
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.currentEvent).toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.currentEvent.firstName).toBe('Noah');
    expect(result.current.pending).toBe(0);
  });

  it('holds birthday and first-timer banners longer', () => {
    const { result } = renderHook(() => useCheckInQueue(config));

    act(() => result.current.enqueue({ firstName: 'Ava', isBirthday: true }));
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.currentEvent?.firstName).toBe('Ava');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.currentEvent).toBeNull();
  });

  it('ignores payloads without a firstName', () => {
    const { result } = renderHook(() => useCheckInQueue(config));

    act(() => {
      result.current.enqueue(null);
      result.current.enqueue({ club: 'Sparks' });
    });

    expect(result.current.currentEvent).toBeNull();
    expect(result.current.pending).toBe(0);
  });

  it('skipCurrent dismisses the banner and moves on after the gap', () => {
    const { result } = renderHook(() => useCheckInQueue(config));

    act(() => {
      result.current.enqueue({ firstName: 'Liam' });
      result.current.enqueue({ firstName: 'Emma' });
    });
    expect(result.current.currentEvent.firstName).toBe('Liam');

    act(() => result.current.skipCurrent());
    expect(result.current.currentEvent).toBeNull();
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.currentEvent.firstName).toBe('Emma');
  });

  it('shortens banners during a check-in rush so the queue drains', () => {
    const { result } = renderHook(() => useCheckInQueue(config));

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.enqueue({ firstName: `Kid${i}` });
      }
    });
    expect(result.current.currentEvent.firstName).toBe('Kid0');

    // 9 waiting → hold is compressed well below the configured 6s.
    const hold = effectiveHoldMs(6000, 9);
    act(() => vi.advanceTimersByTime(hold - 1));
    expect(result.current.currentEvent?.firstName).toBe('Kid0');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.currentEvent).toBeNull();
  });

  it('survives broken duration config without flashing banners', () => {
    const { result } = renderHook(() => useCheckInQueue({
      ...config,
      standardDisplayMs: NaN,
    }));

    act(() => result.current.enqueue({ firstName: 'Mason' }));
    expect(result.current.currentEvent.firstName).toBe('Mason');

    // Falls back to the 6s default instead of firing immediately.
    act(() => vi.advanceTimersByTime(5999));
    expect(result.current.currentEvent?.firstName).toBe('Mason');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.currentEvent).toBeNull();
  });

  it('caps the queue at MAX_QUEUE against a runaway feed', () => {
    const { result } = renderHook(() => useCheckInQueue(config));

    act(() => {
      for (let i = 0; i < MAX_QUEUE + 50; i++) {
        result.current.enqueue({ firstName: `Kid${i}` });
      }
    });

    // One on screen + the capped queue: never more than MAX_QUEUE in flight.
    expect(result.current.currentEvent.firstName).toBe('Kid0');
    expect(result.current.pending).toBe(MAX_QUEUE - 1);
  });

  it('normalizes the presentation field to live/replay/late only', () => {
    const { result } = renderHook(() => useCheckInQueue(config));

    act(() => {
      result.current.enqueue({ firstName: 'Zoe', presentation: 'replay' });
      result.current.enqueue({ firstName: 'Eli', presentation: 'late' });
      result.current.enqueue({ firstName: 'Ivy', presentation: 'sneaky-html' });
      result.current.enqueue({ firstName: 'Max' });
    });

    expect(result.current.currentEvent.presentation).toBe('replay');
    for (const expected of ['late', 'live', 'live']) {
      act(() => vi.advanceTimersByTime(6000 + 400)); // full hold + gap
      expect(result.current.currentEvent.presentation).toBe(expected);
    }
  });
});

describe('effectiveHoldMs', () => {
  it('keeps the full configured hold at or below the burst threshold', () => {
    for (let waiting = 0; waiting <= BURST_THRESHOLD; waiting++) {
      expect(effectiveHoldMs(6000, waiting)).toBe(6000);
    }
  });

  it('shrinks 15% per waiting event beyond the threshold', () => {
    expect(effectiveHoldMs(6000, BURST_THRESHOLD + 1)).toBe(5100); // 6000 * 0.85
    expect(effectiveHoldMs(6000, BURST_THRESHOLD + 2)).toBe(4335); // 6000 * 0.85^2
    // Strictly decreasing until the floor takes over.
    let prev = effectiveHoldMs(6000, BURST_THRESHOLD);
    for (let w = BURST_THRESHOLD + 1; effectiveHoldMs(6000, w) > BURST_FLOOR_MS; w++) {
      const cur = effectiveHoldMs(6000, w);
      expect(cur).toBeLessThan(prev);
      prev = cur;
    }
  });

  it('never dips below the 2500ms floor no matter the backlog', () => {
    expect(BURST_FLOOR_MS).toBe(2500);
    expect(effectiveHoldMs(6000, 30)).toBe(BURST_FLOOR_MS);
    expect(effectiveHoldMs(6000, 1000)).toBe(BURST_FLOOR_MS);
  });

  it('honors a custom floorMs', () => {
    expect(effectiveHoldMs(6000, 1000, 1200)).toBe(1200);
  });

  it('falls back to the default floor when floorMs is invalid', () => {
    expect(effectiveHoldMs(6000, 1000, NaN)).toBe(BURST_FLOOR_MS);
    expect(effectiveHoldMs(6000, 1000, 0)).toBe(BURST_FLOOR_MS);
    expect(effectiveHoldMs(6000, 1000, -5)).toBe(BURST_FLOOR_MS);
  });

  it('guards against NaN/zero/negative/non-finite configured holds', () => {
    for (const bad of [NaN, 0, -100, Infinity, undefined]) {
      expect(effectiveHoldMs(bad, 0), `configuredMs ${bad}`).toBe(DEFAULT_HOLD_MS);
    }
    // The burst curve still applies on top of the fallback.
    expect(effectiveHoldMs(NaN, BURST_THRESHOLD + 1)).toBe(Math.round(DEFAULT_HOLD_MS * 0.85));
  });
});
