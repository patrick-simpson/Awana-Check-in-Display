import { describe, it, expect } from 'vitest';
import { DUR } from './brand.js';
import {
  HANDOFF, STINGER_SEC, SWAP_AT,
  copyBeats, entranceHold, exitDelay, firstTransition, holdThenLand, holdThenLeave,
  nextTransition, swellKeyframes, vanishAtSwap,
} from './lobbyMotion.js';

const showing = (key, over = {}) => ({ key, special: false, kind: 'copy', theme: 'sky', ...over });

describe('the hand-off, as numbers', () => {
  it('rides the brand rhythm: the kit\'s own exit, settle and pop, the rest in beats', () => {
    expect(HANDOFF.exit).toBe(DUR.exit);
    expect(HANDOFF.word).toBe(DUR.settle);
    expect(HANDOFF.chip).toBe(DUR.pop);
    for (const v of Object.values(HANDOFF)) expect(Math.round(v * 1000) % 10).toBe(0);
  });

  it('the stinger swaps the slides at mid-cover', () => {
    expect(SWAP_AT).toBeCloseTo(STINGER_SEC / 2);
  });

  it('the outgoing copy is gone before the incoming copy lands, however long it was', () => {
    for (const n of [1, 3, 6, 12, 40]) {
      const lastStarts = exitDelay(n - 1, n);
      expect(lastStarts).toBeLessThanOrEqual(HANDOFF.exitSpread + 1e-9);
      expect(lastStarts + HANDOFF.exit).toBeLessThanOrEqual(HANDOFF.hold);
    }
    expect(exitDelay(0, 5)).toBe(0);
    expect(exitDelay(1, 5)).toBeCloseTo(HANDOFF.exitStagger);
  });

  it('holds each arrival for its own reason', () => {
    expect(entranceHold('handoff')).toBe(HANDOFF.hold);
    expect(entranceHold('wipe')).toBe(STINGER_SEC);
    expect(entranceHold('reveal')).toBe(HANDOFF.reveal);
    expect(entranceHold('boot')).toBe(HANDOFF.boot);
  });
});

describe('hold, then land', () => {
  it('is one keyframe list that sits still, then moves, and ends at rest', () => {
    const { initial, animate, transition } = holdThenLand(0.5, 0.52, { opacity: 0, y: '0.45em' }, { opacity: 1, y: '0em' }, 'linear');
    expect(initial).toEqual({ opacity: 0, y: '0.45em' });
    expect(animate).toEqual({ opacity: [0, 0, 1], y: ['0.45em', '0.45em', '0em'] });
    expect(transition.duration).toBeCloseTo(1.02);
    expect(transition.times[1]).toBeCloseTo(0.5 / 1.02);
    // No delay anywhere: framer-motion runs opacity on the browser's own
    // timeline, where a delayed opacity paints its target before its beat.
    expect(transition).not.toHaveProperty('delay');
  });

  it('with no hold, is a plain two-keyframe move', () => {
    expect(holdThenLand(0, 0.3, { opacity: 0 }, { opacity: 1 }, 'linear').animate).toEqual({ opacity: [0, 1] });
  });

  it('a value only in `to` simply holds there', () => {
    expect(holdThenLand(0.2, 0.3, {}, { scale: 1 }, 'linear').animate.scale).toEqual([1, 1, 1]);
  });

  it('leaving under the stinger waits for the cover, then goes', () => {
    const exit = vanishAtSwap({ opacity: 1 }, { opacity: 0 });
    expect(exit.opacity).toEqual([1, 1, 0]);
    expect(exit.transition.duration * exit.transition.times[1]).toBeCloseTo(SWAP_AT);
    expect(holdThenLeave(0.1, 0.28, { opacity: 1 }, { opacity: 0 }, 'linear').opacity.at(-1)).toBe(0);
  });

  it('the swell starts late, crests and comes home', () => {
    const { animate, transition } = swellKeyframes('-16%');
    expect(animate.y).toEqual(['0%', '0%', '-16%', '0%']);
    expect(transition.times[1]).toBeCloseTo(HANDOFF.swellAt / (HANDOFF.swellAt + HANDOFF.swell));
  });
});

describe('copyBeats', () => {
  const fit = (over = {}) => ({ kicker: { text: 'This week' }, headline: { mode: 'shout', lines: [['Bring', 'your'], ['handbook']] }, sub: null, chip: { label: 'WED' }, ...over });

  it('lands the kicker, then each word in order, then the chip', () => {
    const b = copyBeats(fit(), 0.5);
    const words = b.lines.flatMap((l) => l.words);
    expect(b.kicker.at).toBe(0.5);
    expect(words.map((w) => w.text)).toEqual(['Bring', 'your', 'handbook']);
    for (let i = 1; i < words.length; i += 1) expect(words[i].at).toBeGreaterThan(words[i - 1].at);
    expect(b.chip.at).toBeGreaterThan(words.at(-1).at);
    expect(b.pieces).toBe(5);
    expect([b.kicker.index, ...words.map((w) => w.index), b.chip.index]).toEqual([0, 1, 2, 3, 4]);
  });

  it('nothing lands before the hold is over', () => {
    const b = copyBeats(fit({ sub: { lines: ['x'] } }), 1.2);
    const all = [b.kicker, ...b.lines.flatMap((l) => l.words), b.sub, b.chip];
    for (const beat of all) expect(beat.at).toBeGreaterThanOrEqual(1.2);
    expect(b.chip.at).toBeGreaterThan(b.sub.at);
  });

  it('a read-layout headline lands line by line', () => {
    const b = copyBeats(fit({ kicker: null, chip: null, headline: { mode: 'read', lines: [['a', 'b'], ['c']] } }), 0);
    expect(b.lines.map((l) => l.index)).toEqual([0, 1]);
    expect(b.lines.every((l) => l.words.length === 0)).toBe(true);
    expect(b.pieces).toBe(2);
  });
});

describe('nextTransition', () => {
  it('an ordinary slide after an ordinary slide hands off, and swells the house wave once', () => {
    const a = firstTransition(showing('0:a'));
    expect(a).toMatchObject({ via: 'boot', wipe: false, wipes: 0, swells: 0 });
    const b = nextTransition(a, showing('1:b'));
    expect(b).toMatchObject({ via: 'handoff', wipe: false, wipes: 0, swells: 1 });
    expect(nextTransition(b, showing('1:b'))).toBe(b);
  });

  it('a held slide on either side wipes, and never swells', () => {
    const a = firstTransition(showing('0:a'));
    const held = nextTransition(a, showing('1:h', { special: true }));
    expect(held).toMatchObject({ via: 'wipe', wipe: true, wipes: 1, swells: 0 });
    const back = nextTransition(held, showing('2:a'));
    expect(back).toMatchObject({ via: 'wipe', wipe: true, wipes: 2, swells: 0 });
  });

  it('after a video the next words reveal; the field keeps its theme under the video', () => {
    const a = firstTransition(showing('0:a', { theme: 'night' }));
    const video = nextTransition(a, showing('1:v', { kind: 'video', theme: 'sunset' }));
    expect(video).toMatchObject({ via: 'handoff', theme: 'night', swells: 0 });
    const next = nextTransition(video, showing('2:b', { theme: 'meadow' }));
    expect(next).toMatchObject({ via: 'reveal', theme: 'meadow', swells: 0 });
  });

  it('an edit to the slide on screen takes the new facts and plays nothing', () => {
    const a = firstTransition(showing('0:a'));
    const edited = nextTransition(a, showing('0:a', { theme: 'night', special: true }));
    expect(edited).toMatchObject({ key: '0:a', theme: 'night', special: true, via: 'boot', wipes: 0, swells: 0 });
  });
});
