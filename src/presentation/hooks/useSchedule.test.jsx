import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSchedule } from './useSchedule.js';
import { AppMode } from '../types.js';
import { CHURCH } from '../church.config.js';
import { SCHEDULE_CONFIG } from '../lib/shared-config.js';

// 2026-09-02 is a Wednesday (same anchor the schedule/watchdog tests use).
// Shipped windows: opening 18:00–18:05, T&T 18:05–18:30, Sparks 18:30–19:00,
// Puggles & Cubbies 19:00–19:30, closing 19:30–19:35, shutdown 19:35–24:00.
const at = (h, m, s = 0) => new Date(2026, 8, 2, h, m, s);
const TIMEOUT_MS = CHURCH.watchdog.overrideTimeoutMin * 60_000;

function renderSchedule(initialNow) {
  return renderHook(({ now }) => useSchedule(now), { initialProps: { now: initialNow } });
}

describe('useSchedule (no override)', () => {
  it('follows the natural schedule as the clock moves', () => {
    const { result, rerender } = renderSchedule(at(17, 0));
    expect(result.current.state.mode).toBe(AppMode.COUNTDOWN);
    expect(result.current.state.target.getTime()).toBe(at(18, 0).getTime());
    expect(result.current.isOverride).toBe(false);
    expect(result.current.resumeAt).toBeNull();

    rerender({ now: at(18, 10) });
    expect(result.current.state.mode).toBe(AppMode.GAME_TIME);
    expect(result.current.state.window.title).toBe('T&T Game Time');
    expect(result.current.isOverride).toBe(false);
  });
});

describe('useSchedule manual override', () => {
  it('select pins a window and arms the watchdog resumeAt', () => {
    const { result } = renderSchedule(at(17, 40));

    act(() => result.current.select({ type: 'window', index: 0 }));

    expect(result.current.state.mode).toBe(AppMode.SLIDESHOW);
    expect(result.current.state.deck).toBe('opening');
    expect(result.current.isOverride).toBe(true);
    expect(result.current.resumeAt.getTime()).toBe(at(17, 40).getTime() + TIMEOUT_MS);
  });

  it('clamps an out-of-range window index to the last window', () => {
    const { result } = renderSchedule(at(17, 40));
    act(() => result.current.select({ type: 'window', index: 99 }));
    expect(result.current.state.mode).toBe(AppMode.SHUTDOWN);
    expect(result.current.state.window).toBe(
      SCHEDULE_CONFIG.windows[SCHEDULE_CONFIG.windows.length - 1],
    );
  });

  it('resume() hands the screen back to the schedule immediately', () => {
    const { result } = renderSchedule(at(17, 40));
    act(() => result.current.select({ type: 'window', index: 1 }));
    expect(result.current.isOverride).toBe(true);

    act(() => result.current.resume());
    expect(result.current.isOverride).toBe(false);
    expect(result.current.state.mode).toBe(AppMode.COUNTDOWN);
    expect(result.current.resumeAt).toBeNull();
  });

  it('stay() before any override is a harmless no-op', () => {
    const { result } = renderSchedule(at(17, 40));
    act(() => result.current.stay());
    expect(result.current.isOverride).toBe(false);
  });
});

describe('useSchedule watchdog resume paths', () => {
  it('self-heals when the schedule catches up to the overridden view', () => {
    // 17:40 "skip to opening ceremony" — at 18:01 the natural state IS
    // the opening, so the override dissolves silently.
    const { result, rerender } = renderSchedule(at(17, 40));
    act(() => result.current.select({ type: 'window', index: 0 }));
    expect(result.current.isOverride).toBe(true);

    rerender({ now: at(18, 1) });
    expect(result.current.isOverride).toBe(false);
    expect(result.current.state.mode).toBe(AppMode.SLIDESHOW);
    expect(result.current.state.deck).toBe('opening');
    expect(result.current.resumeAt).toBeNull();
  });

  it('resumes when a schedule boundary crosses underneath the override', () => {
    // Pinned back to the opening during T&T; at 18:31 the natural state
    // rolled into Sparks — the override must not strand the screen.
    const { result, rerender } = renderSchedule(at(18, 10));
    act(() => result.current.select({ type: 'window', index: 0 }));
    expect(result.current.state.mode).toBe(AppMode.SLIDESHOW);

    rerender({ now: at(18, 31) });
    expect(result.current.isOverride).toBe(false);
    expect(result.current.state.mode).toBe(AppMode.GAME_TIME);
    expect(result.current.state.window.title).toBe('Sparks Game Time');
  });

  it('times out after overrideTimeoutMin within the same natural window', () => {
    // T&T runs 18:05–18:30, so a 15-minute timeout from 18:06 fires at
    // 18:21, before any boundary can mask it.
    const { result, rerender } = renderSchedule(at(18, 6));
    act(() => result.current.select({ type: 'window', index: 0 }));
    expect(result.current.resumeAt.getTime()).toBe(at(18, 21).getTime());

    rerender({ now: at(18, 20, 59) });
    expect(result.current.isOverride).toBe(true);

    rerender({ now: at(18, 21) });
    expect(result.current.isOverride).toBe(false);
    expect(result.current.state.window.title).toBe('T&T Game Time');
  });

  it('"Stay" re-arms the timeout for a full period from the stay moment', () => {
    const { result, rerender } = renderSchedule(at(18, 6));
    act(() => result.current.select({ type: 'window', index: 0 }));

    rerender({ now: at(18, 10) });
    act(() => result.current.stay());
    expect(result.current.resumeAt.getTime()).toBe(at(18, 25).getTime());

    // The original 18:21 deadline passes without resuming...
    rerender({ now: at(18, 22) });
    expect(result.current.isOverride).toBe(true);

    // ...and the re-armed one fires.
    rerender({ now: at(18, 25) });
    expect(result.current.isOverride).toBe(false);
  });
});

describe('useSchedule countdown override', () => {
  it('never times out (resumeAt stays null past the window timeout)', () => {
    const { result, rerender } = renderSchedule(at(18, 6));
    act(() => result.current.select({ type: 'countdown' }));

    expect(result.current.state.mode).toBe(AppMode.COUNTDOWN);
    expect(result.current.isOverride).toBe(true);
    expect(result.current.resumeAt).toBeNull();

    // 23 minutes later — well past the 15-minute window timeout, but
    // still inside T&T (18:05–18:30): the countdown pin must hold.
    rerender({ now: at(18, 29) });
    expect(result.current.isOverride).toBe(true);
    expect(result.current.state.mode).toBe(AppMode.COUNTDOWN);
    expect(result.current.resumeAt).toBeNull();
  });

  it('points at the NEXT meeting while pinned during a meeting', () => {
    const { result } = renderSchedule(at(18, 6));
    act(() => result.current.select({ type: 'countdown' }));
    // Next Wednesday, 2026-09-09 18:00.
    expect(result.current.state.target.getTime()).toBe(
      new Date(2026, 8, 9, 18, 0, 0).getTime(),
    );
  });

  it('resumes when a boundary crosses underneath it', () => {
    const { result, rerender } = renderSchedule(at(18, 6));
    act(() => result.current.select({ type: 'countdown' }));

    rerender({ now: at(18, 31) });
    expect(result.current.isOverride).toBe(false);
    expect(result.current.state.mode).toBe(AppMode.GAME_TIME);
    expect(result.current.state.window.title).toBe('Sparks Game Time');
  });

  it('dissolves once the natural state itself becomes countdown', () => {
    // Pinned to countdown during Wednesday shutdown; just past midnight
    // the schedule is countdown too, so the override self-heals.
    const { result, rerender } = renderSchedule(at(20, 0));
    act(() => result.current.select({ type: 'countdown' }));
    expect(result.current.isOverride).toBe(true);

    rerender({ now: new Date(2026, 8, 3, 0, 1, 0) });
    expect(result.current.isOverride).toBe(false);
    expect(result.current.state.mode).toBe(AppMode.COUNTDOWN);
  });
});
