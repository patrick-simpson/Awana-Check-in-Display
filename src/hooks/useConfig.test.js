import { describe, it, expect } from 'vitest';
import { sanitizeOverrides } from './useConfig.js';

describe('sanitizeOverrides', () => {
  it('keeps valid overrides', () => {
    const overrides = {
      pusherAppKey: 'abc123',
      standardDisplayMs: 7000,
      audioMuted: false,
      useLocalSlideshow: true,
      milestoneEvery: 50,
      showClock: true,
    };
    expect(sanitizeOverrides(overrides)).toEqual(overrides);
    // 0 disables milestones and must survive validation
    expect(sanitizeOverrides({ milestoneEvery: 0 })).toEqual({ milestoneEvery: 0 });
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
      milestoneEvery: -1,
      showClock: 'yes',
      hackedField: 'x',
    })).toEqual({});
  });

  it('keeps valid calendar & weather overrides', () => {
    const overrides = {
      calendarEnabled: false,
      calendarUrl: 'https://example.org/calendar',
      calendarCorsProxy: '',
      calendarWelcomeText: 'Welcome to KVB Awana!',
      showWeatherChip: true,
      weatherLocationName: 'Waterville, Maine',
      weatherLat: 44.552,
      weatherLon: -69.6317,
      weatherUnits: 'celsius',
    };
    expect(sanitizeOverrides(overrides)).toEqual(overrides);
  });

  it('drops impossible coordinates and made-up units', () => {
    expect(sanitizeOverrides({
      weatherLat: 200,
      weatherLon: -500,
      weatherUnits: 'kelvin',
      calendarEnabled: 'yes',
      calendarUrl: 42,
    })).toEqual({});
  });

  it('tolerates garbage roots from corrupt localStorage', () => {
    expect(sanitizeOverrides(null)).toEqual({});
    expect(sanitizeOverrides('{}')).toEqual({});
    expect(sanitizeOverrides([1, 2])).toEqual({});
  });

  it('keeps a valid widget display mode and cycle interval', () => {
    const overrides = { widgetDisplayMode: 'stickers', cycleIntervalSec: 12 };
    expect(sanitizeOverrides(overrides)).toEqual(overrides);
    expect(sanitizeOverrides({ widgetDisplayMode: 'cycle' })).toEqual({ widgetDisplayMode: 'cycle' });
    expect(sanitizeOverrides({ widgetDisplayMode: 'both' })).toEqual({});
    expect(sanitizeOverrides({ cycleIntervalSec: 3 })).toEqual({ cycleIntervalSec: 3 });
    expect(sanitizeOverrides({ cycleIntervalSec: 1 })).toEqual({});
    expect(sanitizeOverrides({ cycleIntervalSec: '12' })).toEqual({});
  });

  it('keeps a valid backgroundSource and drops anything else', () => {
    expect(sanitizeOverrides({ backgroundSource: 'manual' })).toEqual({ backgroundSource: 'manual' });
    expect(sanitizeOverrides({ backgroundSource: 'powerpoint' })).toEqual({ backgroundSource: 'powerpoint' });
    expect(sanitizeOverrides({ backgroundSource: 'weird' })).toEqual({});
    expect(sanitizeOverrides({ backgroundSource: 1 })).toEqual({});
  });

  it('salvages typed slides slide-by-slide instead of nuking the deck', () => {
    const good = { id: 's_1', eyebrow: '', text: 'Welcome!', theme: 'sky', durationSec: 0, textSize: 'auto' };
    const out = sanitizeOverrides({ manualSlides: [good, { text: 42 }, 'junk'] });
    expect(out.manualSlides).toEqual([good]);
    // A non-array is dropped entirely.
    expect(sanitizeOverrides({ manualSlides: 'not slides' })).toEqual({});
  });

  it('passes video slides through the salvage and drops broken ones', () => {
    const video = { id: 's_v', type: 'video', videoId: 'v_1', videoName: 'promo.mp4', videoSize: 100, durationSec: 0 };
    const out = sanitizeOverrides({ manualSlides: [video, { type: 'video' }, { type: 'video', videoId: '' }] });
    expect(out.manualSlides).toEqual([video]);
  });
});
