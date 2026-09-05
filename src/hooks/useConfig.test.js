import { describe, it, expect, vi } from 'vitest';
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

  it('drops the retired calendarCorsProxy key from stored overrides', () => {
    // The allorigins proxy fallback was removed; a value persisted by an
    // older version must be silently discarded, not resurrected.
    expect(sanitizeOverrides({ calendarCorsProxy: 'https://api.allorigins.win/raw?url={url}' })).toEqual({});
  });

  it('keeps valid calendar & weather overrides', () => {
    const overrides = {
      calendarEnabled: false,
      calendarUrl: 'https://example.org/calendar',
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

// ── The store ────────────────────────────────────────────────────────────────
// Every useConfig() call shares one module-level store, so a save in Settings
// reaches the socket's copy in the same tab, and the ?config= / URL-flag
// layers reach every consumer — not just the component that parsed them.

import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import defaults from '../config.js';
import {
  _resetForTest,
  resolveStoredConfig,
  setRemoteDefaults,
  updateConfig,
  useConfig,
} from './useConfig.js';

const atUrl = (search) => window.history.replaceState({}, '', `/${search}`);

describe('useConfig store', () => {
  beforeEach(() => {
    localStorage.clear();
    atUrl('');
    _resetForTest();
  });
  afterEach(() => { cleanup(); /* no global RTL cleanup in this repo — hooks share one config store */ atUrl(''); _resetForTest(); });

  it('two hooks share one store and one snapshot', () => {
    const a = renderHook(() => useConfig());
    const b = renderHook(() => useConfig());
    expect(a.result.current.config).toBe(b.result.current.config);
    act(() => a.result.current.updateConfig({ audioMuted: false }));
    expect(b.result.current.config.audioMuted).toBe(false);
    expect(a.result.current.config).toBe(b.result.current.config);
    expect(JSON.parse(localStorage.getItem('awanaConfig.v1'))).toEqual({ audioMuted: false });
  });

  it('layers defaults < ?config= remote < device overrides < ?key=/?cluster=', () => {
    localStorage.setItem('awanaConfig.v1', JSON.stringify({ pusherAppKey: 'device', pusherCluster: 'us2' }));
    atUrl('?key=url&cluster=eu');
    _resetForTest();
    const { result } = renderHook(() => useConfig());
    act(() => setRemoteDefaults({ pusherAppKey: 'remote', nightTheme: 'christmas', bogus: 1 }));
    const { config, storedConfig } = result.current;
    expect(config.pusherAppKey).toBe('url');
    expect(config.pusherCluster).toBe('eu');
    expect(config.nightTheme).toBe('christmas');      // remote reached the effective config
    expect(storedConfig.pusherAppKey).toBe('device'); // device wins over remote…
    expect(storedConfig.pusherCluster).toBe('us2');   // …and flags never appear in the stored layer
    expect(storedConfig.nightTheme).toBe('christmas');
    expect('bogus' in config).toBe(false);
  });

  it('?cluster= is ignored without ?key=, and ?key= alone keeps the saved cluster', () => {
    localStorage.setItem('awanaConfig.v1', JSON.stringify({ pusherAppKey: 'device', pusherCluster: 'ap1' }));
    atUrl('?cluster=eu');
    _resetForTest();
    expect(renderHook(() => useConfig()).result.current.config.pusherCluster).toBe('ap1');
    atUrl('?key=abc');
    _resetForTest();
    const { config } = renderHook(() => useConfig()).result.current;
    expect(config.pusherAppKey).toBe('abc');
    expect(config.pusherCluster).toBe('ap1');
  });

  it('?lowPower=1 forces the two motion keys down in config only — the defaults stay full', () => {
    localStorage.setItem('awanaConfig.v1', JSON.stringify({ confettiLevel: 'full', reduceMotion: false }));
    atUrl('?lowPower=1');
    _resetForTest();
    const { config, storedConfig } = renderHook(() => useConfig()).result.current;
    expect(config.confettiLevel).toBe('off');
    expect(config.reduceMotion).toBe(true);
    expect(storedConfig.confettiLevel).toBe('full');
    expect(storedConfig.reduceMotion).toBe(false);
    // CLAUDE.md: the flag exists so these defaults never have to move for one weak embed.
    expect(defaults.confettiLevel).toBe('full');
    expect(defaults.reduceMotion).toBe(false);
  });

  it('resolveStoredConfig: a saved PowerPoint URL with no explicit source still means PowerPoint', () => {
    expect(resolveStoredConfig({}, {}).backgroundSource).toBe('manual');
    expect(resolveStoredConfig({}, { powerpointEmbedUrl: 'https://x' }).backgroundSource).toBe('powerpoint');
    expect(resolveStoredConfig({ powerpointEmbedUrl: 'https://x' }, {}).backgroundSource).toBe('powerpoint');
    expect(resolveStoredConfig({}, { powerpointEmbedUrl: 'https://x', backgroundSource: 'manual' }).backgroundSource).toBe('manual');
    expect(resolveStoredConfig({ backgroundSource: 'video' }, { powerpointEmbedUrl: 'https://x' }).backgroundSource).toBe('video');
    expect(resolveStoredConfig({}, { powerpointEmbedUrl: '' }).backgroundSource).toBe('manual');
  });

  it('still updates every hook in memory when localStorage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const a = renderHook(() => useConfig());
    const b = renderHook(() => useConfig());
    act(() => a.result.current.updateConfig({ showClock: true }));
    expect(b.result.current.config.showClock).toBe(true);
    spy.mockRestore();
  });

  it('reloads overrides on a cross-tab storage event', () => {
    const { result } = renderHook(() => useConfig());
    expect(result.current.config.showClock).toBe(defaults.showClock);
    localStorage.setItem('awanaConfig.v1', JSON.stringify({ showClock: true }));
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'awanaConfig.v1' })); });
    expect(result.current.config.showClock).toBe(true);
  });

  it('resetConfig clears storage and the overrides layer, keeping the remote layer', () => {
    const { result } = renderHook(() => useConfig());
    act(() => { setRemoteDefaults({ nightTheme: 'christmas' }); updateConfig({ showClock: true }); });
    act(() => result.current.resetConfig());
    expect(localStorage.getItem('awanaConfig.v1')).toBeNull();
    expect(result.current.overrides).toEqual({});
    expect(result.current.config.showClock).toBe(defaults.showClock);
    expect(result.current.config.nightTheme).toBe('christmas');
  });

  it('updateConfig and resetConfig are stable across renders', () => {
    const { result, rerender } = renderHook(() => useConfig());
    const { updateConfig: u1, resetConfig: r1 } = result.current;
    rerender();
    expect(result.current.updateConfig).toBe(u1);
    expect(result.current.resetConfig).toBe(r1);
  });
});
