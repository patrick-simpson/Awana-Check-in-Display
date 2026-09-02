import { describe, it, expect } from 'vitest';
import {
  MAX_EYEBROW,
  MAX_SLIDES,
  MAX_TEXT,
  MAX_VIDEO_NAME,
  SLIDE_THEMES,
  isVideoSlide,
  makeSlide,
  makeSlideId,
  makeVideoSlide,
  mergeSyncedDeck,
  resolveSizeClass,
  resolveTheme,
  sanitizeSlides,
  slideDurationMs,
  slideSizeClass,
  videoSlideTimerMs,
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
    const slide = { id: 's_1', eyebrow: 'Awana', text: 'Welcome!', theme: 'night', durationSec: 10, textSize: 'auto' };
    expect(sanitizeSlides([slide])).toEqual([slide]);
  });

  it('normalizes legacy slides (no textSize) without dropping them', () => {
    const legacy = { id: 's_1', eyebrow: 'Awana', text: 'Welcome!', theme: 'night', durationSec: 10 };
    expect(sanitizeSlides([legacy])).toEqual([{ ...legacy, textSize: 'auto' }]);
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

  it('keeps a per-slide text size and falls back to auto for garbage', () => {
    expect(sanitizeSlides([{ text: 'a', textSize: 'xl' }])[0].textSize).toBe('xl');
    expect(sanitizeSlides([{ text: 'a', textSize: 'gigantic' }])[0].textSize).toBe('auto');
    expect(sanitizeSlides([{ text: 'a', textSize: 42 }])[0].textSize).toBe('auto');
  });

  it('accepts video slides without text but requires a videoId', () => {
    const video = { id: 's_v', type: 'video', videoId: 'v_1', videoName: 'promo.mp4', videoSize: 1000, durationSec: 0 };
    expect(sanitizeSlides([video])).toEqual([video]);
    expect(sanitizeSlides([{ type: 'video' }])).toEqual([]);
    expect(sanitizeSlides([{ type: 'video', videoId: '' }])).toEqual([]);
    expect(sanitizeSlides([{ type: 'video', videoId: '   ' }])).toEqual([]);
    expect(sanitizeSlides([{ type: 'video', videoId: 42 }])).toEqual([]);
  });

  it('repairs video slide metadata', () => {
    const [slide] = sanitizeSlides([{
      type: 'video',
      videoId: 'v_1',
      videoName: 'x'.repeat(MAX_VIDEO_NAME + 40),
      videoSize: 'huge',
      durationSec: 9999,
    }]);
    expect(slide.videoName).toHaveLength(MAX_VIDEO_NAME);
    expect(slide.videoSize).toBe(0);
    expect(slide.durationSec).toBe(600);
    // Video slides never carry text fields
    expect(slide.text).toBeUndefined();
    expect(slide.theme).toBeUndefined();
  });

  it('treats unknown types as text slides (dropped without text, normalized with it)', () => {
    expect(sanitizeSlides([{ type: 'gif', videoId: 'v_1' }])).toEqual([]);
    const [slide] = sanitizeSlides([{ type: 'gif', text: 'hi' }]);
    expect(slide.text).toBe('hi');
    expect(slide.type).toBeUndefined();
  });
});

describe('makeVideoSlide / isVideoSlide / videoSlideTimerMs', () => {
  it('makes a video slide that survives sanitizing', () => {
    const slide = makeVideoSlide({ videoId: 'v_1', videoName: 'promo.mp4', videoSize: 12345 });
    expect(isVideoSlide(slide)).toBe(true);
    expect(sanitizeSlides([slide])).toEqual([slide]);
  });

  it('is not fooled by text slides or junk', () => {
    expect(isVideoSlide(makeSlide({ text: 'hi' }))).toBe(false);
    expect(isVideoSlide(null)).toBe(false);
    expect(isVideoSlide({ type: 'gif' })).toBe(false);
  });

  it('returns null (ended-event mode) for duration 0, clamped ms otherwise', () => {
    expect(videoSlideTimerMs({ durationSec: 0 })).toBeNull();
    expect(videoSlideTimerMs(undefined)).toBeNull();
    expect(videoSlideTimerMs({ durationSec: 5 })).toBe(5000);
    expect(videoSlideTimerMs({ durationSec: 1 })).toBe(3000);
    expect(videoSlideTimerMs({ durationSec: 9999 })).toBe(600000);
  });
});

describe('resolveSizeClass', () => {
  it('honors an explicit per-slide size', () => {
    expect(resolveSizeClass({ text: 'x'.repeat(400), textSize: 'xl' })).toBe('slide-size-xl');
    expect(resolveSizeClass({ text: 'hi', textSize: 'md' })).toBe('slide-size-md');
  });

  it('falls back to the length buckets on auto or garbage', () => {
    expect(resolveSizeClass({ text: 'Welcome!', textSize: 'auto' })).toBe('slide-size-xl');
    expect(resolveSizeClass({ text: 'x'.repeat(400), textSize: 'huge' })).toBe('slide-size-sm');
    expect(resolveSizeClass(undefined)).toBe('slide-size-xl');
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
    expect(resolveTheme(auto, SLIDE_THEMES.length)).toBe(first); // full cycle → wraps
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

describe('mergeSyncedDeck', () => {
  const text = (id, body) => ({ id, eyebrow: '', text: body, theme: 'auto', durationSec: 0, textSize: 'auto' });
  const video = (id, videoId) => ({ id, type: 'video', videoId, videoName: 'clip.mp4', videoSize: 1000, durationSec: 0 });

  it('returns the published deck untouched when this device has no video slides', () => {
    const synced = [text('s_a', 'Hello'), text('s_b', 'World')];
    expect(mergeSyncedDeck(synced, [text('s_local', 'Old local')])).toEqual(synced);
    expect(mergeSyncedDeck(synced, [])).toEqual(synced);
    expect(mergeSyncedDeck(synced, null)).toEqual(synced);
  });

  it('keeps this device\'s video slides in the rotation — the "saved a video and it vanished" fix', () => {
    const synced = [text('s_a', 'Hello')];
    const local = [video('s_v', 'vid_1')];
    const merged = mergeSyncedDeck(synced, local);
    expect(merged.map((s) => s.id)).toEqual(['s_a', 's_v']);
    expect(merged.filter(isVideoSlide)).toHaveLength(1);
  });

  it('honors the local interleave when local text matches the published text', () => {
    const synced = [text('s_a', 'Hello'), text('s_b', 'World')];
    const local = [text('s_a', 'Hello'), video('s_v', 'vid_1'), text('s_b', 'World')];
    expect(mergeSyncedDeck(synced, local).map((s) => s.id)).toEqual(['s_a', 's_v', 's_b']);
  });

  it('falls back to published-text-first + videos appended when the fleet has newer text', () => {
    const synced = [text('s_new', 'Fresh publish')];
    const local = [text('s_a', 'Stale'), video('s_v', 'vid_1'), text('s_b', 'Old')];
    const merged = mergeSyncedDeck(synced, local);
    expect(merged.map((s) => s.text ?? 'VIDEO')).toEqual(['Fresh publish', 'VIDEO']);
    expect(merged[0].id).toBe('s_new');
    expect(merged[1].videoId).toBe('vid_1');
  });

  it('an explicitly published EMPTY deck still plays this device\'s videos', () => {
    const local = [video('s_v', 'vid_1')];
    const merged = mergeSyncedDeck([], local);
    expect(merged).toHaveLength(1);
    expect(merged[0].videoId).toBe('vid_1');
  });

  it('dedupes an id shared between the published deck and a local video', () => {
    const synced = [text('s_dup', 'Hello')];
    const local = [text('s_x', 'Different'), video('s_dup', 'vid_1')];
    const merged = mergeSyncedDeck(synced, local);
    const ids = merged.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(merged.filter(isVideoSlide)).toHaveLength(1);
  });
});
