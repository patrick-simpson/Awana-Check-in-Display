import { describe, expect, it } from 'vitest';
import {
  BEAD_ORDER, BEAD_TONES, BRACELET_ROW, EPIC_BEATS, EPIC_SEC, IDENTITY_CAMERA, LOOP_SEC, STAGE_H, STAGE_W, STEP_COUNT,
  actionSec, currentEpicStep, epicShot, finaleScene, introScene, sceneFor, sceneOf, stepProgress,
} from './braceletArt.js';
import { BRACELET_STEPS, EPIC_SEC as CADENCE_EPIC_SEC, STEP_SEC } from './bracelets.js';
// Tests may reach across the isolation rule to pin two copies of one thing.
import { BEADS } from '../../components/promos/BraceletsPromo.jsx';

const STEPS = Array.from({ length: 13 }, (_, i) => i);
const BLEED = 160; // things entering may start a little off stage

/** Every number in an item, with the ones that are stage coordinates marked. */
function coordinates(item) {
  const out = [];
  if ('x' in item) out.push([item.x, item.y]);
  if (item.pts) out.push(...item.pts);
  return out;
}

function numbersOf(value, out = []) {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbersOf(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numbersOf(v, out));
  return out;
}

function expectSane(items, { strict, label }) {
  expect(items.length, label).toBeGreaterThan(0);
  for (const item of items) {
    expect(typeof item.kind, label).toBe('string');
    for (const n of numbersOf(item)) expect(Number.isFinite(n), `${label}: ${JSON.stringify(item)}`).toBe(true);
    const pad = strict ? 0 : BLEED;
    for (const [x, y] of coordinates(item)) {
      expect(x, `${label} ${item.kind} x`).toBeGreaterThanOrEqual(-pad);
      expect(x, `${label} ${item.kind} x`).toBeLessThanOrEqual(STAGE_W + pad);
      expect(y, `${label} ${item.kind} y`).toBeGreaterThanOrEqual(-pad);
      expect(y, `${label} ${item.kind} y`).toBeLessThanOrEqual(STAGE_H + pad);
    }
  }
}

const beadsOf = (items) => items.filter((i) => i.kind === 'bead');
const leftToRight = (items) => [...items].sort((a, b) => a.x - b.x);

describe('the stage and the palette', () => {
  it('is the 1460x560 stage the view lays out', () => {
    expect([STAGE_W, STAGE_H]).toEqual([1460, 560]);
    expect(IDENTITY_CAMERA).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('paints the beads in the lobby poster\'s exact colours, in its order', () => {
    const keys = ['black', 'red', 'white', 'blue', 'green', 'yellow'];
    expect(BEADS.map((b) => b.key)).toEqual(['sin', 'blood', 'purity', 'baptism', 'growth', 'heaven']);
    keys.forEach((k, i) => {
      const { tone, light, dark } = BEADS[i];
      expect(BEAD_TONES[k], k).toEqual({ tone, light, dark });
    });
    expect(BEAD_ORDER).toEqual(keys);
  });

  it('has a clear bead: a breath of ice blue, a white keyline', () => {
    expect(BEAD_TONES.clear.tone).toBe('rgba(214, 236, 255, 0.18)');
    expect(BEAD_TONES.clear.light).toBe('rgba(255, 255, 255, 0.9)');
    expect(BRACELET_ROW).toEqual(['clear', 'black', 'red', 'white', 'blue', 'green', 'yellow', 'clear']);
  });

  it('draws one picture per handout step, on the cadence\'s clock', () => {
    expect(STEP_COUNT).toBe(BRACELET_STEPS.length);
    expect(LOOP_SEC).toBe(STEP_SEC);
    expect(EPIC_SEC).toBe(CADENCE_EPIC_SEC);
  });
});

describe('stepProgress', () => {
  it('is 0 at the start and 1 from the end of the action on, for every step', () => {
    for (const i of STEPS) {
      expect(stepProgress(i, 0)).toBe(0);
      expect(stepProgress(i, -3)).toBe(0);
      expect(stepProgress(i, Number.NaN)).toBe(0);
      expect(stepProgress(i, actionSec(i))).toBe(1);
      expect(stepProgress(i, LOOP_SEC - 0.01)).toBe(1);
      expect(stepProgress(i, 999)).toBe(1);
    }
  });

  it('plays over roughly the first 6 to 7 seconds of the 10, never backwards', () => {
    for (const i of STEPS) {
      expect(actionSec(i)).toBeGreaterThanOrEqual(6);
      expect(actionSec(i)).toBeLessThanOrEqual(7);
      let last = 0;
      for (let t = 0; t <= LOOP_SEC; t += 0.05) {
        const p = stepProgress(i, t);
        expect(p).toBeGreaterThanOrEqual(last);
        expect(p).toBeLessThanOrEqual(1);
        last = p;
      }
      expect(stepProgress(i, actionSec(i) / 2)).toBeGreaterThan(0.3);
      expect(stepProgress(i, actionSec(i) / 2)).toBeLessThan(0.7);
    }
  });
});

describe('sceneFor', () => {
  it('gives every step a picture of finite numbers on the stage, at every point of its action', () => {
    for (const i of STEPS) {
      for (let p = 0; p <= 1.0001; p += 0.05) {
        expectSane(sceneFor(i, p), { strict: false, label: `step ${i + 1} p=${p.toFixed(2)}` });
      }
      for (const p of [0, 0.5, 1]) expectSane(sceneFor(i, p), { strict: p === 1, label: `step ${i + 1} p=${p}` });
    }
  });

  it('is deterministic: the same step and p is the same picture', () => {
    for (const i of STEPS) {
      for (const p of [0, 0.37, 0.81, 1]) expect(sceneFor(i, p)).toEqual(sceneFor(i, p));
    }
  });

  it('rests on a clean finished picture: no bursts, no guide arrows', () => {
    for (const i of STEPS) {
      const kinds = sceneFor(i, 1).map((it) => it.kind);
      expect(kinds, `step ${i + 1}`).not.toContain('burst');
      expect(kinds, `step ${i + 1}`).not.toContain('arrow');
    }
  });

  it('treats a missing p as the finished picture and clamps the step', () => {
    expect(sceneFor(3, Number.NaN)).toEqual(sceneFor(3, 1));
    expect(sceneFor(-4, 0.5)).toEqual(sceneFor(0, 0.5));
    expect(sceneFor(40, 0.5)).toEqual(sceneFor(12, 0.5));
  });

  it('stacks the beads black, red, white, blue, green, yellow, one per step', () => {
    for (let k = 0; k < 6; k += 1) {
      const beads = leftToRight(beadsOf(sceneFor(k, 1)));
      expect(beads.map((b) => b.color), `step ${k + 1}`).toEqual(BEAD_ORDER.slice(0, k + 1));
      // Side by side on the cord, one slot apart.
      beads.slice(1).forEach((b, j) => expect(b.x - beads[j].x).toBeCloseTo(78, 0));
      expect(new Set(beads.map((b) => b.y)).size).toBe(1);
    }
  });

  it('adds a bead that arrives from off the cord and slides along to its place', () => {
    const start = beadsOf(sceneFor(2, 0)).find((b) => b.color === 'white');
    const mid = beadsOf(sceneFor(2, 0.6)).find((b) => b.color === 'white');
    const end = beadsOf(sceneFor(2, 1)).find((b) => b.color === 'white');
    expect(start.x).toBeGreaterThan(mid.x);
    expect(mid.x).toBeGreaterThan(end.x);
  });

  it('finishes the row with a clear bead each side and a knot beside each', () => {
    const items = sceneFor(6, 1);
    expect(leftToRight(beadsOf(items)).map((b) => b.color)).toEqual(BRACELET_ROW);
    const knots = leftToRight(items.filter((i) => i.kind === 'knot'));
    const beads = leftToRight(beadsOf(items));
    expect(knots).toHaveLength(2);
    expect(knots[0].x).toBeLessThan(beads[0].x);
    expect(knots[1].x).toBeGreaterThan(beads.at(-1).x);
  });

  it('keeps the finished row in its order through every knot step', () => {
    for (const i of [7, 8, 9, 10, 11, 12]) {
      for (const p of [0, 0.5, 1]) {
        expect(leftToRight(beadsOf(sceneFor(i, p))).map((b) => b.color), `step ${i + 1} p=${p}`).toEqual(BRACELET_ROW);
      }
    }
  });

  it('counts the three wraps one, two, three, left to right', () => {
    const early = sceneFor(8, 0.2).filter((i) => i.kind === 'badge');
    const done = leftToRight(sceneFor(8, 1).filter((i) => i.kind === 'badge'));
    expect(early.length).toBeLessThan(3);
    expect(done.map((b) => b.text)).toEqual(['1', '2', '3']);
    expect(done.every((b) => b.s === 1 && b.o === 1)).toBe(true);
  });

  it('lights the X in gold on step 10', () => {
    expect(sceneFor(9, 0).some((i) => i.kind === 'cord' && i.tone === 'gold')).toBe(false);
    expect(sceneFor(9, 1).filter((i) => i.kind === 'cord' && i.tone === 'gold')).toHaveLength(2);
  });

  it('takes the finger out of the wraps on step 11', () => {
    const finger = (items) => items.find((i) => i.kind === 'glove' && i.pose === 'point');
    const a = finger(sceneFor(10, 0));
    const b = finger(sceneFor(10, 1));
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(300);
    expect(finger(sceneFor(11, 0.5))).toBeUndefined();
  });

  it('pulls tight on step 13: both hands pull apart, a pop', () => {
    const hands = (items) => leftToRight(items.filter((i) => i.kind === 'glove'));
    const [l0, r0] = hands(sceneFor(12, 0.2));
    const [l1, r1] = hands(sceneFor(12, 1));
    expect(r1.x - l1.x).toBeGreaterThan(r0.x - l0.x);
    expect(hands(sceneFor(12, 1)).map((g) => g.pose)).toEqual(['pull', 'pull']);
    expect(sceneFor(12, 0.75).some((i) => i.kind === 'ring')).toBe(true);
  });
});

describe('the intro and the finale', () => {
  it('opens on the cord, the bead pots and the title', () => {
    const items = introScene(1);
    expectSane(items, { strict: true, label: 'intro' });
    expect(items.filter((i) => i.kind === 'pot').map((i) => i.color)).toEqual([...BEAD_ORDER, 'clear']);
    expect(items.find((i) => i.kind === 'text').text).toBe('BRACELET TIME!');
  });

  it('ends on the finished bracelet held up, and YOUR TURN!', () => {
    const items = finaleScene(1);
    expectSane(items, { strict: true, label: 'finale' });
    expect(items.filter((i) => i.kind === 'bead')).toHaveLength(8);
    expect(items.filter((i) => i.kind === 'text').map((i) => i.text)).toEqual(['YOUR', 'TURN!']);
    for (let p = 0; p <= 1.0001; p += 0.05) {
      expectSane(introScene(p).length ? introScene(p) : [{ kind: 'none' }], { strict: false, label: `intro ${p}` });
      expectSane(finaleScene(p), { strict: false, label: `finale ${p}` });
    }
  });

  it('routes the intro, the finale and the steps through sceneOf', () => {
    expect(sceneOf('intro', 0.5)).toEqual(introScene(0.5));
    expect(sceneOf('finale', 0.5)).toEqual(finaleScene(0.5));
    expect(sceneOf(4, 0.5)).toEqual(sceneFor(4, 0.5));
  });
});

describe('the epic', () => {
  it('covers 0 to 90 s exactly, with no gaps: an intro, all 13 steps in order, a finale', () => {
    expect(EPIC_BEATS[0]).toMatchObject({ kind: 'intro', start: 0 });
    expect(EPIC_BEATS.at(-1)).toMatchObject({ kind: 'finale', end: EPIC_SEC });
    EPIC_BEATS.slice(1).forEach((b, i) => expect(b.start).toBe(EPIC_BEATS[i].end));
    const steps = EPIC_BEATS.filter((b) => b.kind === 'step');
    expect(steps.map((b) => b.step)).toEqual(STEPS);
    expect(EPIC_BEATS).toHaveLength(15);
  });

  it('gives each beat a child\'s pace: ~4 s intro, ~6 s steps (knots a little more), ~6 s finale', () => {
    const len = (b) => b.end - b.start;
    expect(len(EPIC_BEATS[0])).toBeCloseTo(4, 5);
    expect(len(EPIC_BEATS.at(-1))).toBeCloseTo(6, 5);
    const steps = EPIC_BEATS.filter((b) => b.kind === 'step');
    for (const b of steps) {
      expect(len(b)).toBeGreaterThanOrEqual(5);
      expect(len(b)).toBeLessThanOrEqual(7.5);
    }
    expect(len(steps[9])).toBeGreaterThan(len(steps[0]));
  });

  it('is well defined every quarter second: finite, on the stage, the camera never shows past its edge', () => {
    let lastBeat = -1;
    for (let t = 0; t <= EPIC_SEC; t += 0.25) {
      const shot = epicShot(t);
      expect(shot.p).toBeGreaterThanOrEqual(0);
      expect(shot.p).toBeLessThanOrEqual(1);
      const { x, y, scale } = shot.camera;
      for (const n of [x, y, scale]) expect(Number.isFinite(n)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(0.05);
      expect(y).toBeLessThanOrEqual(0.05);
      expect(x + STAGE_W * scale).toBeGreaterThanOrEqual(STAGE_W - 0.05);
      expect(y + STAGE_H * scale).toBeGreaterThanOrEqual(STAGE_H - 0.05);
      const i = EPIC_BEATS.indexOf(shot.beat);
      expect(i).toBeGreaterThanOrEqual(lastBeat);
      lastBeat = i;
      const which = shot.step ?? shot.beat.kind;
      const items = sceneOf(which, shot.p);
      for (const it of items) for (const n of numbersOf(it)) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('eases the camera: no jump bigger than a gentle move between quarter seconds, except at a cut', () => {
    const cuts = new Set([EPIC_BEATS[9].start, EPIC_BEATS[14].start]);
    for (let t = 0.25; t <= EPIC_SEC; t += 0.25) {
      const a = epicShot(t - 0.25).camera;
      const b = epicShot(t).camera;
      const crossesCut = [...cuts].some((c) => c > t - 0.25 && c <= t);
      if (crossesCut) continue;
      expect(Math.abs(b.scale - a.scale), `t=${t}`).toBeLessThan(0.06);
      expect(Math.hypot(b.x - a.x, b.y - a.y), `t=${t}`).toBeLessThan(90);
    }
  });

  it('plays each step through to its finished picture before the beat ends', () => {
    for (const b of EPIC_BEATS) {
      const shot = epicShot(b.end - 0.3);
      expect(shot.beat).toBe(b);
      expect(shot.p, `${b.kind} ${b.step ?? ''}`).toBe(1);
      if (b.kind === 'step') expect(epicShot(b.start + 0.01).p).toBeLessThan(0.05);
    }
  });

  it('rests on the finale at and past 90 s', () => {
    for (const t of [EPIC_SEC, EPIC_SEC + 5, 1e9]) {
      const shot = epicShot(t);
      expect(shot.beat.kind).toBe('finale');
      expect(shot.step).toBeNull();
      expect(shot.p).toBe(1);
    }
    expect(epicShot(Number.NaN).beat.kind).toBe('intro');
  });

  it('names the step on screen for the caption, null for the intro and the finale', () => {
    expect(currentEpicStep(1)).toBeNull();
    expect(currentEpicStep(EPIC_SEC - 1)).toBeNull();
    for (const b of EPIC_BEATS.filter((x) => x.kind === 'step')) {
      expect(currentEpicStep((b.start + b.end) / 2)).toBe(b.step);
    }
  });
});
