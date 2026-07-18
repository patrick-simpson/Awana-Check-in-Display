import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import DataCycle, { nextActiveId } from './DataCycle.jsx';

// AnimatePresence's mode="wait" only mounts the next item after the
// previous one's exit tween finishes — and framer-motion drives tweens
// off the real requestAnimationFrame, which fake timers can't advance.
// These tests cover the cycling state machine, not the tweening, so the
// presence wrapper becomes a passthrough.
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, AnimatePresence: ({ children }) => children };
});

describe('nextActiveId', () => {
  it('advances in order and wraps', () => {
    expect(nextActiveId(['a', 'b', 'c'], 'a')).toBe('b');
    expect(nextActiveId(['a', 'b', 'c'], 'c')).toBe('a');
  });

  it('falls back to the first id when the active one vanished', () => {
    expect(nextActiveId(['a', 'b'], 'gone')).toBe('a');
    expect(nextActiveId(['a', 'b'], null)).toBe('a');
  });

  it('returns null for an empty list', () => {
    expect(nextActiveId([], 'a')).toBeNull();
  });
});

describe('DataCycle', () => {
  const reading = { temp: 72, apparent: 74, code: 2, isDay: true, units: 'fahrenheit' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 14, 18, 0, 0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function renderCycle(props = {}) {
    return render(
      <DataCycle
        count={0}
        weather={null}
        showClock={false}
        showTally={false}
        showWeather={false}
        intervalSec={10}
        {...props}
      />
    );
  }

  const advance = (ms) => act(() => vi.advanceTimersByTime(ms));

  it('renders nothing with every item disabled', () => {
    const { container } = renderCycle();
    expect(container.firstChild).toBeNull();
  });

  it('shows the current time as the clock item', () => {
    renderCycle({ showClock: true });
    expect(screen.getByText(/right now/i)).toBeTruthy();
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('Current time 6:00 PM');
  });

  it('holds a lone item forever without churning', () => {
    renderCycle({ showClock: true });
    advance(60000);
    expect(screen.getByText(/right now/i)).toBeTruthy();
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('Current time 6:01 PM');
  });

  it('cycles through the enabled items in order and wraps', () => {
    renderCycle({ showClock: true, showTally: true, count: 5, showWeather: true, weather: reading });
    expect(screen.getByText(/right now/i)).toBeTruthy();

    advance(10000);
    expect(screen.getByText(/tonight/i)).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText(/checked in/i)).toBeTruthy();

    advance(10000);
    expect(screen.getByText(/outside/i)).toBeTruthy();
    expect(screen.getByText(/72°/)).toBeTruthy();

    advance(10000);
    expect(screen.getByText(/right now/i)).toBeTruthy();
  });

  it('leaves out disabled or empty items', () => {
    renderCycle({ showClock: true, showTally: true, count: 0, showWeather: true, weather: null });
    advance(10000);
    // Tally is at zero and weather has no reading — the clock just holds.
    expect(screen.getByText(/right now/i)).toBeTruthy();
    expect(screen.queryByText(/tonight/i)).toBeNull();
  });

  it('has no countdown card (retired in favor of the presentation tool)', () => {
    // Legacy countdown props are simply ignored — old saved settings
    // must not resurrect the card.
    renderCycle({ showClock: true, countdownTargetTime: '18:30', clubDates: ['2026-07-14'] });
    advance(10000);
    expect(screen.getByText(/right now/i)).toBeTruthy();
    expect(screen.queryByText(/club starts in/i)).toBeNull();
  });
});
