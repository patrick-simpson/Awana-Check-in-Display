// ─────────────────────────────────────────────────────────────
// Manual "typed slides" — the free-text alternative to the
// PowerPoint background. Pure data helpers, no React.
//
// A text slide is:
//   { id, eyebrow, text, theme, durationSec, textSize }
//
// text     the free-typed body (required, multi-line, ≤ MAX_TEXT)
// eyebrow  optional small-caps line above the text (≤ MAX_EYEBROW)
// theme    'auto' rotates through SLIDE_THEMES by position
// textSize 'auto' picks a size from the text length; 'xl'/'lg'/'md'
//          force one when auto guesses wrong
// durationSec  0 = follow the global slideshowDelaySec setting
//
// A video slide is:
//   { id, type: 'video', videoId, videoName, videoSize, durationSec }
//
// videoId   key of the video Blob in IndexedDB (see videoStore.js) —
//           the bytes live on this device only, never uploaded
// videoName display-only filename (≤ MAX_VIDEO_NAME)
// videoSize bytes, display-only (0 = unknown)
// durationSec  0 = play the video to the END, then advance (NOT the
//           global-delay fallback text slides use); >0 = hold that
//           long with the video looping underneath
// ─────────────────────────────────────────────────────────────

export const SLIDE_THEMES = ['sky', 'sunset', 'night', 'meadow'];
export const TEXT_SIZES = ['auto', 'xl', 'lg', 'md'];
export const MAX_SLIDES = 50;
export const MAX_TEXT = 500;
export const MAX_EYEBROW = 60;
export const MAX_VIDEO_NAME = 120;
export const MIN_DURATION_SEC = 3;
export const MAX_DURATION_SEC = 600;
export const DEFAULT_DURATION_SEC = 8;
// Above this the picker asks "are you sure" (large files are slow to
// store and decode on signage sticks) — it warns, never blocks.
export const VIDEO_SIZE_WARN_BYTES = 200 * 1024 * 1024;

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
    textSize: 'auto',
    ...partial,
  };
}

export function makeVideoSlide({ videoId, videoName = '', videoSize = 0 } = {}) {
  return {
    id: makeSlideId(),
    type: 'video',
    videoId,
    videoName: String(videoName).slice(0, MAX_VIDEO_NAME),
    videoSize: Number.isFinite(videoSize) && videoSize > 0 ? Math.round(videoSize) : 0,
    durationSec: 0,
  };
}

export function isVideoSlide(slide) {
  return slide?.type === 'video';
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

    const isVideo = entry.type === 'video';
    if (isVideo) {
      if (typeof entry.videoId !== 'string' || entry.videoId.trim() === '') continue;
    } else if (typeof entry.text !== 'string' || entry.text.trim() === '') {
      // Unknown `type` values fall through to the text rules, so a
      // future/bogus type without usable text drops harmlessly.
      continue;
    }

    let id = typeof entry.id === 'string' && entry.id ? entry.id : makeSlideId();
    while (seenIds.has(id)) id = makeSlideId();
    seenIds.add(id);

    let durationSec = 0;
    if (typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec) && entry.durationSec > 0) {
      durationSec = Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, Math.round(entry.durationSec)));
    }

    if (isVideo) {
      const videoName = typeof entry.videoName === 'string' ? entry.videoName.slice(0, MAX_VIDEO_NAME) : '';
      const videoSize = typeof entry.videoSize === 'number' && Number.isFinite(entry.videoSize) && entry.videoSize > 0
        ? Math.round(entry.videoSize)
        : 0;
      clean.push({ id, type: 'video', videoId: entry.videoId, videoName, videoSize, durationSec });
      continue;
    }

    const eyebrow = typeof entry.eyebrow === 'string' ? entry.eyebrow.slice(0, MAX_EYEBROW) : '';
    const theme = SLIDE_THEMES.includes(entry.theme) ? entry.theme : 'auto';
    const textSize = TEXT_SIZES.includes(entry.textSize) ? entry.textSize : 'auto';

    clean.push({ id, eyebrow, text: entry.text.slice(0, MAX_TEXT), theme, durationSec, textSize });
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
  if (len < 60) return 'slide-size-xl';
  if (len < 160) return 'slide-size-lg';
  if (len < 320) return 'slide-size-md';
  return 'slide-size-sm';
}

// The class the slideshow (and editor thumbnails) actually render:
// an explicit per-slide textSize wins; 'auto' falls back to length.
export function resolveSizeClass(slide) {
  if (slide && slide.textSize && slide.textSize !== 'auto' && TEXT_SIZES.includes(slide.textSize)) {
    return `slide-size-${slide.textSize}`;
  }
  return slideSizeClass(slide?.text ?? '');
}

// Per-slide override → global slideshow delay → default, in ms.
// TEXT slides only — video slides use videoSlideTimerMs.
export function slideDurationMs(slide, globalDelaySec) {
  let sec = slide?.durationSec;
  if (!(typeof sec === 'number' && Number.isFinite(sec) && sec > 0)) {
    sec = typeof globalDelaySec === 'number' && Number.isFinite(globalDelaySec) && globalDelaySec > 0
      ? globalDelaySec
      : DEFAULT_DURATION_SEC;
  }
  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, sec)) * 1000;
}

// Video slides: null means "no timer — advance when the video ends".
// A positive durationSec holds the slide exactly that long instead.
export function videoSlideTimerMs(slide) {
  const sec = slide?.durationSec;
  if (typeof sec === 'number' && Number.isFinite(sec) && sec > 0) {
    return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, sec)) * 1000;
  }
  return null;
}
