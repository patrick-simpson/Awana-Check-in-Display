import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildForecastUrl,
  fetchCurrentWeather,
  geocodeLocation,
  weatherPresentation,
} from './weather.js';

afterEach(() => vi.unstubAllGlobals());

describe('weatherPresentation', () => {
  it('maps every documented WMO code group', () => {
    const cases = [
      [0, 'sun'], [1, 'sun'], [2, 'partly'], [3, 'cloud'],
      [45, 'fog'], [48, 'fog'],
      [51, 'rain'], [55, 'rain'], [56, 'rain'], [61, 'rain'], [65, 'rain'], [67, 'rain'],
      [71, 'snow'], [75, 'snow'], [77, 'snow'],
      [80, 'rain'], [82, 'rain'], [85, 'snow'], [86, 'snow'],
      [95, 'storm'], [96, 'storm'], [99, 'storm'],
    ];
    for (const [code, icon] of cases) {
      expect(weatherPresentation(code, true).icon, `code ${code}`).toBe(icon);
    }
  });

  it('falls back to partly cloudy on unknown codes', () => {
    expect(weatherPresentation(42, true)).toEqual({ label: 'Partly cloudy', icon: 'partly', theme: 'sky' });
    expect(weatherPresentation(undefined, true).icon).toBe('partly');
  });

  it('clear night becomes a moon on the night theme', () => {
    expect(weatherPresentation(0, false)).toEqual({ label: 'Clear skies', icon: 'moon', theme: 'night' });
    expect(weatherPresentation(0, true)).toEqual({ label: 'Clear skies', icon: 'sun', theme: 'sky' });
  });

  it('themes match the vibe: snow → lavender, rain → meadow, storm → night', () => {
    expect(weatherPresentation(73, true).theme).toBe('lavender');
    expect(weatherPresentation(63, true).theme).toBe('meadow');
    expect(weatherPresentation(95, true).theme).toBe('night');
  });

  it('every result uses a real CatalogScene theme', () => {
    const themes = ['sky', 'sunset', 'night', 'meadow', 'lavender'];
    for (let code = 0; code <= 99; code++) {
      for (const isDay of [true, false]) {
        expect(themes).toContain(weatherPresentation(code, isDay).theme);
      }
    }
  });
});

describe('buildForecastUrl', () => {
  it('includes coordinates, current fields, and units', () => {
    const url = buildForecastUrl({ lat: 44.552, lon: -69.6317, units: 'fahrenheit' });
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('latitude=44.552');
    expect(url).toContain('longitude=-69.6317');
    expect(url).toContain('temperature_unit=fahrenheit');
    expect(url).toContain('weather_code');
  });

  it('supports celsius and defaults anything else to fahrenheit', () => {
    expect(buildForecastUrl({ lat: 1, lon: 2, units: 'celsius' })).toContain('temperature_unit=celsius');
    expect(buildForecastUrl({ lat: 1, lon: 2, units: 'kelvin' })).toContain('temperature_unit=fahrenheit');
  });
});

describe('fetchCurrentWeather', () => {
  const okPayload = {
    current: { temperature_2m: 41.6, apparent_temperature: 35.9, weather_code: 85, is_day: 0 },
  };

  it('rounds temps and normalizes the shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => okPayload }));
    expect(await fetchCurrentWeather({ lat: 44.5, lon: -69.6 })).toEqual({
      temp: 42, apparent: 36, code: 85, isDay: false, units: 'fahrenheit',
    });
  });

  it('returns null on HTTP errors, bad payloads, network failures, and bad coords', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchCurrentWeather({ lat: 1, lon: 2 })).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ current: {} }) }));
    expect(await fetchCurrentWeather({ lat: 1, lon: 2 })).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchCurrentWeather({ lat: 1, lon: 2 })).toBeNull();

    expect(await fetchCurrentWeather({ lat: NaN, lon: 2 })).toBeNull();
  });
});

describe('geocodeLocation', () => {
  it('returns the top hit with a friendly name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ name: 'Waterville', admin1: 'Maine', latitude: 44.552, longitude: -69.6317 }] }),
    }));
    expect(await geocodeLocation('waterville maine')).toEqual({
      name: 'Waterville, Maine', lat: 44.552, lon: -69.6317,
    });
  });

  it('returns null for empty input, no matches, or failures', async () => {
    expect(await geocodeLocation('')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await geocodeLocation('nowheresville')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await geocodeLocation('waterville')).toBeNull();
  });
});
