import { useSyncExternalStore } from 'react';
import defaults from '../config.js';
import { sanitizeSlides } from '../lib/slides.js';
import { NIGHT_THEME_VALUES } from '../lib/skins.js';
import { parseUrlFlags } from '../lib/urlFlags.js';

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
  backgroundSource: (v) => ['powerpoint', 'manual', 'pptx', 'video'].includes(v),
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
  // Who's-still-here board. OFF by default and deliberately so — see
  // CheckoutBoard.jsx for why this one needs an operator decision rather than a
  // sensible default.
  checkoutBoardMode: (v) => ['off', 'pickup', 'always'].includes(v),
  checkoutBoardNamesAbove: numberBetween(0, 200),
  checkoutBoardStaleMin: numberBetween(1, 120),
  // Reads the one skin table rather than repeating its ids — adding a season
  // used to mean editing this list, skins.js, the Settings dropdown and the CSS.
  nightTheme: (v) => NIGHT_THEME_VALUES.includes(v),
  followPrinterTheme: (v) => typeof v === 'boolean',
  followPublishedSlides: isBool,
  aprilFools: (v) => typeof v === 'boolean',
  particleEffect: (v) => ['auto', 'off', 'snow', 'rain', 'sparkle'].includes(v),
  weatherTheme: isBool,
  calendarWelcomeText: isString,
  calendarShowWelcome: isBool,
  calendarShowNextWeek: isBool,
  calendarShowRemaining: isBool,
  weatherLocationName: isString,
  weatherLat: numberBetween(-90, 90),
  weatherLon: numberBetween(-180, 180),
  weatherUnits: (v) => v === 'fahrenheit' || v === 'celsius',
  watchdogReloadMin: numberBetween(0, 1440),
  burstFloorMs: numberBetween(1000, 10000),
  clubPhrases: (v) => !!v && typeof v === 'object' && !Array.isArray(v),
  confettiLevel: (v) => ['full', 'reduced', 'off'].includes(v),
  reduceMotion: isBool,
};

// Banner flavor text per club: keep only short strings, keyed
// case-insensitively, capped so a runaway import can't bloat storage.
function sanitizeClubPhrases(raw) {
  const clean = {};
  for (const [club, phrase] of Object.entries(raw).slice(0, 15)) {
    if (typeof phrase !== 'string' || !phrase.trim()) continue;
    const key = club.trim().toLowerCase().slice(0, 40);
    if (!key) continue;
    clean[key] = phrase.trim().slice(0, 80);
  }
  return clean;
}

// Values that need repair beyond a type check. sanitizeSlides salvages
// a partially-corrupt slide array slide-by-slide, so one bad entry
// can't take out the whole typed deck.
const TRANSFORMS = {
  manualSlides: sanitizeSlides,
  clubPhrases: sanitizeClubPhrases,
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

// ── One store for the whole page ─────────────────────────────────────────────
// Every useConfig() call used to own its own useState(loadOverrides) slot and
// only heard about changes through the cross-tab `storage` event — which never
// fires in the tab that made the change. So saving the Pusher key in Settings
// did not reach the socket's copy until someone reloaded, and the ?config= layer
// (fetched in App) never reached the socket at all. A single module-level store
// read through useSyncExternalStore gives every hook the same snapshot the
// instant anything changes, in this tab and (via `storage`) in others, and keeps
// working when localStorage is blocked because the overrides live in memory.
//
// Layers, lowest to highest:
//   1. src/config.js baked defaults (incl. VITE_PUSHER_* from the build)
//   2. ?config=<url> remote JSON — App fetches it and calls setRemoteDefaults()
//   3. this device's saved overrides (awanaConfig.v1)
//      ⇒ storedConfig: what Settings edits and Export writes
//   4. URL flags — ?key=/&cluster= and ?lowPower=1 (src/lib/urlFlags.js) — in
//      memory only: never saved, never shown as a saved setting, never exported
//      ⇒ config: what the socket and the stage consume
// The panic mask (src/lib/panic.js) is applied by App on top of `config` and
// nowhere else — it is a rendering concern, not a setting.

let flags = null;           // parsed lazily once per page (tests reset it)
let overrides = null;       // null = not yet read from localStorage
let remoteDefaults = {};    // the ?config= layer
let snapshot = null;        // cached { config, storedConfig, overrides }
const listeners = new Set();

const getFlags = () => flags ?? (flags = parseUrlFlags());
const getOverrides = () => overrides ?? (overrides = loadOverrides());

/**
 * Layers 1–3: baked defaults < ?config= remote < this device's overrides.
 * Pure and exported so the compatibility rule below is unit-testable.
 */
export function resolveStoredConfig(remote, device) {
  const stored = {
    ...defaults,
    audioMuted: !defaults.audioEnabledByDefault,
    ...remote,
    ...device,
  };
  // backgroundSource now defaults to 'manual' (the typed/published deck). A
  // screen — or a fleet file — set up before that saved only a PowerPoint URL
  // and relied on 'powerpoint' being the default. A URL with no explicit source
  // at either layer still means PowerPoint, so nothing already on a wall changes.
  const explicit = 'backgroundSource' in remote || 'backgroundSource' in device;
  if (!explicit && (device.powerpointEmbedUrl || remote.powerpointEmbedUrl)) {
    stored.backgroundSource = 'powerpoint';
  }
  return stored;
}

// Layer 4: URL flags. ?cluster= is honoured only alongside ?key= (an embed
// URL names a whole Pusher app or nothing); ?lowPower=1 forces the two
// motion keys down for THIS embed only — confettiLevel/reduceMotion's own
// defaults stay full-strength for every other device (see CLAUDE.md).
function applyFlags(stored, f) {
  let out = stored;
  if (f.pusherAppKey) {
    out = { ...out, pusherAppKey: f.pusherAppKey, pusherCluster: f.pusherCluster || out.pusherCluster };
  }
  if (f.lowPower) out = { ...out, confettiLevel: 'off', reduceMotion: true };
  return out;
}

function getSnapshot() {
  if (!snapshot) {
    const storedConfig = resolveStoredConfig(remoteDefaults, getOverrides());
    snapshot = {
      config: applyFlags(storedConfig, getFlags()),
      storedConfig,
      overrides: getOverrides(),
    };
  }
  return snapshot;
}

function invalidate() {
  snapshot = null;
  for (const fn of listeners) fn();
}

// Other tabs announce their saves through `storage` (key null = a clear).
const onStorage = (e) => {
  if (e.key === STORAGE_KEY || e.key === null) {
    overrides = loadOverrides();
    invalidate();
  }
};

function subscribe(fn) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

/** Merge a patch into this device's overrides (sanitized key by key) and persist. */
export function updateConfig(patch) {
  overrides = sanitizeOverrides({ ...getOverrides(), ...patch });
  saveOverrides(overrides);
  invalidate();
}

/** Drop every device override — back to defaults (+ the remote layer, if any). */
export function resetConfig() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  overrides = {};
  invalidate();
}

/** The ?config=<url> layer, already fetched by App. Sanitized like overrides. */
export function setRemoteDefaults(raw) {
  remoteDefaults = sanitizeOverrides(raw);
  invalidate();
}

/** Tests only: forget flags, overrides and the remote layer so each case starts clean. */
export function _resetForTest() {
  flags = null;
  overrides = null;
  remoteDefaults = {};
  snapshot = null;
}

/**
 * The page's config, from the one store above.
 *  - `config`       effective: defaults < remote < overrides < URL flags
 *  - `storedConfig` the same without URL flags — what Settings edits/exports
 *  - `overrides`    this device's saved layer alone
 * `updateConfig` / `resetConfig` are stable module functions, safe in deps.
 */
export function useConfig() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    config: snap.config,
    storedConfig: snap.storedConfig,
    overrides: snap.overrides,
    updateConfig,
    resetConfig,
  };
}
