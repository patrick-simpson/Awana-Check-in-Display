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
import { READ } from '../lib/lobbyFrame.js';
import {
  HANDOFF, STINGER_SEC, SWAP_AT, chromeMove, entranceHold, exitDelay, holdThenLeave, swellKeyframes, vanishAtSwap,
} from '../lib/lobbyMotion.js';

const fonts = vi.hoisted(() => {
  // A canvas whose metrics change when the "web font" lands: the fallback
  // face sets narrow, Galindo wide (it runs ~18% wider than Baloo 2). A test
  // can set `faces` instead: per face named in the canvas font, the width of
  // a letter before and after the fonts land (any face it leaves out: 0.55).
  const state = { real: false, loads: 0, listeners: new Set(), faces: null };
  class FakeCanvas {
    getContext() {
      return {
        font: '',
        measureText(text) {
          const shout = /Galindo/.test(this.font);
          const face = state.faces && Object.keys(state.faces).find((name) => this.font.includes(name));
          const per = state.faces ? (face ? state.faces[face][state.real ? 1 : 0] : 0.55) : shout ? (state.real ? 0.95 : 0.5) : 0.55;
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
  fonts.faces = null;
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

  it('a run of words against the headline\'s direction keeps its <bdi>, its words and its edge punctuation through the refit', () => {
    const mixed = { ...frame, headline: 'Please say "שבת שלום" to your friends at club' };
    const { container } = render(<SlideCopy frame={mixed} via="boot" />);
    const headline = () => container.querySelector('.lobby-headline');
    expect(headline().classList.contains('lobby-headline--shout')).toBe(true);
    const run = container.querySelector('bdi.lobby-run');
    const before = piecesOf(container);
    const inRun = [...run.querySelectorAll('.lobby-word')];
    expect(inRun.map((w) => w.textContent)).toEqual(['שבת', 'שלום']);
    // The quotes are drawn outside the run, each on its own word's beat.
    const marks = [...container.querySelectorAll('.lobby-punct')];
    expect(marks.map((m) => m.textContent)).toEqual(['"', '"']);
    expect(landsAt(marks[0])).toBe(landsAt(inRun[0]));
    expect(landsAt(marks[1])).toBe(landsAt(inRun[1]));

    fonts.real = true;
    act(() => {
      fonts.loads += 1;
      for (const cb of fonts.listeners) cb();
    });
    expect(headline().classList.contains('lobby-headline--read')).toBe(true);
    expect(container.querySelector('bdi.lobby-run')).toBe(run);
    expect([...run.querySelectorAll('.lobby-word')]).toEqual(inRun);
    expect([...container.querySelectorAll('.lobby-punct')]).toEqual(marks);
    for (const m of marks) expect(rec(m).history).toHaveLength(1);
    const after = piecesOf(container);
    expect(after).toHaveLength(before.length);
    after.forEach((el, i) => {
      expect(el).toBe(before[i]);
      expect(rec(el).history).toHaveLength(1);
    });
  });

  // What sits outside a run's <bdi> depends on the fit: a run-on list's
  // separator is there only once the operator's line breaks are joined, and a
  // word too wide for any line keeps its own punctuation. A refit across
  // either line must change what the run's edge slots hold, never which
  // elements there are: one mounted by the refit would land all over again.
  /**
   * Render, read the headline, let the fonts land, read it again; in between,
   * every element must be the one it was, on the target it had.
   */
  const acrossTheRefit = (frame, read) => {
    const { container } = render(<SlideCopy frame={frame} via="boot" />);
    const all = () => [...container.querySelectorAll('.lobby-kicker, .lobby-word, .lobby-punct, .lobby-sub, .lobby-chip, bdi')];
    const headline = () => container.querySelector('.lobby-headline');
    const before = all();
    const was = read(headline());
    fonts.real = true;
    act(() => {
      fonts.loads += 1;
      for (const cb of fonts.listeners) cb();
    });
    const after = all();
    expect(after.filter((el) => !before.includes(el)).map((el) => el.outerHTML), 'mounted by the refit').toEqual([]);
    expect(before.filter((el) => !after.includes(el)).map((el) => el.outerHTML), 'unmounted by the refit').toEqual([]);
    after.forEach((el, i) => {
      expect(el).toBe(before[i]);
      if (el.tagName !== 'BDI') expect(rec(el).history).toHaveLength(1);
    });
    const now = read(headline());
    cleanup();
    return [was, now];
  };
  /** The headline's text, what each edge slot of its one run holds, and the word it cut, if any. */
  const readRun = (h) => {
    const run = h.querySelector('bdi.lobby-run');
    const slot = (el) => (el?.className === 'lobby-punct' ? el.textContent : null);
    return {
      text: h.textContent,
      run: run.textContent,
      slots: [slot(run.previousElementSibling), slot(run.nextElementSibling)],
      cut: h.querySelector('.lobby-word--wide')?.textContent ?? null,
    };
  };

  it('a list that runs on (or stops running on) at the refit only fills (or empties) a run\'s edge slot', () => {
    const names = ['Ava', 'Ben', 'שרה כהן', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lu', 'Max', 'Ned'];
    const frame = { kicker: 'Thank you to all our amazing leaders', headline: names.join('\n'), sub: '', chip: null, textSize: 'auto' };
    const kept = { text: names.join(' '), run: 'שרה כהן', slots: ['', ''], cut: null };
    const joined = { text: names.join(`${READ.joiner} `), run: 'שרה כהן', slots: ['', READ.joiner.trim()], cut: null };
    // Londrina lands wider: the kicker then crowds the corners, and the names
    // lose the room to keep their breaks at 1.5u. Or narrower, and they win it.
    fonts.faces = { Londrina: [0.46, 0.62] };
    expect(acrossTheRefit(frame, readRun)).toEqual([kept, joined]);
    fonts.real = false;
    fonts.faces = { Londrina: [0.62, 0.46] };
    expect(acrossTheRefit(frame, readRun)).toEqual([joined, kept]);
  });

  it('a long word drawn whole (or cut) at the refit only moves its punctuation into (or out of) its run\'s edge slot', () => {
    const url = 'https://kvbc.example.org/awana/fall-2026/register?ref=lobbytv';
    const headline = `הירשמו עכשיו: Sign up at ${url}.`;
    const frame = { kicker: '', headline, sub: '', chip: null, textSize: 'auto' };
    const cut = { text: headline, run: `Sign up at ${url}.`, slots: ['', ''], cut: `${url}.` };
    const whole = { text: headline, run: `Sign up at ${url}`, slots: ['', '.'], cut: null };
    // Figtree lands narrower: the URL now fits whole at a readable size. Or
    // wider, and it is cut across rows of its own, keeping its full stop.
    fonts.faces = { Figtree: [0.55, 0.45] };
    expect(acrossTheRefit(frame, readRun)).toEqual([cut, whole]);
    fonts.real = false;
    fonts.faces = { Figtree: [0.45, 0.55] };
    expect(acrossTheRefit(frame, readRun)).toEqual([whole, cut]);
  });
});
