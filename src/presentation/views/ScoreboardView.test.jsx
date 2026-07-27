import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScoreboardView } from './ScoreboardView.jsx';

afterEach(cleanup);

const NOW = new Date('2026-09-16T18:10:00');

describe('ScoreboardView', () => {
  it('shows a waiting placeholder instead of an empty board when there is no data yet', () => {
    render(<ScoreboardView now={NOW} points={null} />);
    expect(screen.getByText(/waiting for scores/i)).toBeTruthy();
    // No bars rendered.
    expect(screen.queryByText('240')).toBeNull();
  });

  it('renders ranked bars for fresh points, highest first', () => {
    const points = { groups: { Red: 100, Blue: 240, Green: 60 }, at: NOW };
    const { container } = render(<ScoreboardView now={NOW} points={points} />);
    const names = [...container.querySelectorAll('.uppercase.truncate')].map((el) => el.textContent);
    expect(names).toEqual(['Blue', 'Red', 'Green']);
    expect(screen.getByText('240')).toBeTruthy();
  });

  it('gives tied groups the same rank badge', () => {
    const points = { groups: { Red: 50, Blue: 50 }, at: NOW };
    const { container } = render(<ScoreboardView now={NOW} points={points} />);
    const ranks = [...container.querySelectorAll('div')]
      .map((el) => el.textContent)
      .filter((t) => /^#\d+$/.test(t));
    expect(ranks).toEqual(['#1', '#1']);
  });

  it('ages stale points out to the waiting placeholder, exactly like the game-time tally', () => {
    const staleAt = new Date(NOW.getTime() - 11 * 60 * 1000); // 11 min old > 10 min staleness
    const points = { groups: { Red: 100, Blue: 50 }, at: staleAt };
    render(<ScoreboardView now={NOW} points={points} />);
    expect(screen.getByText(/waiting for scores/i)).toBeTruthy();
    expect(screen.queryByText('100')).toBeNull();
  });
});
