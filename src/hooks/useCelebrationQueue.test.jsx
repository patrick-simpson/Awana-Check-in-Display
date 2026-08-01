import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCelebrationQueue } from './useCelebrationQueue.js';

const HOLD = 1000;

// `onReady` rather than mutating a ref prop: the lint rule that forbids
// writing to props is right, and a callback keeps the harness honest about
// re-render timing.
function Harness({ onReady }) {
  const queue = useCelebrationQueue(HOLD);
  onReady(queue);
  return <div data-testid="current">{queue.current ? JSON.stringify(queue.current) : 'none'}</div>;
}

function setup() {
  const api = { current: null };
  const view = render(<Harness onReady={(q) => { api.current = q; }} />);
  return { api, view };
}

describe('useCelebrationQueue', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows nothing initially', () => {
    const { api } = setup();
    expect(api.current.current).toBeNull();
  });

  it('promotes the first enqueued celebration immediately', () => {
    const { api } = setup();
    act(() => { api.current.enqueue({ kind: 'tally', count: 25 }); });
    expect(api.current.current).toMatchObject({ kind: 'tally', count: 25 });
  });

  it('holds the second one back instead of overlapping', () => {
    // The whole point: a night milestone and a club milestone firing in the
    // same instant used to render two toasts into the same corner.
    const { api } = setup();
    act(() => {
      api.current.enqueue({ kind: 'night', count: 100 });
      api.current.enqueue({ kind: 'club', club: 'Sparks', count: 10 });
    });
    expect(api.current.current).toMatchObject({ kind: 'night' });
    expect(api.current.depth()).toBe(1);
  });

  it('promotes the queued one after the hold elapses', () => {
    const { api } = setup();
    act(() => {
      api.current.enqueue({ kind: 'night', count: 100 });
      api.current.enqueue({ kind: 'club', club: 'Sparks', count: 10 });
    });
    act(() => { vi.advanceTimersByTime(HOLD + 10); });
    expect(api.current.current).toMatchObject({ kind: 'club', club: 'Sparks' });
    expect(api.current.depth()).toBe(0);
  });

  it('clears once the queue is drained', () => {
    const { api } = setup();
    act(() => { api.current.enqueue({ kind: 'tally', count: 25 }); });
    act(() => { vi.advanceTimersByTime(HOLD + 10); });
    expect(api.current.current).toBeNull();
  });

  it('preserves order across a long queue', () => {
    const { api } = setup();
    act(() => {
      for (let i = 1; i <= 4; i++) api.current.enqueue({ kind: 'tally', count: i });
    });
    const seen = [];
    for (let i = 0; i < 4; i++) {
      seen.push(api.current.current.count);
      act(() => { vi.advanceTimersByTime(HOLD + 10); });
    }
    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it('ignores null enqueues', () => {
    const { api } = setup();
    act(() => { api.current.enqueue(null); api.current.enqueue(undefined); });
    expect(api.current.current).toBeNull();
    expect(api.current.depth()).toBe(0);
  });

  it('accepts a new celebration while one is showing and after it clears', () => {
    const { api } = setup();
    act(() => { api.current.enqueue({ kind: 'tally', count: 25 }); });
    act(() => { vi.advanceTimersByTime(HOLD + 10); });
    expect(api.current.current).toBeNull();
    act(() => { api.current.enqueue({ kind: 'tally', count: 50 }); });
    expect(api.current.current).toMatchObject({ count: 50 });
  });
});
