import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CountdownView } from './CountdownView.jsx';

// The operator asked for the milestone popup ("5 MINUTES!") to be gone
// from the projector, but the optional chime is a separate opt-in
// feature that QuickNav advertises as "Chimes at 1hr/30/10/5/1min" —
// so these tests pin BOTH halves: no badge on screen, same audio.
vi.mock('../lib/stingers.js', () => ({ playStinger: vi.fn() }));
vi.mock('../hooks/useWeather.js', () => ({ useWeather: () => 'clear' }));
vi.mock('../hooks/useCalendarEvents.js', () => ({ useCalendarEvents: () => [] }));

import { playStinger } from '../lib/stingers.js';

const TARGET = new Date('2026-09-16T18:00:00');
/** `now` that leaves exactly `seconds` on the clock. */
const nowFor = (seconds) => new Date(TARGET.getTime() - seconds * 1000);

/** Render the countdown at `seconds` remaining. */
function renderAt(seconds) {
  return render(
    <CountdownView now={nowFor(seconds)} target={TARGET} theme={null} onSkip={() => {}} />,
  );
}

describe('CountdownView milestone popups', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  const MILESTONE_TEXTS = [
    /1 HOUR TO GO/i,
    /30 MINUTES/i,
    /10 MINUTES/i,
    /5 MINUTES/i,
    /ALMOST TIME/i,
  ];

  it('renders no milestone badge at any of the five milestone times', () => {
    for (const seconds of [3600, 1800, 600, 300, 60]) {
      const { container, unmount } = renderAt(seconds);
      for (const text of MILESTONE_TEXTS) {
        expect(container.textContent).not.toMatch(text);
      }
      unmount();
    }
  });

  it('still keeps the clock and the theme badge', () => {
    const { container, unmount } = render(
      <CountdownView now={nowFor(300)} target={TARGET} theme="Superhero Night" onSkip={() => {}} />,
    );
    expect(container.textContent).toMatch(/Awana begins in/i);
    expect(container.textContent).toMatch(/Superhero Night/);
    unmount();
  });

  it('still sounds the chime at each milestone time, at the same intensity', () => {
    for (const seconds of [3600, 1800, 600, 300]) {
      vi.clearAllMocks();
      const { unmount } = renderAt(seconds);
      expect(playStinger).toHaveBeenCalledWith(0.5);
      unmount();
    }

    vi.clearAllMocks();
    const { unmount } = renderAt(60);
    // The final minute keeps the big three-note version.
    expect(playStinger).toHaveBeenCalledWith(1);
    unmount();
  });

  it('does not chime on a non-milestone second', () => {
    const { unmount } = renderAt(301);
    expect(playStinger).not.toHaveBeenCalled();
    unmount();
  });

  it('chimes once per milestone even when the clock re-renders on that second', () => {
    const { rerender, unmount } = renderAt(300);
    expect(playStinger).toHaveBeenCalledTimes(1);
    rerender(
      <CountdownView now={nowFor(300)} target={TARGET} theme={null} onSkip={() => {}} />,
    );
    expect(playStinger).toHaveBeenCalledTimes(1);
    rerender(
      <CountdownView now={nowFor(299)} target={TARGET} theme={null} onSkip={() => {}} />,
    );
    expect(playStinger).toHaveBeenCalledTimes(1);
    unmount();
  });
});
