import { describe, it, expect } from 'vitest';
import { sanitizeOverrides } from './useConfig.js';

describe('sanitizeOverrides', () => {
  it('keeps valid overrides', () => {
    const overrides = {
      pusherAppKey: 'abc123',
      standardDisplayMs: 7000,
      audioMuted: false,
      useLocalSlideshow: true,
    };
    expect(sanitizeOverrides(overrides)).toEqual(overrides);
  });

  it('drops values of the wrong type so timers can never go NaN', () => {
    expect(sanitizeOverrides({
      standardDisplayMs: 'abc',
      specialDisplayMs: NaN,
      gapBetweenBannersMs: null,
      audioMuted: 'true',
      pusherAppKey: 42,
    })).toEqual({});
  });

  it('drops out-of-range numbers and unknown keys', () => {
    expect(sanitizeOverrides({
      standardDisplayMs: -5,
      specialDisplayMs: 999999,
      hackedField: 'x',
    })).toEqual({});
  });

  it('tolerates garbage roots from corrupt localStorage', () => {
    expect(sanitizeOverrides(null)).toEqual({});
    expect(sanitizeOverrides('{}')).toEqual({});
    expect(sanitizeOverrides([1, 2])).toEqual({});
  });
});
