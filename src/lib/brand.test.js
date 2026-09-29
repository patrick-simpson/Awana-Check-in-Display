import { describe, it, expect } from 'vitest';
import tokens from '../../shared/brand/tokens.json';
import { BEAT, beats, EASE, DUR, parseShape, SHAPES, DOODLES, chipGeometry, measureEm, BRAND_CLUBS, HOUSE } from './brand.js';

describe('motion table', () => {
  it('reads one beat, the four curves and the durations straight from tokens.json', () => {
    expect(BEAT).toBe(tokens.motion.beatMs / 1000);
    expect(beats(3)).toBe(0.3);
    expect(beats(0)).toBe(0);
    expect(Object.keys(EASE).sort()).toEqual(['exit', 'pop', 'settle', 'wipe']);
    for (const curve of Object.values(EASE)) expect(curve).toHaveLength(4);
    for (const [k, ms] of Object.entries(tokens.motion.durationsMs)) expect(DUR[k]).toBe(ms / 1000);
  });

  it('beats() never accumulates float error', () => {
    // 7 * 0.1 is 0.7000000000000001 in floating point.
    expect(beats(7)).toBe(0.7);
    expect(beats(1.5)).toBe(0.15);
  });

  it('exits run faster than entrances', () => {
    expect(DUR.exit).toBeLessThan(DUR.settle);
  });
});

describe('parseShape', () => {
  it('pulls viewBox and path data out of a single-path SVG', () => {
    const s = parseShape('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><path d="M0 0L10 20Z"/></svg>', 't');
    expect(s).toEqual({ viewBox: '0 0 10 20', d: 'M0 0L10 20Z', stroked: false });
  });

  it('flags a stroked shape', () => {
    expect(parseShape('<svg viewBox="0 0 1 1"><path fill="none" d="M0 0"/></svg>', 't').stroked).toBe(true);
  });

  it('throws on anything else, so a bad kit file fails the build and not a screen', () => {
    expect(() => parseShape('<svg><circle r="1"/></svg>', 'bad')).toThrow(/bad/);
  });

  it('every kit shape and doodle parsed', () => {
    for (const s of [...Object.values(SHAPES), ...Object.values(DOODLES)]) {
      expect(s.viewBox.split(/\s+/)).toHaveLength(4);
      expect(s.d.length).toBeGreaterThan(4);
    }
    expect(DOODLES.squiggle.stroked).toBe(true);
    expect(DOODLES.sparkle.stroked).toBe(false);
  });
});

describe('chipGeometry', () => {
  it('keeps both texts inside their tiers', () => {
    for (const [l, v] of [[0.4, 0.5], [3, 2], [5.5, 1.2], [1, 7]]) {
      const g = chipGeometry(l, v);
      // Label pill: centred, and its text narrower than the pill.
      const pillW = g.label.x * 2;
      expect(g.label.width).toBeLessThanOrEqual(pillW - 0.8);
      // Value block: its text narrower than the block.
      const blockW = (g.value.x - 0.84) * 2;
      expect(g.value.width).toBeLessThanOrEqual(blockW - 0.99);
      expect(g.d).not.toMatch(/NaN|Infinity/);
    }
  });

  it('always steps the value block out past the label pill', () => {
    // A long label and a short value: the step still shows.
    const g = chipGeometry(6, 0.5);
    const pillRight = g.label.x * 2;
    const blockRight = g.value.x * 2 - 0.84;
    expect(blockRight).toBeGreaterThanOrEqual(pillRight + 0.5 - 1e-9);
  });

  it('grows with its value instead of spilling', () => {
    expect(chipGeometry(1, 4).width).toBeGreaterThan(chipGeometry(1, 2).width);
    expect(chipGeometry(1, 4).height).toBe(chipGeometry(1, 2).height);
  });

  it('draws the label at a fixed ratio of the value, both a step larger than the plate\'s em for Paytone One\'s shorter caps', () => {
    const g = chipGeometry(2, 2);
    expect(g.label.size).toBeCloseTo(0.59);
    expect(g.value.size).toBeCloseTo(1.06);
    expect(g.label.size / g.value.size).toBeCloseTo(0.56, 2);
    expect(g.label.width).toBeCloseTo(2 * 0.59);
    expect(g.value.width).toBeCloseTo(2 * 1.06);
    // The plate is the one the catalog chip was measured for: its tiers do
    // not grow with the text's size.
    expect(chipGeometry(0, 0).height).toBeCloseTo(1.05 + 1.38 + 0.14);
  });

  it('treats a negative or zero width as empty', () => {
    const g = chipGeometry(-3, 0);
    expect(g.label.width).toBe(0);
    expect(g.value.width).toBe(0);
    expect(g.width).toBeGreaterThan(2);
  });
});

describe('measureEm', () => {
  it('estimates without a canvas (jsdom has no OffscreenCanvas)', () => {
    expect(measureEm('')).toBe(0);
    expect(measureEm('7:56')).toBeGreaterThan(measureEm('7'));
    // Spaces and punctuation are narrow.
    expect(measureEm('A B')).toBeLessThan(measureEm('ABC'));
  });
});

describe('club colors', () => {
  it('re-exports the kit palette', () => {
    expect(BRAND_CLUBS.puggles.primary).toBe('#1DB6D9');
    expect(HOUSE.hot).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
