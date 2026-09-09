import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { GameTimeView } from './GameTimeView.jsx';

// The wrap-up warning is the point of this suite: the badge appears at
// the right two moments, the chime fires ONCE per flip (never again on
// a re-render — the clock re-renders every second), and both go quiet
// once the window is actually over.
vi.mock('../lib/stingers.js', () => ({ playStinger: vi.fn() }));
vi.mock('../hooks/useBirthdays.js', () => ({ useBirthdays: () => [] }));

import { playStinger } from '../lib/stingers.js';

const GAME_WINDOW = { kind: 'game', clubs: ['tnt'], title: 'T&T Game Time', startMin: 18 * 60 + 5 };
const ENDS_AT = new Date('2026-09-16T18:30:00');
/** `now` that leaves exactly `seconds` on the game clock. */
const nowFor = (seconds) => new Date(ENDS_AT.getTime() - seconds * 1000);

const view = (seconds) => (
  <GameTimeView now={nowFor(seconds)} window={GAME_WINDOW} endsAt={ENDS_AT} tally={null} />
);

describe('GameTimeView wrap-up warning', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows no warning badge with more than two minutes left', () => {
    const { container } = render(view(121));
    expect(container.textContent).not.toMatch(/two minutes/i);
    expect(container.textContent).not.toMatch(/30 seconds/i);
    expect(container.querySelector('[data-warning]')).toBeNull();
  });

  it('shows TWO MINUTES at the two-minute mark', () => {
    const { container } = render(view(120));
    expect(container.textContent).toMatch(/TWO MINUTES/);
    expect(container.querySelector('[data-warning="two-minute"]')).not.toBeNull();
  });

  it('shows LAST 30 SECONDS for the final call', () => {
    const { container } = render(view(30));
    expect(container.textContent).toMatch(/LAST 30 SECONDS/);
    expect(container.querySelector('[data-warning="final-thirty"]')).not.toBeNull();
  });

  it('drops the badge once the clock reaches zero — the window is over', () => {
    const { container } = render(view(0));
    expect(container.querySelector('[data-warning]')).toBeNull();
  });

  it('keeps the rest of the screen intact while warning', () => {
    const { container } = render(view(60));
    expect(container.textContent).toMatch(/GAME TIME!/);
    expect(container.textContent).toMatch(/Game ends at/);
  });
});

describe('GameTimeView warning chime', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('fires once per flip and never again on a re-render', () => {
    const { rerender } = render(view(130));
    expect(playStinger).not.toHaveBeenCalled();

    rerender(view(120));
    expect(playStinger).toHaveBeenCalledTimes(1);
    expect(playStinger).toHaveBeenLastCalledWith(0.5);

    // Every second of the next minute and a half re-renders this view;
    // none of those ticks may re-announce.
    for (const seconds of [119, 90, 61, 45, 31]) rerender(view(seconds));
    expect(playStinger).toHaveBeenCalledTimes(1);

    rerender(view(30));
    expect(playStinger).toHaveBeenCalledTimes(2);
    expect(playStinger).toHaveBeenLastCalledWith(1);

    for (const seconds of [29, 10, 1]) rerender(view(seconds));
    expect(playStinger).toHaveBeenCalledTimes(2);
  });

  it('does not announce a state the screen opened in the middle of twice', () => {
    const { rerender } = render(view(45));
    expect(playStinger).toHaveBeenCalledTimes(1);
    rerender(view(44));
    rerender(view(40));
    expect(playStinger).toHaveBeenCalledTimes(1);
  });

  it('stays silent through a window with no warning left to give', () => {
    const { rerender } = render(view(600));
    rerender(view(500));
    rerender(view(300));
    expect(playStinger).not.toHaveBeenCalled();
  });
});
