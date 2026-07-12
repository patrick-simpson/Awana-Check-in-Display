import { describe, it, expect } from 'vitest';
import {
  MAX_EYEBROW,
  MAX_SLIDES,
  MAX_TEXT,
  makeSlide,
  makeSlideId,
  resolveTheme,
  sanitizeSlides,
  slideDurationMs,
  slideSizeClass,
} from './slides.js';

describe('sanitizeSlides', () => {
  it('tolerates garbage roots from corrupt localStorage or bad imports', () => {
    expect(sanitizeSlides(null)).toEqual([]);
    expect(sanitizeSlides(undefined)).toEqual([]);
    expect(sanitizeSlides('[]')).toEqual([]);
    expect(sanitizeSlides({ text: 'not an array' })).toEqual([]);
    expect(sanitizeSlides(42)).toEqual([]);
  });

  it('keeps valid slides unchanged', () => {
    const slide = { id: 's_1', eyebrow: 'Awana', text: 'Welcome!', theme: 'night', durationSec: 10 };
    expect(sanitizeSlides([slide])).toEqual([slide]);
  });

  it('drops entries that are not slides or have no usable text', () => {
    const good = makeSlide({ text: 'keep me' });
    expect(sanitizeSlides([
      null,
      'a string',
      ['nested'],
      { eyebrow: 'no text at all' },
      { text: 42 },
      { text: '   ' },
      good,
    ])).toEqual([good]);
  });

  it('truncates over-long text and eyebrow', () => {
    const [slide] = sanitizeSlides([{ text: 'x'.repeat(MAX_TEXT + 100), eyebrow: 'y'.repeat(MAX_EYEBROW + 5) }]);
    expect(slide.text).toHaveLength(MAX_TEXT);
    expect(slide.eyebrow).toHaveLength(MAX_EYEBROW);
  });

  it('caps the deck at the max slide count', () => {
    const many = Array.from({ length: MAX_SLIDES + 10 }, (_, i) => ({ text: `slide ${i}` }));
    expect(sanitizeSlides(many)).toHaveLength(MAX_SLIDES);
  });

  it('fills missing ids and de-duplicates repeated ones', () => {
    const out = sanitizeSlides([
      { text: 'a' },
      { id: 'dup', text: 'b' },
      { id: 'dup', text: 'c' },
    ]);
    const ids = out.map((s) => s.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it('falls back to the auto theme for unknown themes', () => {
    expect(sanitizeSlides([{ text: 'a', theme: 'disco' }])[0].theme).toBe('auto');
    expect(sanitizeSlides([{ text: 'a' }])[0].theme).toBe('auto');
  });

  it('coerces and clamps durations so timers can never go NaN', () => {
    const durations = sanitizeSlides([
      { text: 'a', durationSec: NaN },
      { text: 'b', durationSec: -5 },
      { text: 'c', durationSec: '7' },
      { text: 'd', durationSec: 1 },
      { text: 'e', durationSec: 9999 },
      { text: 'f', durationSec: 0 },
    ]).map((s) => s.durationSec);
    expect(durations).toEqual([0, 0, 0, 3, 600, 0]);
  });
});

describe('makeSlide / makeSlideId', () => {
  it('makes a valid slide that survives sanitizing once it has text', () => {
    const slide = makeSlide({ text: 'hello' });
    expect(sanitizeSlides([slide])).toEqual([slide]);
  });

  it('makes unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, makeSlideId));
    expect(ids.size).toBe(100);
  });
});

describe('resolveTheme', () => {
  it('rotates auto slides through the themes by position', () => {
    const auto = { theme: 'auto' };
    const first = resolveTheme(auto, 0);
    expect(resolveTheme(auto, 4)).toBe(first); // 4 themes → wraps
    expect(resolveTheme(auto, 1)).not.toBe(first);
  });

  it('honors an explicit theme', () => {
    expect(resolveTheme({ theme: 'night' }, 2)).toBe('night');
  });
});

describe('slideSizeClass', () => {
  it('gives short punchy text the giant headline size', () => {
    expect(slideSizeClass('Welcome!')).toBe('slide-size-xl');
  });

  it('steps down as text grows', () => {
    expect(slideSizeClass('x'.repeat(100))).toBe('slide-size-lg');
    expect(slideSizeClass('x'.repeat(200))).toBe('slide-size-md');
    expect(slideSizeClass('x'.repeat(400))).toBe('slide-size-sm');
  });
});

describe('slideDurationMs', () => {
  it('prefers the per-slide duration', () => {
    expect(slideDurationMs({ durationSec: 12 }, 5)).toBe(12000);
  });

  it('falls back to the global delay, then the default', () => {
    expect(slideDurationMs({ durationSec: 0 }, 5)).toBe(5000);
    expect(slideDurationMs({ durationSec: 0 }, 0)).toBe(8000);
    expect(slideDurationMs(undefined, undefined)).toBe(8000);
  });

  it('clamps so a slide can never flash by or stick forever', () => {
    expect(slideDurationMs({ durationSec: 0 }, 1)).toBe(3000);
    expect(slideDurationMs({ durationSec: 0 }, 99999)).toBe(600000);
  });
});
