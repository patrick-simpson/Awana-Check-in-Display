import { describe, expect, it } from 'vitest';
import { colorForGroup, isPointsFresh, POINTS_STALE_MS, rankGroups } from './points.js';

describe('colorForGroup', () => {
  it('maps obvious color words, case/whitespace insensitively', () => {
    expect(colorForGroup('Red')).toBe('#E8192C');
    expect(colorForGroup('  blue  ')).toBe('#0072CE');
    expect(colorForGroup('GOLD')).toBe('#FFC107');
  });

  it('returns null for a name that is not a color word', () => {
    expect(colorForGroup('House Warriors')).toBeNull();
    expect(colorForGroup('Team 1')).toBeNull();
  });
});

describe('rankGroups', () => {
  it('ranks highest points first', () => {
    const ranked = rankGroups({ Red: 100, Blue: 240, Green: 60 });
    expect(ranked.map((g) => g.name)).toEqual(['Blue', 'Red', 'Green']);
    expect(ranked.map((g) => g.rank)).toEqual([1, 2, 3]);
  });

  it('gives tied groups the same rank and skips the next rank (competition ranking)', () => {
    const ranked = rankGroups({ Red: 10, Blue: 10, Green: 5 });
    expect(ranked.map((g) => ({ name: g.name, rank: g.rank }))).toEqual([
      { name: 'Red', rank: 1 },
      { name: 'Blue', rank: 1 },
      { name: 'Green', rank: 3 },
    ]);
  });

  it('colors an obvious color-word team by its color', () => {
    const ranked = rankGroups({ Red: 10, Blue: 5 });
    expect(ranked.find((g) => g.name === 'Red').color).toBe('#E8192C');
    expect(ranked.find((g) => g.name === 'Blue').color).toBe('#0072CE');
  });

  it('falls back to a stable neutral color for a non-color team name', () => {
    const ranked = rankGroups({ 'House Warriors': 10, 'Team Awesome': 5 });
    for (const g of ranked) {
      expect(g.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
    // Deterministic across calls with the same input.
    const again = rankGroups({ 'House Warriors': 10, 'Team Awesome': 5 });
    expect(again).toEqual(ranked);
  });

  it('handles a single group and an empty groups object', () => {
    expect(rankGroups({ Red: 10 })).toEqual([{ name: 'Red', points: 10, rank: 1, color: '#E8192C' }]);
    expect(rankGroups({})).toEqual([]);
  });
});

describe('isPointsFresh', () => {
  const now = new Date('2026-09-16T18:20:00');

  it('is false when points is null', () => {
    expect(isPointsFresh(null, now)).toBe(false);
  });

  it('is true just under the staleness window and false at/after it', () => {
    const justUnder = { groups: {}, at: new Date(now.getTime() - (POINTS_STALE_MS - 1)) };
    const atLimit = { groups: {}, at: new Date(now.getTime() - POINTS_STALE_MS) };
    expect(isPointsFresh(justUnder, now)).toBe(true);
    expect(isPointsFresh(atLimit, now)).toBe(false);
  });
});
