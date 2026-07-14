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
    expect(sparks.confetti.length).toBeGreaterThan(1);
    // Every club ships official wordmark art (catalog extractions plus
    // the club-supplied Trek/Journey marks via prepare-club-gfx.py).
    for (const club of getAllClubs()) {
      expect(getClubPalette(club).logo, `logo for ${club}`).toBeTruthy();
    }
    // Mascot character art exists for the four character clubs; Trek and
    // Journey have none, and the fallback palette has neither logo nor
    // mascot.
    expect(sparks.mascot).toBeTruthy();
    expect(getClubPalette('Puggles').mascot).toBeTruthy();
    expect(getClubPalette('Cubbies').mascot).toBeTruthy();
    expect(getClubPalette('T&T').mascot).toBeTruthy();
    expect(getClubPalette('Trek').mascot).toBeNull();
    expect(getClubPalette('Journey').mascot).toBeNull();
    expect(getClubPalette(undefined).logo).toBeNull();
    expect(getClubPalette(undefined).mascot).toBeNull();
  });

  it('no longer carries taglines or age ranges — banners show titles only', () => {
    for (const club of getAllClubs()) {
      expect(getClubPalette(club).tagline).toBeUndefined();
      expect(getClubPalette(club).ages).toBeUndefined();
    }
  });
});
