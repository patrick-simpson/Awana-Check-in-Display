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
 *   force: number | null,
 * }} BraceletSettings
 */

/** @type {BraceletSettings} */
export const DEFAULT_BRACELET_SETTINGS = Object.freeze({
  display: 'overview', // the full instructions, with the epic how-to every 5 minutes
  hold: null, // or 0..12: keep this one step up
  epic: true, // the every-5-minutes epic how-to
  chime: true, // the chime 10 s before each showing
  still: false, // animations off: still pictures, no epic
  force: null, // "Show Bracelet Time now": when it was switched on (ms), or off
});

const DISPLAYS = ['auto', 'overview', 'handout1', 'handout2'];

/**
 * @param {any} raw
 * @returns {BraceletSettings}
 */
export function sanitizeBraceletSettings(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return {
    display: DISPLAYS.includes(v.display) ? v.display : DEFAULT_BRACELET_SETTINGS.display,
    hold: Number.isInteger(v.hold) && v.hold >= 0 && v.hold <= 12 ? v.hold : null,
    epic: v.epic !== false,
    chime: v.chime !== false,
    still: v.still === true,
    force: Number.isFinite(v.force) && v.force > 0 ? v.force : null,
  };
}

/** The device's local date, "YYYY-MM-DD". @param {Date} d */
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * "Show Bracelet Time now" (owner, 2026-09-30: the settings can put the
 * bracelet screen up any time). It is on from the moment it was switched on
 * until that day's midnight on this device, so a switch left on can never
 * replace next week's opening ceremony, and it survives a reload in between.
 * @param {BraceletSettings} s
 * @param {Date} now
 */
export function braceletForced(s, now) {
  return s.force != null && dayKey(new Date(s.force)) === dayKey(now);
}

/**
 * Switch "Show Bracelet Time now" on (stamped with the page's own clock, so
 * `?now=` time travel works) or off.
 * @param {boolean} on
 * @param {Date} now
 */
export function setBraceletForced(on, now) {
  setBraceletSettings({ force: on ? now.getTime() : null });
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
