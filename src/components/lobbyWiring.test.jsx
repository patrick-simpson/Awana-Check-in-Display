// The lobby's motion, pinned at the wiring (rebrand stage 4b). The pure
// builders are tested in src/lib/lobbyMotion.test.js; these check that the
// components hand framer-motion exactly those keyframes, at those beats, on
// the right elements. framer-motion's own clock never runs in jsdom, so M is
// replaced by a recorder: a plain element that remembers the motion props it
// was given on every render, and that registers with AnimatePresence without
// ever finishing its exit, so an outgoing element stays in the DOM exactly as
// it does on the TV while it leaves.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { EASE } from '../lib/brand.js';
import {
  HANDOFF, STINGER_SEC, SWAP_AT, chromeMove, entranceHold, exitDelay, holdThenLeave, swellKeyframes, vanishAtSwap,
} from '../lib/lobbyMotion.js';

const fonts = vi.hoisted(() => {
  // A canvas whose metrics change when the "web font" lands: the fallback
  // face sets narrow, Galindo wide (it runs ~18% wider than Baloo 2).
  const state = { real: false, loads: 0, listeners: new Set() };
  class FakeCanvas {
    getContext() {
      return {
        font: '',
        measureText(text) {
          const shout = /Galindo/.test(this.font);
          const per = shout ? (state.real ? 0.95 : 0.5) : 0.55;
          return { width: [...text].reduce((w, ch) => w + (ch === ' ' ? 0.28 : per), 0) * 100 };
        },
      };
    }
  }
  globalThis.OffscreenCanvas = FakeCanvas;
  return state;
});

vi.mock('../hooks/useFontsReady.js', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useFontsReady: () => useSyncExternalStore(
      (cb) => { fonts.listeners.add(cb); return () => fonts.listeners.delete(cb); },
      () => fonts.loads,
    ),
  };
});

vi.mock('../lib/motion.jsx', async () => {
  const React = await import('react');
  const { PresenceContext, usePresence } = await import('framer-motion');
  const actual = await vi.importActual('../lib/motion.jsx');
  const log = new WeakMap();
  const cache = new Map();
  const make = (tag) => React.forwardRef(function Recorded({ initial, animate, exit, transition, variants, layout: _layout, ...rest }, ref) {
    const presence = React.useContext(PresenceContext);
    const [isPresent] = usePresence();
    const node = React.useRef(null);
    React.useLayoutEffect(() => {
      const el = node.current;
      const entry = log.get(el) ?? { history: [] };
      const seen = JSON.stringify(animate ?? null);
      if (entry.history.at(-1) !== seen) entry.history.push(seen);
      Object.assign(entry, { initial, animate, exit, transition, variants, custom: presence?.custom, isPresent });
      log.set(el, entry);
    });
    const setRef = (el) => {
      node.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    };
    return React.createElement(tag, { ...rest, ref: setRef, 'data-present': String(isPresent) });
  });
  const M = new Proxy({}, {
    get(_t, tag) {
      if (typeof tag !== 'string') return undefined;
      if (!cache.has(tag)) cache.set(tag, make(tag));
      return cache.get(tag);
    },
  });
  return { ...actual, M, motionLog: log };
});

import ManualSlideshow from './ManualSlideshow.jsx';
import SlideCopy from './SlideCopy.jsx';
import CatalogScene from './CatalogScene.jsx';
import { motionLog } from '../lib/motion.jsx';
import { getVideo } from '../lib/videoStore.js';

vi.mock('../lib/videoStore.js', () => ({ getVideo: vi.fn() }));

const rec = (el) => motionLog.get(el);
/** When a "hold, then land" keyframe list starts to move, in seconds. */
const landsAt = (el) => {
  const { transition } = rec(el);
  return transition.times ? transition.times[1] * transition.duration : 0;
};
const copies = (c) => [...c.querySelectorAll('.lobby-copy')];
const present = (el) => el.querySelector('[data-present]')?.getAttribute('data-present') === 'true';
const piecesOf = (copy) => [...copy.querySelectorAll('.lobby-kicker, .lobby-word, .lobby-sub, .lobby-chip')];

const sky = [
  { id: 's_1', eyebrow: 'This week', text: 'Bring your handbook', theme: 'sky', durationSec: 0 },
  { id: 's_2', eyebrow: 'Next club night', text: 'Making bracelets', theme: 'sky', durationSec: 0 },
];
const held = { id: 's_h', eyebrow: 'Important', text: 'Pick-up is at the gym doors', theme: 'sky', durationSec: 5, holdCheckIns: true };
const promo = { id: 'season_promo', type: 'promo', durationSec: 8, promos: [{ id: 'promo_contest', kind: 'contest', eventDate: '2026-10-14', tonight: false, countdown: '3 club nights left', afterContest: false }] };
const video = { id: 's_v', type: 'video', videoId: 'v_1', videoName: 'a.mp4', videoSize: 1, durationSec: 3 };

beforeEach(() => {
  vi.useFakeTimers();
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  getVideo.mockReset();
  getVideo.mockResolvedValue(new Blob(['x'], { type: 'video/webm' }));
  fonts.real = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the hand-off, as wired', () => {
  it('the first copy holds a boot beat, then the kicker, then each word on its own beat', () => {
    const { container } = render(<ManualSlideshow slides={sky} slideshowDelaySec={5} />);
    const [copy] = copies(container);
    expect(landsAt(copy.querySelector('.lobby-kicker'))).toBeCloseTo(entranceHold('boot'));
    const words = [...copy.querySelectorAll('.lobby-word')];
    expect(words.map((w) => w.textContent)).toEqual(['Bring', 'your', 'handbook']);
    words.forEach((w, i) => expect(landsAt(w)).toBeCloseTo(entranceHold('boot') + HANDOFF.wordAt + HANDOFF.wordStagger * i));
    // Each lands from hidden to rest, the rest being the last keyframe.
    expect(rec(words[0]).animate.opacity).toEqual([0, 0, 1]);
  });

  it('an ordinary change: the outgoing words lift away one after another while the incoming ones hold, then land', () => {
    const { container } = render(<ManualSlideshow slides={sky} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000));
    const all = copies(container);
    expect(all).toHaveLength(2);
    const [outgoing, incoming] = [all.find((c) => !present(c)), all.find(present)];
    expect(outgoing.textContent).toContain('Bring your handbook');
    expect(incoming.textContent).toContain('Making bracelets');

    const leaving = piecesOf(outgoing);
    expect(leaving).toHaveLength(4);
    leaving.forEach((el, i) => {
      const r = rec(el);
      expect(r.isPresent).toBe(false);
      expect(r.custom).toBe(false);
      expect(r.variants.leave(r.custom)).toEqual(
        holdThenLeave(exitDelay(i, 4), HANDOFF.exit, { opacity: 1, y: '0em' }, { opacity: 0, y: '-0.5em' }, EASE.exit),
      );
    });
    // The last outgoing piece has left before the first incoming one moves.
    const lastGone = exitDelay(3, 4) + HANDOFF.exit;
    expect(landsAt(incoming.querySelector('.lobby-kicker'))).toBeCloseTo(entranceHold('handoff'));
    expect(entranceHold('handoff')).toBeGreaterThanOrEqual(lastGone);
    const words = [...incoming.querySelectorAll('.lobby-word')];
    words.forEach((w, i) => expect(landsAt(w)).toBeCloseTo(entranceHold('handoff') + HANDOFF.wordAt + HANDOFF.wordStagger * i));
  });

  it('a change under the stinger: the outgoing copy waits for the cover and goes in one frame; the next lands after the wave', () => {
    const { container } = render(<ManualSlideshow slides={[sky[0], held]} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000));
    const all = copies(container);
    const outgoing = all.find((c) => !present(c));
    for (const el of piecesOf(outgoing)) {
      const r = rec(el);
      expect(r.custom).toBe(true);
      expect(r.variants.leave(r.custom)).toEqual(vanishAtSwap({ opacity: 1 }, { opacity: 0 }));
    }
    const incoming = all.find(present);
    expect(landsAt(incoming.querySelector('.lobby-kicker'))).toBeCloseTo(STINGER_SEC);
  });
});

describe('the chrome, as wired', () => {
  const tabOf = (c) => rec(c.querySelector('.lobby-tab'));
  const wavesOf = (c) => rec(c.querySelector('.lobby-waves'));

  it('for a poster it stays put until the stinger covers the screen, then goes; and comes back the same way', () => {
    const { container } = render(<ManualSlideshow slides={[sky[0], promo]} slideshowDelaySec={5} />);
    expect(tabOf(container).animate).toEqual({ y: '0%', opacity: 1 });
    act(() => vi.advanceTimersByTime(5000));
    expect(tabOf(container).animate).toEqual(chromeMove('home', 'hidden', 'wipe', '-112%').animate);
    expect(wavesOf(container).animate).toEqual(chromeMove('home', 'hidden', 'wipe', '112%').animate);
    expect(landsAt(container.querySelector('.lobby-tab'))).toBeCloseTo(SWAP_AT);
    act(() => vi.advanceTimersByTime(8000));
    expect(tabOf(container).animate).toEqual(chromeMove('hidden', 'home', 'wipe', '-112%').animate);
    expect(wavesOf(container).animate).toEqual(chromeMove('hidden', 'home', 'wipe', '112%').animate);
    expect(landsAt(container.querySelector('.lobby-waves'))).toBeCloseTo(SWAP_AT);
  });

  it('for a video on an ordinary change it slides aside, and slides home after', async () => {
    const { container } = render(<ManualSlideshow slides={[sky[0], video, sky[1]]} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000));
    await act(async () => {});
    expect(tabOf(container).animate).toEqual({ y: ['0%', '-112%'], opacity: [1, 1] });
    expect(wavesOf(container).animate).toEqual({ y: ['0%', '112%'], opacity: [1, 1] });
    expect(tabOf(container).transition).toMatchObject({ duration: HANDOFF.chrome, ease: EASE.wipe });
    act(() => vi.advanceTimersByTime(3000));
    expect(tabOf(container).animate).toEqual({ y: ['-112%', '0%'], opacity: [1, 1] });
    expect(wavesOf(container).animate).toEqual({ y: ['112%', '0%'], opacity: [1, 1] });
  });

  it('a plain edit re-render never re-targets it', () => {
    const { container, rerender } = render(<CatalogScene theme="sky" chromeAway={false} chromeVia="boot" />);
    const before = tabOf(container).history.length;
    rerender(<CatalogScene theme="sky" chromeAway={false} chromeVia="handoff" swell={1} />);
    expect(tabOf(container).history.length).toBe(before);
  });
});

describe('the house wave, as wired', () => {
  it('swells exactly once per hand-off, and never again when the chrome comes back from a video', async () => {
    const { container } = render(<ManualSlideshow slides={[sky[0], sky[1], video]} slideshowDelaySec={5} />);
    const house = () => container.querySelector('.lobby-wave--house');
    const first = house();
    expect(rec(first).animate).toBeUndefined();

    act(() => vi.advanceTimersByTime(5000)); // a hand-off
    const swelled = house();
    expect(swelled).not.toBe(first);
    expect(rec(swelled).animate).toEqual(swellKeyframes('-16%').animate);
    expect(rec(swelled).transition).toEqual(swellKeyframes('-16%').transition);

    act(() => vi.advanceTimersByTime(5000)); // → the video: the chrome steps aside
    await act(async () => {});
    act(() => vi.advanceTimersByTime(3000)); // → back to words: a reveal, not a hand-off
    expect(house()).toBe(swelled);
    // Its target never went and came back, so framer-motion has nothing to replay.
    expect(rec(swelled).history).toHaveLength(1);

    act(() => vi.advanceTimersByTime(5000)); // the next real hand-off swells again
    expect(house()).not.toBe(swelled);
    expect(rec(house()).animate).toEqual(swellKeyframes('-16%').animate);
  });
});

describe('the field, as wired', () => {
  it('crossfades when the next slide wants another theme: the new field fades up over the old, which holds until covered', () => {
    const { container } = render(<ManualSlideshow slides={[sky[0], { ...sky[1], theme: 'night' }]} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000));
    const fields = [...container.querySelectorAll('.lobby-field')];
    expect(fields).toHaveLength(2);
    const night = container.querySelector('.lobby-field--night');
    const old = container.querySelector('.lobby-field--sky');
    expect(rec(night).animate).toEqual({ opacity: [0, 1] });
    expect(rec(night).transition).toMatchObject({ duration: HANDOFF.field });
    const r = rec(old);
    expect(r.isPresent).toBe(false);
    expect(r.variants.leave(r.custom)).toEqual(holdThenLeave(HANDOFF.field, 0.02, { opacity: 1 }, { opacity: 0 }, 'linear'));
  });

  it('under the stinger the new field swaps in at mid-cover', () => {
    const { container } = render(<ManualSlideshow slides={[sky[0], { ...held, theme: 'night' }]} slideshowDelaySec={5} />);
    act(() => vi.advanceTimersByTime(5000));
    const night = container.querySelector('.lobby-field--night');
    expect(rec(night).animate).toEqual({ opacity: [0, 0, 1] });
    expect(landsAt(night)).toBeCloseTo(SWAP_AT);
  });
});

describe('a web font that lands late', () => {
  const frame = { kicker: 'This week', headline: 'Please bring your handbook and your Bible to club', sub: '', chip: null, textSize: 'auto' };

  it('re-lays the same elements out: nothing that has started landing disappears and lands again', () => {
    const { container } = render(<SlideCopy frame={frame} via="boot" />);
    const headline = () => container.querySelector('.lobby-headline');
    expect(headline().classList.contains('lobby-headline--shout')).toBe(true);
    const before = piecesOf(container);
    const targets = before.map((el) => JSON.stringify(rec(el).animate));

    // Galindo arrives: the words now measure wide enough to fall to the read layout.
    fonts.real = true;
    act(() => {
      fonts.loads += 1;
      for (const cb of fonts.listeners) cb();
    });
    expect(headline().classList.contains('lobby-headline--read')).toBe(true);

    const after = piecesOf(container);
    expect(after).toHaveLength(before.length);
    after.forEach((el, i) => {
      expect(el).toBe(before[i]);
      // Same target as before, so framer-motion never restarts it.
      expect(JSON.stringify(rec(el).animate)).toBe(targets[i]);
      expect(rec(el).history).toHaveLength(1);
    });
  });

  it('a run of words against the headline\'s direction keeps its <bdi> and its words through the refit', () => {
    const mixed = { ...frame, headline: 'Please say שבת שלום to your friends at club' };
    const { container } = render(<SlideCopy frame={mixed} via="boot" />);
    const headline = () => container.querySelector('.lobby-headline');
    expect(headline().classList.contains('lobby-headline--shout')).toBe(true);
    const run = container.querySelector('bdi.lobby-run');
    const before = piecesOf(container);
    const inRun = [...run.querySelectorAll('.lobby-word')];
    expect(inRun.map((w) => w.textContent)).toEqual(['שבת', 'שלום']);

    fonts.real = true;
    act(() => {
      fonts.loads += 1;
      for (const cb of fonts.listeners) cb();
    });
    expect(headline().classList.contains('lobby-headline--read')).toBe(true);
    expect(container.querySelector('bdi.lobby-run')).toBe(run);
    expect([...run.querySelectorAll('.lobby-word')]).toEqual(inRun);
    const after = piecesOf(container);
    expect(after).toHaveLength(before.length);
    after.forEach((el, i) => {
      expect(el).toBe(before[i]);
      expect(rec(el).history).toHaveLength(1);
    });
  });
});
