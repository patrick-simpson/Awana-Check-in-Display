import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckInQueue, effectiveHoldMs } from './useCheckInQueue.js';

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
});
