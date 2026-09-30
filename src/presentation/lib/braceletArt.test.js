import { describe, expect, it } from 'vitest';
import {
  BEAD_ORDER, BEAD_TONES, BRACELET_ROW, EPIC_BEATS, EPIC_SEC, IDENTITY_CAMERA, SAFE_BOX, STAGE_H, STAGE_W, STEP_COUNT,
  KNOT1_X, actionSec, boxInside, boxOffStage, currentEpicStep, epicShot, finaleScene, glovePoints, introScene, itemBox, sceneFor, sceneOf, stepFrame, stepProgress, stillFrame, stillP,
} from './braceletArt.js';
import { BRACELET_STEPS, EPIC_SEC as CADENCE_EPIC_SEC, stepSlotSec } from './bracelets.js';
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
  const bad = [];
  const pad = strict ? 0 : BLEED;
  for (const item of items) {
    if (typeof item.kind !== 'string') bad.push(`${label}: no kind`);
    if (!numbersOf(item).every(Number.isFinite)) bad.push(`${label}: ${JSON.stringify(item)}`);
    for (const [x, y] of coordinates(item)) {
      if (x < -pad || x > STAGE_W + pad || y < -pad || y > STAGE_H + pad) bad.push(`${label} ${item.kind} at ${x},${y}`);
    }
  }
  expect(bad).toEqual([]);
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

  it('has a clear bead that reads as clear from the back of the room: light and icy, never a grey bead', () => {
    const alpha = (c) => Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(c)[1]);
    expect(BEAD_TONES.clear.tone).toBe('rgba(200, 232, 255, 0.5)');
    expect(alpha(BEAD_TONES.clear.tone)).toBeGreaterThanOrEqual(0.4);
    expect(alpha(BEAD_TONES.clear.dark)).toBeGreaterThanOrEqual(0.4);
    expect(BRACELET_ROW).toEqual(['clear', 'black', 'red', 'white', 'blue', 'green', 'yellow', 'clear']);
  });

  it('draws one picture per handout step, on the cadence\'s clock', () => {
    expect(STEP_COUNT).toBe(BRACELET_STEPS.length);
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
      expect(stepProgress(i, stepSlotSec(i) - 0.01)).toBe(1);
      expect(stepProgress(i, 999)).toBe(1);
    }
  });

  it('plays at a child\'s pace, then holds the finished picture at least 3 s of its slot, never backwards', () => {
    for (const i of STEPS) {
      expect(actionSec(i)).toBeGreaterThanOrEqual(6);
      expect(actionSec(i)).toBeLessThanOrEqual(stepSlotSec(i) - 3);
      let last = 0;
      for (let t = 0; t <= stepSlotSec(i); t += 0.05) {
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
  }, 30_000);

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

  it('shows each move\'s guide arrow in its still, and nothing half there: no fading hand, arrow or pop', () => {
    for (const i of STEPS) {
      const items = sceneFor(i, stillP(i));
      const label = `step ${i + 1} still`;
      expect(items.filter((it) => 'o' in it && it.o < 1).map((it) => it.kind), label).toEqual([]);
      expect(items.some((it) => it.kind === 'glove' && it.id.endsWith('~')), label).toBe(false);
      expect(items.map((it) => it.kind), label).not.toContain('burst');
    }
    // Knot 1, knot 4 and knot 5 are moves: their stills carry the arrow.
    for (const i of [7, 10, 11]) expect(sceneFor(i, stillP(i)).some((it) => it.kind === 'arrow'), `step ${i + 1}`).toBe(true);
    expect(STEPS.filter((i) => stillP(i) < 1)).toEqual([7, 10, 11]);
    // Knot 1's still shows the X made, the two fists apart, the arrow at full strength.
    const k1 = sceneFor(7, stillP(7));
    expect(k1.find((it) => it.kind === 'arrow').o).toBe(1);
    const [a, b] = k1.filter((it) => it.kind === 'glove').map(itemBox);
    expect(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0).toBe(true);
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
    const start = beadsOf(sceneFor(2, 0.15)).find((b) => b.color === 'white');
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
    // (the short gold rim on the top string's end is not the X)
    const xGold = (items) => items.filter((i) => i.kind === 'cord' && i.tone === 'gold' && Math.hypot(i.pts.at(-1)[0] - i.pts[0][0], i.pts.at(-1)[1] - i.pts[0][1]) > 30);
    expect(xGold(sceneFor(9, 0))).toHaveLength(0);
    expect(xGold(sceneFor(9, 1))).toHaveLength(2);
  });

  it('lights each landing from behind the whole row: its pop is drawn before the cord, the fist and the beads', () => {
    for (const i of [0, 1, 2, 3, 4, 5, 6]) {
      for (let p = 0; p <= 1; p += 0.005) {
        const items = sceneFor(i, p);
        const firstSolid = items.findIndex((it) => ['cord', 'bead', 'glove', 'knot'].includes(it.kind));
        const lastPop = items.findLastIndex((it) => it.kind === 'burst' || it.kind === 'sparkle');
        if (lastPop >= 0) expect(lastPop, `step ${i + 1} p=${p.toFixed(3)}`).toBeLessThan(firstSolid);
      }
    }
  });

  it('keeps knot 2\'s counters clear of the resting hand, and no stray gold at the pinch while the end is held', () => {
    const k2 = sceneFor(8, 1);
    const hand = itemBox(k2.find((it) => it.kind === 'glove' && it.id === 'right'));
    for (const b of k2.filter((it) => it.kind === 'badge').map(itemBox)) {
      expect(b.x1 < hand.x0 - 6 || b.x0 > hand.x1 + 6 || b.y1 < hand.y0 - 6 || b.y0 > hand.y1 + 6, JSON.stringify({ b, hand })).toBe(true);
    }
    // (the end's gold rim, a short gold cord; the X's gold is longer)
    const rim = (items) => items.filter((i) => i.kind === 'cord' && i.tone === 'gold' && Math.hypot(i.pts.at(-1)[0] - i.pts[0][0], i.pts.at(-1)[1] - i.pts[0][1]) <= 30);
    for (const [i, p] of [[8, 1], [9, 0], [9, 1], [10, 0], [10, stillP(10)], [10, 1], [11, 0]]) expect(rim(sceneFor(i, p)), `step ${i + 1} p=${p}`).toEqual([]);
    // It comes back as the end leaves the fingers to be threaded.
    expect(rim(sceneFor(11, 0.12))).toHaveLength(1);
  });

  it('never draws a finale sparkle on the hand or the words', () => {
    const meets = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    for (let q = 0; q <= 1; q += 0.01) {
      const items = finaleScene(q);
      items.forEach((it, j) => {
        if (it.kind !== 'sparkle') return;
        const over = items.slice(0, j).filter((o) => (o.kind === 'glove' || o.kind === 'text') && meets(itemBox(o), itemBox(it)));
        expect(over.map((o) => o.kind), `q=${q.toFixed(2)} sparkle at ${it.x},${it.y}`).toEqual([]);
      });
    }
  });

  it('never rings the X on step 10, even in passing: a circled X reads as "no"', () => {
    for (let p = 0; p <= 1; p += 0.005) expect(sceneFor(9, p).filter((i) => i.kind === 'ring'), `p=${p.toFixed(3)}`).toEqual([]);
  });

  it('draws the knot for the child\'s own hands: the left pointer out to the right, the black side rising on the left', () => {
    const items = sceneFor(8, 1);
    const finger = items.find((i) => i.kind === 'glove' && i.id === 'finger');
    const right = items.find((i) => i.kind === 'glove' && i.id === 'right');
    expect(finger.flip).toBe(true); // a left glove
    expect(right.flip).toBe(false);
    expect(finger.pose).toBe('point');
    // The finger points right, from its hand on the left: its box ends where the glove's anchor (the tip) is.
    expect(itemBox(finger).x1).toBeLessThan(finger.x + 40);
    expect(itemBox(finger).x0).toBeLessThan(finger.x - 300);
    // The bracelet reads clear, black ... yellow, clear from left to right,
    // so the black side is the one that rises on the left, to the X.
    expect(leftToRight(beadsOf(items)).map((b) => b.color)).toEqual(BRACELET_ROW);
  });

  it('pinches the loops with the left thumb and middle finger, then slides the pointer out, on step 11', () => {
    const finger = (items) => items.find((i) => i.kind === 'glove' && i.id === 'finger');
    const grip = (items) => items.find((i) => i.kind === 'glove' && i.id === 'finger^');
    expect(finger(sceneFor(10, 0))).toMatchObject({ ext: 1, grip: 0 });
    expect(grip(sceneFor(10, 0))).toBeUndefined();
    expect(finger(sceneFor(10, 1))).toMatchObject({ ext: 0, grip: 1, layer: 'hand' });
    expect(grip(sceneFor(10, 1))).toMatchObject({ ext: 0, grip: 1, layer: 'grip' });
    // The pinching fingers are drawn over the loops they pinch.
    const items = sceneFor(10, 1);
    const lastWrap = items.findLastIndex((i) => i.kind === 'cord' && i.tone === 'front');
    expect(items.indexOf(grip(items))).toBeGreaterThan(items.indexOf(finger(items)));
    expect(lastWrap).toBeGreaterThan(0);
    // And the pointer stays out while the end goes through.
    expect(finger(sceneFor(11, 0.5))).toMatchObject({ ext: 0, grip: 1 });
  });

  it('has the right hand push the end through, then take it at the far side', () => {
    const right = (p) => sceneFor(11, p).find((i) => i.kind === 'glove' && i.id === 'right');
    const finger = sceneFor(11, 0.5).find((i) => i.kind === 'glove' && i.id === 'finger');
    // Pushing it in at the knuckle end of the loops, then out past the X.
    expect(right(0.4).x).toBeLessThan(760);
    expect(right(1).x).toBeGreaterThan(900);
    expect(right(1).x).toBeGreaterThan(finger.x);
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
  }, 30_000);

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

  it('spends its time where the hands have the most to do: the wraps and the push', () => {
    const len = (b) => b.end - b.start;
    expect(len(EPIC_BEATS[0])).toBeCloseTo(4, 5);
    expect(len(EPIC_BEATS.at(-1))).toBeCloseTo(6, 5);
    const steps = EPIC_BEATS.filter((b) => b.kind === 'step');
    for (const b of steps) {
      expect(len(b)).toBeGreaterThanOrEqual(4.5);
      expect(len(b)).toBeLessThanOrEqual(10);
    }
    // The wrap and the push get the most; the X, only a look, the least of the knots.
    const knots = steps.slice(7).map(len);
    expect(Math.max(...knots)).toBe(len(steps[11]));
    expect(len(steps[8])).toBeGreaterThan(len(steps[7]));
    expect(len(steps[9])).toBeLessThan(len(steps[8]));
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
  }, 30_000);

  it('eases the camera: no jump bigger than a gentle move between quarter seconds, except at a cut', () => {
    // The cuts are where the picture itself cuts to a new composition (the
    // bead table after the intro, the close-up after knot 1, the finale):
    // there the camera cuts too, so the change reads as an edit, not a pop.
    const cuts = new Set([EPIC_BEATS[1].start, EPIC_BEATS[9].start, EPIC_BEATS[14].start]);
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

// ── The safe area and the hands' motion ──────────────────────
// The wall fades the stage's outer edge (index.css .pj-bracelet__stage), so a
// resting hand, bead, knot, counter or arrow there seems to dissolve. And a
// hand never teleports or pops: it moves at a hand's speed, changes pose with
// its palm kept, and comes and goes only off the stage.

const MEASURED = new Set(['glove', 'bead', 'knot', 'badge', 'arrow', 'pot', 'text']);
const name = (it) => `${it.kind}${it.id ? `:${it.id}` : ''}${it.color ? `:${it.color}` : ''}${it.pose ? `:${it.pose}` : ''}`;

/** What leaves the safe box, as the wall shows it: through `camera` (the loop's framing). */
function unsafe(items, camera = IDENTITY_CAMERA) {
  const seen = (b) => b && ({ x0: b.x0 * camera.scale + camera.x, y0: b.y0 * camera.scale + camera.y, x1: b.x1 * camera.scale + camera.x, y1: b.y1 * camera.scale + camera.y });
  return items
    .filter((it) => MEASURED.has(it.kind) || (it.kind === 'sparkle' && it.o >= 0.99))
    .map((it) => ({ it, b: seen(itemBox(it)) }))
    .filter(({ b }) => b && !boxInside(b, SAFE_BOX) && !boxOffStage(b))
    .map(({ it, b }) => `${name(it)} [${Math.round(b.x0)},${Math.round(b.y0)} .. ${Math.round(b.x1)},${Math.round(b.y1)}]`);
}

describe('the safe area', () => {
  it('is the part of the stage the wall never fades', () => {
    expect(SAFE_BOX).toEqual({ x0: 70, y0: 60, x1: 1390, y1: 500 });
  });

  it('holds every hand, bead, knot, counter and arrow of each step\'s first frame and resting picture, framed as the loop frames it', () => {
    const bad = STEPS.flatMap((i) => [0, 1].flatMap((p) => unsafe(sceneFor(i, p), stepFrame(i, p)).map((u) => `step ${i + 1} p=${p}: ${u}`)));
    expect(bad).toEqual([]);
  });

  it('holds every still (the low-power and overview picture) too, framed', () => {
    const bad = STEPS.flatMap((i) => unsafe(sceneFor(i, stillP(i)), stillFrame(i)).map((u) => `step ${i + 1} still: ${u}`));
    expect(bad).toEqual([]);
  });

  it('frames the loop closer than the whole stage where the action allows, never past the stage\'s edge', () => {
    for (const i of STEPS) {
      for (const p of [0, 0.5, 1]) {
        const c = stepFrame(i, p);
        expect(c.scale, `step ${i + 1}`).toBeGreaterThanOrEqual(1);
        expect(c.x).toBeLessThanOrEqual(0);
        expect(c.y).toBeLessThanOrEqual(0);
        expect(c.x + STAGE_W * c.scale).toBeGreaterThanOrEqual(STAGE_W - 1e-6);
        expect(c.y + STAGE_H * c.scale).toBeGreaterThanOrEqual(STAGE_H - 1e-6);
      }
    }
    // The bead steps come in on the row and the new bead; the knot steps on the knot.
    expect(stepFrame(0, 1).scale).toBeGreaterThanOrEqual(1.25);
    // Step 7's still is as close as the bead steps' beside it in the overview.
    expect(stillFrame(6).scale).toBeGreaterThanOrEqual(stillFrame(5).scale);
    expect(stepFrame(6, 1).scale).toBe(1);
    for (const i of [8, 9, 10, 11]) expect(stepFrame(i, 1).scale).toBeGreaterThan(1.05);
  });

  it('holds the intro\'s and the finale\'s resting pictures too', () => {
    expect(unsafe(introScene(1))).toEqual([]);
    expect(unsafe(finaleScene(1))).toEqual([]);
  });

  it('measures a hand by the glove that is drawn, not by its anchor', () => {
    const g = sceneFor(0, 1).find((it) => it.kind === 'glove' && it.pose === 'point');
    const b = itemBox(g);
    expect(b.y1 - b.y0).toBeGreaterThan(150);
    expect(b.x0).toBeLessThan(g.x);
  });
});

// ── The epic's camera ────────────────────────────────────────

const epicAt = (t) => {
  const shot = epicShot(t);
  return { shot, items: sceneOf(shot.step ?? shot.beat.kind, shot.p) };
};
const onScreen = (c, [x, y]) => [x * c.scale + c.x, y * c.scale + c.y];
/** The first time (1/120 s steps) beat b's action reaches progress p. */
function whenBeatReaches(b, p) {
  const beat = EPIC_BEATS[b];
  for (let t = beat.start; t < beat.end; t += 1 / 120) if (epicShot(t).p >= p) return t;
  return beat.end;
}
/** Where the strands of a picture's cords cross each other. */
function crossings(items) {
  const cords = items.filter((it) => it.kind === 'cord');
  const out = [];
  for (let i = 0; i < cords.length; i += 1) {
    for (let j = i + 1; j < cords.length; j += 1) {
      const A = cords[i].pts;
      const B = cords[j].pts;
      for (let a = 0; a < A.length - 1; a += 1) {
        for (let b = 0; b < B.length - 1; b += 1) {
          const [p1, p2, p3, p4] = [A[a], A[a + 1], B[b], B[b + 1]];
          const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
          if (Math.abs(d) < 1e-9) continue;
          const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
          const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
          if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) out.push([p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]);
        }
      }
    }
  }
  return out;
}

describe('the epic\'s camera', () => {
  it('keeps every hand, bead, knot, counter and arrow inside the safe box whenever it rests (10 fps)', () => {
    const key = (it) => `${it.kind}:${it.id ?? ''}:${it.color ?? ''}`;
    const moved = (it, items) => Math.min(...items.filter((o) => key(o) === key(it)).map((o) => {
      const a = itemBox(it);
      const b = itemBox(o);
      return a && b ? Math.hypot(a.x0 - b.x0, a.y0 - b.y0) + Math.hypot(a.x1 - b.x1, a.y1 - b.y1) : Infinity;
    }), Infinity);
    const bad = [];
    for (let f = 0; f <= EPIC_SEC * 10; f += 1) {
      const t = f / 10;
      const { shot, items } = epicAt(t);
      const before = epicAt(Math.max(0, t - 0.2)).items;
      const after = epicAt(Math.min(EPIC_SEC, t + 0.2)).items;
      const resting = items.filter((it) => (it.o ?? 1) >= 0.05 && moved(it, before) < 3 && moved(it, after) < 3);
      bad.push(...unsafe(resting, shot.camera).map((u) => `t=${t.toFixed(1)}: ${u}`));
    }
    expect(bad).toEqual([]);
  }, 60_000);

  it('never cuts the bracelet hanging below the close-up', () => {
    const bad = [];
    for (let b = 9; b <= 13; b += 1) {
      for (let t = EPIC_BEATS[b].start; t < EPIC_BEATS[b].end; t += 0.1) {
        const { shot, items } = epicAt(t);
        bad.push(...unsafe(items.filter((it) => it.kind === 'bead'), shot.camera).map((u) => `t=${t.toFixed(1)}: ${u}`));
      }
    }
    expect(bad).toEqual([]);
  });

  it('match-cuts from knot 1 to knot 2 on the X: both X\'s on the same spot of the screen', () => {
    const cut = EPIC_BEATS[9].start;
    const x1 = crossings(sceneFor(7, 1));
    const x2 = crossings(sceneFor(8, 0));
    expect(x1).toHaveLength(1);
    expect(Math.hypot(x1[0][0] - KNOT1_X[0], x1[0][1] - KNOT1_X[1])).toBeLessThan(1);
    const before = epicShot(cut - 1 / 60).camera;
    const after = epicShot(cut).camera;
    const a = onScreen(before, x1[0]);
    const near = x2.map((x) => onScreen(after, x)).sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]))[0];
    expect(Math.hypot(near[0] - a[0], near[1] - a[1])).toBeLessThan(1.5);
    // It is a cut: the close-up comes in closer.
    expect(after.scale - before.scale).toBeGreaterThan(0.05);
  });

  it('pushes in on each bead as it lands, and pulls back to the row as the next one flies in', () => {
    for (let b = 1; b <= 6; b += 1) {
      const beat = EPIC_BEATS[b];
      expect(epicShot(whenBeatReaches(b, 0.84)).camera.scale, `bead ${b}`).toBeLessThan(1.16);
      expect(epicShot(beat.end - 0.05).camera.scale, `bead ${b}`).toBeGreaterThan(1.35);
      if (b > 1) expect(epicShot(beat.start + 1.8).camera.scale, `bead ${b}`).toBeLessThan(1.16);
    }
    // The intro cuts to the row: the table is a new picture.
    expect(epicShot(EPIC_BEATS[1].start).camera.scale - epicShot(EPIC_BEATS[1].start - 1 / 60).camera.scale).toBeGreaterThan(0.08);
  });

  it('jolts once as knot 6 bites, and is still again for its finished picture', () => {
    const bite = whenBeatReaches(13, 0.66);
    const xs = [];
    for (let t = bite - 0.1; t < bite + 0.7; t += 1 / 60) xs.push(epicShot(t).camera.x);
    let turns = 0;
    for (let i = 2; i < xs.length; i += 1) if (Math.sign(xs[i] - xs[i - 1]) * Math.sign(xs[i - 1] - xs[i - 2]) < 0) turns += 1;
    expect(turns).toBeGreaterThanOrEqual(2);
    const still = epicShot(bite + 0.8).camera;
    for (let t = bite + 0.8; t < EPIC_BEATS[13].end; t += 0.1) expect(epicShot(t).camera).toEqual(still);
  });
});

const FPS = 30;
const MAX_MOVE = 60; // px a hand's middle may travel between two frames
const MAX_TURN = 30; // degrees a hand may turn between two frames (same pose)
const GONE = 0.05; // a hand this faint is not on screen
const FADING = 0.35; // the most a hand may show on the frame it fades in or out of nothing
const MAX_FADE = 0.5; // how much a hand's opacity may change between two frames
const fold = (d) => ((((d % 360) + 540) % 360) - 180);
const middle = (g) => {
  const pts = glovePoints(g);
  return [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
};

/** Each hand in a frame by its name, measured once (a pose's fading ghost, "name~", is not the hand). */
function handsOf(items, label, bad) {
  const m = new Map();
  /** The hands whose old pose still shows as a ghost ("name~"): mid-dissolve. */
  m.ghosts = new Set(items.filter((it) => it.kind === 'glove' && it.id.endsWith('~') && it.o > GONE).map((it) => it.id.slice(0, -1)));
  for (const it of items) {
    // (a hand's second layer, "name^", is part of the same hand)
    if (it.kind !== 'glove' || it.id.endsWith('~') || it.id.includes('^')) continue;
    if (!it.id) bad.push(`${label}: a hand with no name`);
    if (m.has(it.id)) bad.push(`${label}: two hands called ${it.id}`);
    // A hand faded out (o at most GONE) is not on screen either, wherever it is.
    const offStage = boxOffStage(itemBox(it));
    m.set(it.id, { g: it, faint: it.o <= GONE, off: offStage || it.o <= GONE, mid: middle(it) });
  }
  return m;
}

/** Every teleport, pop or snap between consecutive frames. */
function hops(frames, label) {
  const bad = [];
  let a = frames.length ? handsOf(frames[0].items, label, bad) : new Map();
  for (let k = 1; k < frames.length; k += 1) {
    const b = handsOf(frames[k].items, label, bad);
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const ha = a.get(id);
      const hb = b.get(id);
      const at = `${label} ${frames[k].at} ${id}`;
      if (!ha || !hb) {
        if (!(ha ?? hb).off) bad.push(`${at} ${ha ? 'vanishes' : 'appears'} on stage`);
        continue;
      }
      if (ha.off && hb.off) continue;
      // A hand may fade out where it is and come back elsewhere, but only by
      // fading: never a pop from strong to nothing, or from nothing to strong.
      if (ha.faint !== hb.faint) {
        const shown = ha.faint ? hb : ha;
        if (!shown.off && shown.g.o > FADING) bad.push(`${at} ${ha.faint ? 'pops in' : 'pops out'} at o ${shown.g.o}`);
        continue;
      }
      if (Math.abs(hb.g.o - ha.g.o) > MAX_FADE) bad.push(`${at} blinks from o ${ha.g.o} to ${hb.g.o}`);
      const move = Math.hypot(hb.mid[0] - ha.mid[0], hb.mid[1] - ha.mid[1]);
      // Where a pose is cross-fading into another, both are on screen and the
      // eye sees a dissolve, so the hand's middle may move further then. (The
      // new pose lands whole over the old one, which fades out under it as its
      // ghost, so the hand's name can pass from one at full strength to the
      // other at full strength while the ghost still shows.)
      const dissolving = ha.g.pose !== hb.g.pose && (ha.g.o < 1 || hb.g.o < 1 || a.ghosts.has(id) || b.ghosts.has(id));
      if (move > (dissolving ? 2 * MAX_MOVE : MAX_MOVE)) bad.push(`${at} jumps ${Math.round(move)} px (${ha.g.pose} -> ${hb.g.pose})`);
      if (ha.g.pose !== hb.g.pose && !dissolving) bad.push(`${at} snaps from ${ha.g.pose} to ${hb.g.pose} in one frame`);
      if (ha.g.pose === hb.g.pose && Math.abs(fold(hb.g.rot - ha.g.rot)) > MAX_TURN) bad.push(`${at} turns ${Math.round(fold(hb.g.rot - ha.g.rot))} deg`);
      if (ha.g.flip !== hb.g.flip) bad.push(`${at} changes hands`);
    }
    a = b;
  }
  return bad;
}

describe('the hands move like hands', () => {
  it('never teleport, pop or snap in the one-step loop (30 fps)', () => {
    const bad = STEPS.flatMap((i) => {
      const frames = [];
      for (let f = 0; f <= stepSlotSec(i) * FPS; f += 1) frames.push({ at: `t=${(f / FPS).toFixed(2)}`, items: sceneFor(i, stepProgress(i, f / FPS)) });
      return hops(frames, `step ${i + 1}`);
    });
    expect(bad).toEqual([]);
  }, 60_000);

  it('never in the epic either, cutting only where the picture itself cuts', () => {
    // The bead table follows the intro's pots, the close-up opens on a new
    // picture (knot 2), and so does the finale: those three are cuts.
    const cuts = new Set([EPIC_BEATS[1].start, EPIC_BEATS[9].start, EPIC_BEATS[14].start]);
    let run = [];
    const bad = [];
    for (let f = 0; f <= EPIC_SEC * FPS; f += 1) {
      const t = f / FPS;
      const shot = epicShot(t);
      if ([...cuts].some((c) => c > t - 1 / FPS && c <= t)) {
        bad.push(...hops(run, 'epic'));
        run = [];
      }
      run.push({ at: `t=${t.toFixed(2)}`, items: sceneOf(shot.step ?? shot.beat.kind, shot.p) });
    }
    bad.push(...hops(run, 'epic'));
    expect(bad).toEqual([]);
  }, 60_000);

  it('slides knot 2\'s hand in clear of the KNOT STEP chip (the loop, 30 fps)', () => {
    // In the loop the step's chip covers the stage's left 55 units at its
    // height, inside the edge fade; the safe box starts at 70. A hand that
    // came in from off the stage seemed to grow out of the chip.
    const bad = [];
    for (let f = 0; f <= stepSlotSec(8) * FPS; f += 1) {
      const p = stepProgress(8, f / FPS);
      if (p > 0.3) break;
      const gloves = sceneFor(8, p).filter((it) => it.kind === 'glove');
      bad.push(...unsafe(gloves, stepFrame(8, p)).map((u) => `p=${p.toFixed(3)}: ${u}`));
    }
    expect(bad).toEqual([]);
  });

  it('leaves at a step\'s start within the stage, never through its lower edge (the loop and the epic, 30 fps)', () => {
    // The stage's lower edge is mid-screen on the wall, just above the words:
    // a hand sinking through it was sliced flat there, or drawn on the epic's
    // caption. So a hand that goes stays inside the safe box while it shows.
    const shows = (items) => items.filter((it) => it.kind === 'glove' && it.o > 0.05);
    const bad = [];
    for (let i = 1; i <= 6; i += 1) {
      for (let f = 0; f <= stepSlotSec(i) * FPS; f += 1) {
        const p = stepProgress(i, f / FPS);
        if (p > 0.1) break;
        bad.push(...unsafe(shows(sceneFor(i, p)), stepFrame(i, p)).map((u) => `step ${i + 1} p=${p.toFixed(3)}: ${u}`));
      }
      const beat = EPIC_BEATS[i + 1];
      for (let t = beat.start; t < beat.end; t += 1 / FPS) {
        const { shot, items } = epicAt(t);
        if (shot.p > 0.1) break;
        bad.push(...unsafe(shows(items), shot.camera).map((u) => `epic t=${t.toFixed(2)}: ${u}`));
      }
    }
    expect(bad).toEqual([]);
  });

  it('lets a hand fade out where it is, but never pop out or blink', () => {
    const g = sceneFor(0, 1).find((it) => it.kind === 'glove' && it.id === 'right');
    const fade = [1, 0.7, 0.4, 0.15, 0.03].map((o, i) => ({ at: `f${i}`, items: [{ ...g, o }] }));
    expect(hops([...fade, { at: 'gone', items: [] }], 'probe')).toEqual([]);
    expect(hops([{ at: 'a', items: [g] }, { at: 'b', items: [] }], 'probe')).toHaveLength(1);
    expect(hops([{ at: 'a', items: [g] }, { at: 'b', items: [{ ...g, o: 0.02 }] }], 'probe')).toHaveLength(1);
    expect(hops([{ at: 'a', items: [g] }, { at: 'b', items: [{ ...g, o: 0.3 }] }], 'probe')).toHaveLength(1);
  });

  it('catches a teleport when there is one', () => {
    const g = sceneFor(0, 0.5).find((it) => it.kind === 'glove' && it.id === 'right');
    const moved = { ...g, x: g.x + 120 };
    expect(hops([{ at: 'a', items: [g] }, { at: 'b', items: [moved] }], 'probe')).toHaveLength(1);
  });
});
