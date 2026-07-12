// ─────────────────────────────────────────────────────────────
// Manual "typed slides" — the free-text alternative to the
// PowerPoint background. Pure data helpers, no React.
//
// A slide is:
//   { id, eyebrow, text, theme, durationSec }
//
// text     the free-typed body (required, multi-line, ≤ MAX_TEXT)
// eyebrow  optional small-caps line above the text (≤ MAX_EYEBROW)
// theme    'auto' rotates through SLIDE_THEMES by position
// durationSec  0 = follow the global slideshowDelaySec setting
// ─────────────────────────────────────────────────────────────

export const SLIDE_THEMES = ['sky', 'sunset', 'night', 'meadow'];
export const MAX_SLIDES = 50;
export const MAX_TEXT = 500;
export const MAX_EYEBROW = 60;
export const MIN_DURATION_SEC = 3;
export const MAX_DURATION_SEC = 600;
export const DEFAULT_DURATION_SEC = 8;

export function makeSlideId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 's_' + crypto.randomUUID();
  }
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function makeSlide(partial = {}) {
  return {
    id: makeSlideId(),
    eyebrow: '',
    text: '',
    theme: 'auto',
    durationSec: 0,
    ...partial,
  };
}

// The robustness core: turns whatever came out of localStorage (or a
// pasted import file) into a safe slide array. Salvages what it can —
// a single corrupt entry drops that slide, not the whole deck — and
// never throws, so a bad value can't blank the signage screen.
export function sanitizeSlides(raw) {
  if (!Array.isArray(raw)) return [];
  const clean = [];
  const seenIds = new Set();
  for (const entry of raw) {
    if (clean.length >= MAX_SLIDES) break;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    if (typeof entry.text !== 'string' || entry.text.trim() === '') continue;

    let id = typeof entry.id === 'string' && entry.id ? entry.id : makeSlideId();
    while (seenIds.has(id)) id = makeSlideId();
    seenIds.add(id);

    const eyebrow = typeof entry.eyebrow === 'string' ? entry.eyebrow.slice(0, MAX_EYEBROW) : '';
    const theme = SLIDE_THEMES.includes(entry.theme) ? entry.theme : 'auto';

    let durationSec = 0;
    if (typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec) && entry.durationSec > 0) {
      durationSec = Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, Math.round(entry.durationSec)));
    }

    clean.push({ id, eyebrow, text: entry.text.slice(0, MAX_TEXT), theme, durationSec });
  }
  return clean;
}

// 'auto' cycles through the themes by slide position, so a deck typed
// with all-default themes still gets the full catalog variety.
export function resolveTheme(slide, index) {
  if (slide && SLIDE_THEMES.includes(slide.theme)) return slide.theme;
  return SLIDE_THEMES[((index % SLIDE_THEMES.length) + SLIDE_THEMES.length) % SLIDE_THEMES.length];
}

// Auto-fit: short punchy lines get the giant catalog headline size,
// long announcements step down so they never overflow the screen.
export function slideSizeClass(text = '') {
  const len = text.length;
  if (len < 48) return 'slide-size-xl';
  if (len < 140) return 'slide-size-lg';
  if (len < 300) return 'slide-size-md';
  return 'slide-size-sm';
}

// Per-slide override → global slideshow delay → default, in ms.
export function slideDurationMs(slide, globalDelaySec) {
  let sec = slide?.durationSec;
  if (!(typeof sec === 'number' && Number.isFinite(sec) && sec > 0)) {
    sec = typeof globalDelaySec === 'number' && Number.isFinite(globalDelaySec) && globalDelaySec > 0
      ? globalDelaySec
      : DEFAULT_DURATION_SEC;
  }
  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, sec)) * 1000;
}
