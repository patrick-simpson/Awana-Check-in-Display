// @ts-check
// The Bracelet Time controls panel's choices, saved on this projector PC
// until someone presses Reset (owner, 2026-09-30). Same shape of store as
// useLowPower / the stingers toggle: one localStorage entry, sanitized on
// the way in and out, and a tiny subscribe/notify so every part of the page
// reads one value.

const STORAGE_KEY = 'awanaBraceletSettings.v1';

/**
 * @typedef {{
 *   display: 'auto' | 'overview' | 'handout1' | 'handout2',
 *   hold: number | null,
 *   epic: boolean,
 *   chime: boolean,
 *   still: boolean,
 * }} BraceletSettings
 */

/** @type {BraceletSettings} */
export const DEFAULT_BRACELET_SETTINGS = Object.freeze({
  display: 'auto', // the step-by-step wall with its epic reel
  hold: null, // or 0..12: keep this one step up
  epic: true, // the every-5-minutes epic how-to
  chime: true, // the chime 10 s before each showing
  still: false, // animations off: still pictures, no epic
});

const DISPLAYS = ['auto', 'overview', 'handout1', 'handout2'];

/**
 * @param {any} raw
 * @returns {BraceletSettings}
 */
export function sanitizeBraceletSettings(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return {
    display: DISPLAYS.includes(v.display) ? v.display : 'auto',
    hold: Number.isInteger(v.hold) && v.hold >= 0 && v.hold <= 12 ? v.hold : null,
    epic: v.epic !== false,
    chime: v.chime !== false,
    still: v.still === true,
  };
}

function read() {
  try {
    return sanitizeBraceletSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return { ...DEFAULT_BRACELET_SETTINGS };
  }
}

let current = read();
const listeners = new Set();

export function getBraceletSettings() {
  return current;
}

/** @param {() => void} fn */
export function subscribeBraceletSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** @param {Partial<BraceletSettings>} patch */
export function setBraceletSettings(patch) {
  current = sanitizeBraceletSettings({ ...current, ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage blocked: the choice still applies until a reload */
  }
  for (const fn of listeners) fn();
}

export function resetBraceletSettings() {
  current = { ...DEFAULT_BRACELET_SETTINGS };
  manualEpicAt = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing saved to clear */
  }
  for (const fn of listeners) fn();
}

/** True when any choice differs from the defaults (the panel's "changed" badge). */
export function braceletSettingsChanged(s = current) {
  const a = /** @type {Record<string, unknown>} */ (s);
  const d = /** @type {Record<string, unknown>} */ (DEFAULT_BRACELET_SETTINGS);
  return Object.keys(d).some((k) => a[k] !== d[k]);
}

// "Play the epic now" is an action, not a setting: it is never saved, and
// lasts only as long as the page (the view reads it on every render).
/** @type {number | null} */
let manualEpicAt = null;
/** @param {number} ms the instant it was asked for */
export function playEpicNow(ms) {
  manualEpicAt = ms;
  for (const fn of listeners) fn();
}
export function manualEpicStart() {
  return manualEpicAt;
}
