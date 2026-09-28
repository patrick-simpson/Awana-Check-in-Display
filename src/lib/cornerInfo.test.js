import { describe, it, expect } from 'vitest';
import { cornerIds, nextCornerId, snapshotCorner } from './cornerInfo.js';

const src = (extra = {}) => ({ clock: true, tally: 23, weather: { temp: 58.4, code: 3, isDay: true }, ...extra });

describe('cornerIds', () => {
  it('lists what has something to say, in rotation order', () => {
    expect(cornerIds(src())).toEqual(['clock', 'tally', 'weather']);
  });

  it('the tally waits for the first check-in, the weather for a reading', () => {
    expect(cornerIds(src({ tally: 0 }))).toEqual(['clock', 'weather']);
    expect(cornerIds(src({ weather: null }))).toEqual(['clock', 'tally']);
    expect(cornerIds(src({ weather: { temp: NaN, code: 1 } }))).toEqual(['clock', 'tally']);
    expect(cornerIds({ clock: false, tally: 0, weather: null })).toEqual([]);
  });
});

describe('nextCornerId', () => {
  it('moves on one item per slide load and wraps', () => {
    const ids = ['clock', 'tally', 'weather'];
    expect(nextCornerId(ids, null)).toBe('clock');
    expect(nextCornerId(ids, 'clock')).toBe('tally');
    expect(nextCornerId(ids, 'weather')).toBe('clock');
  });

  it('starts over when the item on show has gone, and says nothing when nothing exists', () => {
    expect(nextCornerId(['clock', 'weather'], 'tally')).toBe('clock');
    expect(nextCornerId([], 'clock')).toBeNull();
  });
});

describe('snapshotCorner', () => {
  const at = new Date(2026, 8, 30, 19, 56, 12).getTime();

  it('freezes the time at the slide load, bottom corner', () => {
    expect(snapshotCorner('clock', src(), at)).toEqual({
      id: 'clock', label: 'Right now', value: '7:56', spoken: 'The time is 7:56 PM', corner: 'bottom',
    });
  });

  it('freezes the tally, bottom corner', () => {
    expect(snapshotCorner('tally', src(), at)).toMatchObject({ label: 'Tonight', value: '23', corner: 'bottom' });
  });

  it('names the weather and rounds the temperature, top corner', () => {
    const w = snapshotCorner('weather', src(), at);
    expect(w.value).toBe('58°');
    expect(w.corner).toBe('top');
    expect(typeof w.label).toBe('string');
    expect(w.label.length).toBeGreaterThan(0);
  });

  it('has nothing to show for weather with no reading', () => {
    expect(snapshotCorner('weather', src({ weather: null }), at)).toBeNull();
  });
});
