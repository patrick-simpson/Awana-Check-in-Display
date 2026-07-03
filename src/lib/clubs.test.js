import { describe, it, expect } from 'vitest';
import { getClubPalette, getAllClubs } from './clubs.js';

describe('getClubPalette', () => {
  it('is case-insensitive and trims whitespace', () => {
    expect(getClubPalette('SPARKS')).toBe(getClubPalette('sparks'));
    expect(getClubPalette('  Cubbies  ')).toBe(getClubPalette('cubbies'));
  });

  it('falls back to the default palette for unknown or missing clubs', () => {
    const fallback = getClubPalette(undefined);
    expect(fallback.primary).toBeTruthy();
    expect(getClubPalette('No Such Club')).toBe(fallback);
    expect(getClubPalette(42)).toBe(fallback);
  });

  it('has a dedicated palette for every club the debug panel can trigger', () => {
    const fallback = getClubPalette(undefined);
    for (const club of getAllClubs()) {
      expect(getClubPalette(club), `palette for ${club}`).not.toBe(fallback);
    }
  });

  it('resolves common alternate spellings to the same club', () => {
    expect(getClubPalette('Truth & Training')).toBe(getClubPalette('T&T'));
    expect(getClubPalette('TNT')).toBe(getClubPalette('t&t'));
    expect(getClubPalette('Cubbie')).toBe(getClubPalette('Cubbies'));
  });

  it('carries catalog identity data for on-screen display', () => {
    const sparks = getClubPalette('Sparks');
    expect(sparks.name).toBe('Sparks');
    expect(sparks.ages).toBe('Grades K–2');
    expect(sparks.tagline).toBeTruthy();
    expect(sparks.confetti.length).toBeGreaterThan(1);
  });
});
