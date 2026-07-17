import { useCallback, useEffect, useState } from 'react';
import defaults from '../config.js';
import { sanitizeSlides } from '../lib/slides.js';

const STORAGE_KEY = 'awanaConfig.v1';

// Per-key validators for override values coming back out of
// localStorage. Anything that fails its check is dropped so a corrupt
// or stale entry (e.g. a string where a number belongs) can never
// produce NaN timers or a broken screen on club night.
const isBool = (v) => typeof v === 'boolean';
const isString = (v) => typeof v === 'string';
const numberBetween = (min, max) => (v) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

const VALIDATORS = {
  pusherAppKey: isString,
  pusherCluster: isString,
  backgroundSource: (v) => ['powerpoint', 'manual', 'pptx'].includes(v),
  manualSlides: Array.isArray,
  powerpointEmbedUrl: isString,
  slideshowDelaySec: numberBetween(0, 600),
  useLocalSlideshow: isBool,
  countdownTargetTime: isString,
  standardDisplayMs: numberBetween(1000, 60000),
  specialDisplayMs: numberBetween(1000, 60000),
  gapBetweenBannersMs: numberBetween(0, 10000),
  audioMuted: isBool,
  showConnectionStatus: isBool,
  showTally: isBool,
  keepScreenAwake: isBool,
  milestoneEvery: numberBetween(0, 10000),
  showClock: isBool,
  showWeatherChip: isBool,
  widgetDisplayMode: (v) => v === 'cycle' || v === 'stickers',
  cycleIntervalSec: numberBetween(2, 120),
  calendarEnabled: isBool,
  calendarUrl: isString,
  sharedScheduleUrl: isString,
  sharedThemeUrl: isString,
  recapMaxAgeMin: numberBetween(1, 240),
  panicMode: isBool,
  clubMilestoneEvery: numberBetween(0, 1000),
  nightTheme: (v) => ['none', 'autumn', 'christmas', 'summer'].includes(v),
  calendarWelcomeText: isString,
  calendarShowWelcome: isBool,
  calendarShowNextWeek: isBool,
  calendarShowRemaining: isBool,
  weatherLocationName: isString,
  weatherLat: numberBetween(-90, 90),
  weatherLon: numberBetween(-180, 180),
  weatherUnits: (v) => v === 'fahrenheit' || v === 'celsius',
};

// Values that need repair beyond a type check. sanitizeSlides salvages
// a partially-corrupt slide array slide-by-slide, so one bad entry
// can't take out the whole typed deck.
const TRANSFORMS = {
  manualSlides: sanitizeSlides,
};

export function sanitizeOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  for (const [key, value] of Object.entries(raw)) {
    const valid = VALIDATORS[key];
    if (valid && valid(value)) clean[key] = TRANSFORMS[key] ? TRANSFORMS[key](value) : value;
  }
  return clean;
}

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeOverrides(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* localStorage may be blocked; fall back to in-memory only */
  }
}

/**
 * Merges the defaults from src/config.js with any per-device overrides
 * the user has set via the runtime Settings panel. Overrides win.
 * `remoteDefaults` (from ?config=<url>, already sanitized) slot between
 * the baked defaults and this device's overrides.
 */
export function useConfig(remoteDefaults) {
  const [overrides, setOverrides] = useState(loadOverrides);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setOverrides(loadOverrides());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const config = {
    ...defaults,
    audioMuted: !defaults.audioEnabledByDefault,
    ...(remoteDefaults || {}),
    ...overrides,
  };

  const updateConfig = useCallback((patch) => {
    setOverrides((prev) => {
      const next = sanitizeOverrides({ ...prev, ...patch });
      saveOverrides(next);
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setOverrides({});
  }, []);

  return { config, overrides, updateConfig, resetConfig };
}
