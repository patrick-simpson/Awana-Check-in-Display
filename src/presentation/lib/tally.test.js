import { describe, it, expect } from 'vitest';
import { countForClub } from './tally.js';

describe('countForClub', () => {
  const t = {
    counts: { 'Truth & Training': 12, 'T&T': 3, Sparks: 9, Mystery: 4 },
    total: 28,
    at: new Date('2026-09-02T18:20:00'),
  };

  it('normalizes club-name spellings and sums duplicates', () => {
    expect(countForClub(t, 'tnt')).toBe(15);
    expect(countForClub(t, 'sparks')).toBe(9);
  });

  it('returns null (not 0) for clubs the tally does not cover', () => {
    expect(countForClub(t, 'puggles')).toBeNull();
  });
});
