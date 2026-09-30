// @ts-check
// Bracelet Time's pictures (owner, 2026-09-30): the church's handout, one
// photo per step, recreated as animation for the projector wall. This file is
// the pure half. It knows nothing of React, the DOM or the clock: every
// picture is a DISPLAY LIST (plain objects) computed from (step, p), where p
// is the step's action progress, 0 at the start and 1 at the finished,
// resting picture (the frame a still or low-power wall shows).
// components/bracelet/StepArt.jsx draws the lists; BraceletStage.jsx drives p
// from the clock.
//
// Everything is drawn on a 1460x560 stage for a PURE BLACK wall, so every
// cord is cased (a white stroke under a near-black core) and every bead has a
// white keyline: a black cord and a black bead would otherwise vanish.
// The hands are white cartoon gloves (no skin tone is picked).
//
// Deterministic by construction: no Math.random, no Date. The same (step, p)
// is the same picture on every screen.

import { HOUSE } from './kit.js';
import { mulberry32 } from './color.js';

export const STAGE_W = 1460;
export const STAGE_H = 560;

// ── The palette ──────────────────────────────────────────────
// The six bead colours are the lobby poster's (BraceletsPromo.jsx BEADS, in
// gospel order; a test pins them), plus the clear slider bead.

/** @typedef {'black' | 'red' | 'white' | 'blue' | 'green' | 'yellow' | 'clear'} BeadColor */
/** @typedef {{ tone: string, light: string, dark: string }} BeadTone */

export const BEAD_TONES = /** @type {Readonly<Record<BeadColor, BeadTone>>} */ (Object.freeze({
  black: Object.freeze({ tone: '#1c1b22', light: '#4a4852', dark: '#050507' }),
  red: Object.freeze({ tone: '#d7263d', light: '#ff6b78', dark: '#8e0e20' }),
  white: Object.freeze({ tone: '#f4f3f0', light: '#ffffff', dark: '#c9c6d4' }),
  blue: Object.freeze({ tone: '#1f5fd6', light: '#6aa0ff', dark: '#0e3690' }),
  green: Object.freeze({ tone: '#22a447', light: '#6ee08a', dark: '#0f6a2a' }),
  yellow: Object.freeze({ tone: '#ffc928', light: '#fff0a8', dark: '#d18f00' }),
  // Clear: the body is a breath of ice blue, the keyline and glint carry it.
  // Clear: an icy, glinting body the cord shows through, so from the back of
  // the room it reads as glass, never as another dark bead.
  clear: Object.freeze({ tone: 'rgba(200, 232, 255, 0.5)', light: 'rgba(240, 250, 255, 0.85)', dark: 'rgba(160, 205, 240, 0.45)' }),
}));

/** The six coloured beads in the order they go on (the handout's steps 1 to 6). */
export const BEAD_ORDER = /** @type {readonly BeadColor[]} */ (Object.freeze(['black', 'red', 'blue', 'white', 'green', 'yellow']));

/** The finished row, left to right (step 7). */
export const BRACELET_ROW = /** @type {readonly BeadColor[]} */ (Object.freeze(['clear', ...BEAD_ORDER, 'clear']));

/** A pony bead at scale 1, in stage units: its length along the cord and its width across it. */
export const BEAD_SIZE = Object.freeze({ l: 74, d: 92 });
const BEAD_HALF = { w: BEAD_SIZE.l / 2, h: BEAD_SIZE.d / 2 };
/** A tied knot's lump at scale 1 (StepArt draws it). */
/** A knot's lump of cord (StepArt draws it), half its width and height at scale 1. */
export const KNOT_SIZE = Object.freeze({ rx: 20, ry: 21 });

/** The cartoon glove's pointer finger, in the glove's own units (StepArt draws it). */
export const GLOVE = Object.freeze({ fingerW: 48, pointReach: 128 });

/**
 * The pinch pose's hand body direction in the glove's own frame, degrees
 * (the fingertips pinch at the origin, the hand trails off down and right;
 * StepArt draws it that way). A mirrored (left) glove's body is at 180 - this.
 */
export const PINCH_BODY_DEG = 32;

/** `camera` is a plain translate-then-scale of the stage: {0, 0, 1} is no camera at all. */
export const IDENTITY_CAMERA = Object.freeze({ x: 0, y: 0, scale: 1 });

// ── Display list items ───────────────────────────────────────

/** @typedef {[number, number]} Pt */
/** @typedef {'open' | 'pinch' | 'point' | 'fist' | 'pull'} GlovePose */
/** @typedef {{ kind: 'cord', pts: Pt[], tone: 'front' | 'back' | 'gold', w: number }} CordItem */
/** @typedef {{ kind: 'bead', x: number, y: number, rot: number, s: number, sx: number, sy: number, color: BeadColor }} BeadItem */
/**
 * @typedef {{ kind: 'glove', id: string, x: number, y: number, rot: number, s: number, pose: GlovePose, flip: boolean,
 *   gap: number, reach: number, grip: number, gripAt: number, ext: number, o: number, layer: GloveLayer }} GloveItem
 */
/** @typedef {'all' | 'hand' | 'grip'} GloveLayer */
/** @typedef {{ kind: 'knot', x: number, y: number, rot: number, s: number }} KnotItem */
/** @typedef {{ kind: 'pot', x: number, y: number, s: number, color: BeadColor }} PotItem */
/** @typedef {{ kind: 'text', x: number, y: number, s: number, rot: number, o: number, size: number, text: string }} TextItem */
/** @typedef {{ kind: 'badge', x: number, y: number, s: number, o: number, text: string }} BadgeItem */
/** @typedef {{ kind: 'burst' | 'ring' | 'sparkle', x: number, y: number, s: number, rot: number, o: number, color: string }} FxItem */
/** @typedef {{ kind: 'arrow', pts: Pt[], o: number }} ArrowItem */
/** @typedef {CordItem | BeadItem | GloveItem | KnotItem | PotItem | TextItem | BadgeItem | FxItem | ArrowItem} Item */

// ── The glove rig ────────────────────────────────────────────
// Five poses, each a list of parts in the glove's own frame (a RIGHT glove,
// back of the hand toward us; `flip` mirrors it into a left one). StepArt
// draws the parts back to front, each outline then fill, so a finger in front
// of the palm keeps its own outline; the tests measure the same parts, so a
// hand's box is the drawing's own. The origin is the pose's action point: the
// palm's centre (open), between the fingertips (pinch), the pointer's tip
// (point), the grip (fist, pull).

/** The glove's dark outline, each side, in glove units at a hand's usual size. */
export const GLOVE_OUTLINE = 5;

/**
 * How much of GLOVE_OUTLINE (and of the stitch lines) a glove drawn at scale
 * s carries, so a big hand's outline is no heavier on the wall than a small
 * one's (the outline would otherwise grow with the glove).
 * @param {number} s
 */
export const lineWeight = (s) => Math.min(1, 0.9 / Math.max(0.01, s));

/**
 * @typedef {{ t: 'cap', pts: Pt[], w: number }
 *   | { t: 'blob', x: number, y: number, w: number, h: number, rx: number, rot: number }
 *   | { t: 'bump', cx: number, cy: number, r: number }
 *   | { t: 'line', pts: Pt[] }
 *   | { t: 'zip', pts: Pt[] }} GlovePart
 */

/** @param {Pt[]} pts @param {number} w @returns {GlovePart} */
const cap = (pts, w) => ({ t: 'cap', pts, w });
/** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} rx @param {number} [rot] @returns {GlovePart} */
const blob = (x, y, w, h, rx, rot = 0) => ({ t: 'blob', x, y, w, h, rx, rot });
/** @param {number} cx @param {number} cy @param {number} r @returns {GlovePart} */
const bump = (cx, cy, r) => ({ t: 'bump', cx, cy, r });
/** @param {Pt[]} pts @returns {GlovePart} */
const crease = (pts) => ({ t: 'line', pts });
/** @param {Pt[]} pts @returns {GlovePart} */
const zip = (pts) => ({ t: 'zip', pts });

/**
 * The three stitch lines on the back of a glove.
 * @param {number} cx @param {number} cy @param {number} len @param {number} spread @param {number} [deg]
 * @returns {GlovePart[]}
 */
function stitches(cx, cy, len, spread, deg = 90) {
  const a = deg / (180 / Math.PI);
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  return [-spread, 0, spread].map((o) => crease([
    [cx - uy * o - (ux * len) / 2, cy + ux * o - (uy * len) / 2],
    [cx - uy * o + (ux * len) / 2, cy + ux * o + (uy * len) / 2],
  ]));
}

/** @typedef {{ gap?: number, reach?: number, grip?: number, gripAt?: number, ext?: number, layer?: GloveLayer }} PoseOptions */

/**
 * A pose's parts. `gap` opens the pinch. For the pointing hand, `reach` is
 * the pointer's length, `ext` how far it is out (1 all the way, 0 curled back
 * into the fist: sliding out of the loops), and `grip` how far the thumb and
 * the middle finger have reached forward along it, to `gripAt` (in the
 * glove's own units, from the fingertip), to pinch what is on it. `layer`
 * splits a gripping hand in two: 'grip' is just the thumb and middle finger
 * (drawn over what they pinch), 'hand' is the rest.
 * @param {GlovePose} pose @param {PoseOptions} [o]
 * @returns {GlovePart[]}
 */
export function gloveParts(pose, { gap = 60, reach = GLOVE.pointReach, grip = 0, gripAt = 0, ext = 1, layer = 'all' } = {}) {
  if (pose === 'point') {
    const L = reach;
    const e = clamp01(ext);
    const gr = clamp01(grip);
    // The pointer's round tip end; it slides back toward the fist as ext falls.
    const from = 24 + (1 - e) * (L - 30);
    /** @type {GlovePart[]} */
    const parts = [
      blob(-22, L + 118, 144, 50, 22),
      crease([[-12, L + 136], [112, L + 136]]),
      cap([[0, from], [0, L + 40]], GLOVE.fingerW),
    ];
    if (e > 0.3) {
      // A cartoon pointer: the nail at its tip and two joint creases.
      parts.push(crease([[-11, from - 12], [-11, from + 4], [0, from + 10], [11, from + 4], [11, from - 12]]));
      for (const k of [0.42, 0.74]) {
        const y = from + (L - from) * k;
        parts.push(crease([[-15, y], [15, y]]));
      }
    }
    parts.push(blob(-28, L - 10, 148, 134, 60));
    // The knuckles, in front of the palm so they read.
    parts.push(bump(40, L - 6, 21), bump(74, L - 2, 20), bump(104, L + 6, 18));
    // The thumb lies along the pointer; gripping, it reaches forward along
    // its near side, and the middle finger along its far side.
    /** @type {Pt} */
    const thumbTip = [lerp(-26, -35, gr), lerp(L + 6, gripAt, gr)];
    const fingers = [cap([[-30, L + 92], [-34, L + 40], thumbTip], 38)];
    if (gr > 0) fingers.push(cap([[40, L - 6], [lerp(40, 37, gr), lerp(L - 6, gripAt, gr)]], 34));
    const split = gr > 0 && layer !== 'all';
    if (layer === 'grip') return split ? fingers : [];
    if (!split) parts.push(...fingers);
    parts.push(...stitches(62, L + 70, 44, 24));
    return parts;
  }
  if (pose === 'pinch') {
    const h = Math.max(8, gap / 2);
    return [
      blob(130, 82, 116, 48, 20, 122),
      cap([[112, 26], [128, -6]], 40),
      cap([[138, 44], [154, 14]], 36),
      blob(52, 2, 128, 118, 54, 32),
      cap([[82, 18], [56, -h - 32], [22, -h - 34], [6, -h - 20]], 44),
      cap([[66, 92], [26, h + 36], [6, h + 20]], 42),
      ...stitches(120, 66, 40, 20, 32),
    ];
  }
  if (pose === 'fist' || pose === 'pull') {
    const fist = [
      blob(-52, 52, 104, 46, 20),
      crease([[-44, 70], [44, 70]]),
      blob(-58, -60, 116, 122, 48),
      cap([[-42, -30], [36, -30]], 32),
      cap([[-42, 0], [38, 0]], 32),
      cap([[-38, 30], [34, 30]], 30),
      cap([[-56, -46], [-22, -64], [20, -60]], 30),
    ];
    if (pose === 'fist') return fist;
    return [
      ...fist,
      zip([[-78, -70], [-78, -112]]),
      zip([[78, -70], [78, -112]]),
      zip([[-56, -86], [-56, -118]]),
      zip([[56, -86], [56, -118]]),
    ];
  }
  return [
    blob(-60, 70, 120, 48, 22),
    crease([[-50, 88], [50, 88]]),
    cap([[-50, 20], [-90, -22], [-102, -46]], 44),
    cap([[-36, -40], [-48, -126]], 46),
    cap([[-2, -44], [-2, -144]], 46),
    cap([[32, -40], [46, -120]], 44),
    blob(-66, -64, 132, 140, 58),
    ...stitches(0, -8, 52, 24),
  ];
}

// ── Small maths ──────────────────────────────────────────────

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** @param {number} v */
const clamp01 = (v) => clamp(v, 0, 1);
/** Local progress of p through [a, b], clamped. @param {number} p @param {number} a @param {number} b */
const seg = (p, a, b) => clamp01((p - a) / (b - a));
/** @param {number} a @param {number} b @param {number} t */
const lerp = (a, b, t) => a + (b - a) * t;
/** @param {Pt} a @param {Pt} b @param {number} t @returns {Pt} */
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
/** @param {number} t */
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
/** @param {number} t */
const easeOut = (t) => 1 - (1 - t) ** 3;
/** Overshoot and settle: a pop. @param {number} t */
const backOut = (t) => {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
/** A child's pace: slow to start, steady, slow to finish, never backwards. @param {number} t */
const pace = (t) => clamp01(t - (0.5 / TAU) * Math.sin(TAU * t));
/** @param {number} v */
const r1 = (v) => Math.round(v * 10) / 10;

// ── Polylines ────────────────────────────────────────────────

/** @param {Pt[]} pts */
function cumulative(pts) {
  const out = [0];
  for (let i = 1; i < pts.length; i += 1) {
    out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return out;
}

/** @param {Pt[]} pts */
const polyLength = (pts) => cumulative(pts)[pts.length - 1];

/**
 * The point `d` along a polyline, and its heading in degrees.
 * @param {Pt[]} pts @param {number} d
 */
function along(pts, d) {
  const cum = cumulative(pts);
  const dd = clamp(d, 0, cum[cum.length - 1]);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < dd) i += 1;
  const a = pts[i - 1];
  const b = pts[i];
  const len = cum[i] - cum[i - 1] || 1;
  const t = (dd - cum[i - 1]) / len;
  return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), rot: Math.atan2(b[1] - a[1], b[0] - a[0]) * DEG };
}

/**
 * The stretch of a polyline between distances d0 and d1 (at least two points).
 * @param {Pt[]} pts @param {number} d0 @param {number} d1 @returns {Pt[]}
 */
function slice(pts, d0, d1) {
  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  const a = clamp(d0, 0, total);
  const b = clamp(d1, a, total);
  const start = along(pts, a);
  const end = along(pts, b);
  /** @type {Pt[]} */
  const out = [[start.x, start.y]];
  for (let i = 1; i < pts.length - 1; i += 1) if (cum[i] > a && cum[i] < b) out.push(pts[i]);
  out.push([end.x, end.y]);
  return out;
}

/**
 * A cubic Bezier as n+1 points.
 * @param {Pt} p0 @param {Pt} p1 @param {Pt} p2 @param {Pt} p3 @param {number} [n]
 * @returns {Pt[]}
 */
function cubic(p0, p1, p2, p3, n = 16) {
  /** @type {Pt[]} */
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const e = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]]);
  }
  return out;
}

/** @param {Pt} v @returns {Pt} */
function unit(v) {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

/** @param {Pt} p @param {Pt} o @param {number} deg @returns {Pt} */
function rotateAbout(p, o, deg) {
  const a = deg / DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = p[0] - o[0];
  const dy = p[1] - o[1];
  return [o[0] + dx * c - dy * s, o[1] + dx * s + dy * c];
}

// ── Item constructors (every number rounded to 0.1) ──────────

/** @param {Pt[]} pts @param {'front' | 'back' | 'gold'} [tone] @param {number} [w] @returns {CordItem} */
const cord = (pts, tone = 'front', w = 1) => ({ kind: 'cord', pts: pts.map(([x, y]) => /** @type {Pt} */ ([r1(x), r1(y)])), tone, w: r1(w * 100) / 100 });

/**
 * @param {number} x @param {number} y @param {BeadColor} color
 * @param {{ rot?: number, s?: number, sx?: number, sy?: number }} [o]
 * @returns {BeadItem}
 */
const bead = (x, y, color, { rot = 0, s = 1, sx = 1, sy = 1 } = {}) => ({
  kind: 'bead', x: r1(x), y: r1(y), rot: r1(rot), s: r1(s * 1000) / 1000, sx: r1(sx * 1000) / 1000, sy: r1(sy * 1000) / 1000, color,
});

/** An angle folded into (-180, 180]. @param {number} deg */
const fold = (deg) => {
  const d = ((deg % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
};

/**
 * A glove (see gloveParts for gap, reach, grip, gripAt and ext). `id` names
 * the hand, so a test can follow it from frame to frame; `o` is its opacity
 * (below 1 only while one pose cross-fades into another).
 * @param {number} x @param {number} y @param {GlovePose} pose
 * @param {{ id?: string, rot?: number, s?: number, flip?: boolean, o?: number } & PoseOptions} [o]
 * @returns {GloveItem}
 */
const glove = (x, y, pose, {
  id = '', rot = 0, s = 1, flip = false, gap = 60, reach = GLOVE.pointReach, grip = 0, gripAt = 0, ext = 1, o = 1, layer = 'all',
} = {}) => ({
  kind: 'glove', id, x: r1(x), y: r1(y), rot: r1(fold(rot)), s: r1(s * 1000) / 1000, pose, flip,
  gap: r1(gap), reach: r1(reach), grip: r1(clamp01(grip) * 1000) / 1000, gripAt: r1(gripAt), ext: r1(clamp01(ext) * 1000) / 1000,
  o: r1(clamp01(o) * 1000) / 1000, layer,
});

/**
 * A hand changing pose (their palms in one place), over `k` from 0 to 1:
 * the new pose fades in OVER the old one, which stays whole, then the old
 * one fades out under it. One of the two is always at full strength, so
 * the hand never turns into a see-through grey double (both at half over
 * the black wall showed the cord and the beads through it); only the
 * fingers that change fade. Whichever is the more visible keeps the hand's
 * name; the other is its fading ghost ("~").
 * @param {GloveItem} from @param {GloveItem} to @param {number} k
 * @returns {GloveItem[]}
 */
function crossfade(from, to, k) {
  const t = clamp01(k);
  if (t <= 0) return [from];
  if (t >= 1) return [to];
  const main = t >= 0.5;
  return [
    { ...from, o: r1(Math.min(1, 2 * (1 - t)) * 1000) / 1000, id: main ? `${from.id}~` : from.id },
    { ...to, o: r1(Math.min(1, 2 * t) * 1000) / 1000, id: main ? to.id : `${to.id}~` },
  ];
}
/**
 * How long a pose's cross-fade lasts, in step progress: about 5 frames at
 * 30 fps in the loop and 3 to 5 in the epic's quicker beats, a quick change
 * of fingers rather than a see-through double hand.
 */
const FADE = 0.018;

/** @param {number} x @param {number} y @param {number} [s] @param {number} [rot] @returns {KnotItem} */
const knot = (x, y, s = 1, rot = 0) => ({ kind: 'knot', x: r1(x), y: r1(y), rot: r1(rot), s: r1(s * 1000) / 1000 });

/**
 * @param {'burst' | 'ring' | 'sparkle'} kind @param {number} x @param {number} y
 * @param {number} s @param {number} o @param {string} color @param {number} [rot]
 * @returns {FxItem}
 */
const fx = (kind, x, y, s, o, color, rot = 0) => ({ kind, x: r1(x), y: r1(y), s: r1(s), rot: r1(rot), o: r1(clamp01(o) * 1000) / 1000, color });

/** @param {number} x @param {number} y @param {string} text @param {number} s @param {number} o @returns {BadgeItem} */
const badge = (x, y, text, s, o) => ({ kind: 'badge', x: r1(x), y: r1(y), text, s: r1(s * 1000) / 1000, o: r1(clamp01(o) * 1000) / 1000 });

/**
 * @param {number} x @param {number} y @param {string} textValue @param {number} size
 * @param {{ s?: number, rot?: number, o?: number }} [o]
 * @returns {TextItem}
 */
const text = (x, y, textValue, size, { s = 1, rot = 0, o = 1 } = {}) => ({
  kind: 'text', x: r1(x), y: r1(y), text: textValue, size, s: r1(s * 1000) / 1000, rot: r1(rot), o: r1(clamp01(o) * 1000) / 1000,
});

/** @param {Pt[]} pts @param {number} o @returns {ArrowItem} */
const arrow = (pts, o) => ({ kind: 'arrow', pts: pts.map(([x, y]) => /** @type {Pt} */ ([r1(x), r1(y)])), o: r1(clamp01(o) * 1000) / 1000 });

// ── Tier 2: the little pops (small elements, scaled by transform) ──

const SUN = HOUSE.sun;
const WHITE = '#FFFFFF';

/**
 * A starburst and a spray of sparkles where something lands; gone by the end.
 * @param {number} p @param {number} at @param {number} x @param {number} y
 * @param {{ len?: number, size?: number, seed?: number }} [o]
 * @returns {Item[]}
 */
function landingPop(p, at, x, y, { len = 0.14, size = 1, seed = 1 } = {}) {
  if (p < at || p >= at + len) return [];
  const e = seg(p, at, at + len);
  const out = /** @type {Item[]} */ ([fx('burst', x, y, lerp(58, 104, easeOut(e)) * size, 1 - e * e, SUN, seed * 17)]);
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i - 2) * 0.62 + seed * 0.3;
    const d = lerp(46, 128, easeOut(e)) * size;
    out.push(fx('sparkle', x + Math.cos(a) * d, y + Math.sin(a) * d, lerp(15, 7, e) * size, 1 - e, i % 2 ? WHITE : SUN, 90 * e));
  }
  return out;
}

// ── The bead row (steps 1 to 7) ──────────────────────────────

const ROW_Y = 292;
const ROW_L = 214;
const ROW_R = 1246;
const ROW_CX = 730;
const SLOT_PITCH = 78;
/** The centre of row slot k (0 and 7 are the clear beads). @param {number} k */
const slotX = (k) => ROW_CX + (k - 3.5) * SLOT_PITCH;
const KNOT_OFF = 62;
const BEAD_GAP = 100; // the pinch that holds a bead, across its 92 px

// ── Hands that change pose keep their palm where it was ──────
// A pose's anchor is a different part of the hand (the pinch point, the
// fingertip, the palm), so swapping poses at one anchor would jump the whole
// hand. A swap is placed by the palm instead: the new pose's palm lands where
// the old one's was, and only the fingers change.

/** The palm's centre in a pose's own frame. @param {GlovePose} pose @param {number} [reach] @returns {Pt} */
function palmLocal(pose, reach = GLOVE.pointReach) {
  if (pose === 'pinch') return [116, 61];
  if (pose === 'point') return [46, reach + 57];
  if (pose === 'open') return [0, 6];
  return [0, 1];
}

/**
 * The palm's centre of a glove on the stage.
 * @param {GloveItem} g @returns {Pt}
 */
function palmOf(g) {
  return placed([palmLocal(g.pose, g.reach)], g, g.flip ? -g.s : g.s, g.s)[0];
}

/**
 * A glove whose palm sits at `palm`.
 * @param {Pt} palm @param {GlovePose} pose
 * @param {{ id?: string, rot?: number, s?: number, flip?: boolean, gap?: number, reach?: number }} o
 * @returns {GloveItem}
 */
function gloveByPalm(palm, pose, o) {
  // (see palmLocal: the palm is where the pose's hand is, whatever it holds)
  const rot = o.rot ?? 0;
  const s = o.s ?? 1;
  const [lx, ly] = palmLocal(pose, o.reach);
  const px = lx * (o.flip ? -s : s);
  const py = ly * s;
  const a = rot / DEG;
  return glove(palm[0] - (px * Math.cos(a) - py * Math.sin(a)), palm[1] - (px * Math.sin(a) + py * Math.cos(a)), pose, o);
}

/**
 * Where a carried bead is at p: in from off stage at the cord's height with
 * its hand, lined up with the cord's tip, threaded on, slid along to its
 * slot, a squash as it lands.
 * @param {number} p
 * @param {{ from: Pt, entry: number, thread: number, to: number, t0: number, t1: number, t2: number, t3: number }} m
 */
function carriedBead(p, { from, entry, thread, to, t0, t1, t2, t3 }) {
  const dir = Math.sign(to - entry) || 1;
  // (in from off the stage, so it may start slowly there: no hand ever
  // streaks across a frame, even in the epic's quick bead beats)
  const a = easeInOut(seg(p, t0, t1));
  let x = lerp(from[0], entry, a);
  let y = lerp(from[1], ROW_Y, a) - 26 * Math.sin(Math.PI * a);
  let rot = -14 * dir * (1 - a);
  if (p > t1) {
    x = lerp(entry, thread, easeInOut(seg(p, t1, t2)));
    y = ROW_Y;
    rot = 4 * dir * Math.sin(Math.PI * seg(p, t1, t2));
  }
  if (p > t2) {
    // (a smoothstep: the first bead slides the whole cord, and a steeper
    // ease streaked it across frames in the epic's quick beats)
    const k = seg(p, t2, t3);
    x = lerp(thread, to, k * k * (3 - 2 * k));
    rot = 0;
  }
  const q = Math.sin(Math.PI * seg(p, t3, t3 + 0.09));
  return { x, y, rot, sx: 1 - 0.16 * q, sy: 1 + 0.08 * q };
}

// The pointing hand's resting place under a new bead (whole inside the safe
// box), and the pinch that lets go of it on the way there.
const POINT_REST = { dx: 28, dy: 52, rot: -48, s: 0.7 };
const RELEASE = { open: 0.86, swap: 0.92 };

/**
 * The right hand, pointing at the bead in slot x `tx`, as it rests.
 * @param {number} tx @param {string} id @returns {GloveItem}
 */
const restingPointer = (tx, id) => glove(tx + POINT_REST.dx, ROW_Y + POINT_REST.dy, 'point', { id, rot: POINT_REST.rot, s: POINT_REST.s });

/**
 * The glove that carries a bead, lets go of it and points at it: the pinch
 * opens and drops, the fingers change while it is still moving (its palm
 * stays put), then it settles pointing at the bead.
 * @param {number} p @param {{ x: number, y: number, rot: number }} b @param {number} tx @param {string} id
 * @returns {GloveItem[]}
 */
function carrierGlove(p, b, tx, id) {
  if (p < RELEASE.open) return [glove(b.x, b.y, 'pinch', { id, gap: BEAD_GAP, rot: b.rot + edgeTilt(p, 1), s: 0.92 })];
  const opened = (/** @type {number} */ k) => glove(tx + 8 * k, ROW_Y + 56 * k, 'pinch', { id, gap: lerp(BEAD_GAP, 150, k), s: lerp(0.92, 0.82, k) });
  const pointing = (/** @type {number} */ k) => {
    const from = gloveByPalm(palmOf(opened(1)), 'point', { id, rot: -44, s: 0.82 });
    const to = restingPointer(tx, id);
    return glove(lerp(from.x, to.x, k), lerp(from.y, to.y, k), 'point', { id, rot: lerp(-44, POINT_REST.rot, k), s: lerp(0.82, POINT_REST.s, k) });
  };
  if (p < RELEASE.swap) return [opened(easeOut(seg(p, RELEASE.open, RELEASE.swap)))];
  const k = easeInOut(seg(p, RELEASE.swap, 1));
  // The fingers change as the hand moves on: the open pinch fades into the pointer.
  return crossfade(opened(1), pointing(k), seg(p, RELEASE.swap, RELEASE.swap + FADE));
}

/**
 * While a bead is lined up and threaded at the cord's tip, its hand tips its
 * body down, so the whole glove stays on the stage instead of reaching off
 * its edge; it straightens as the bead slides in.
 * @param {number} p @param {number} side 1 for the right hand, -1 for the left
 * @param {number} [from] @param {number} [to] when it straightens @param {number} [deg] how far it tips
 */
const edgeTilt = (p, side, from = 0.42, to = 0.62, deg = 40) => side * deg * (1 - seg(p, from, to));

/**
 * The right hand leaving its resting point (steps 2 to 7 start with it still
 * pointing at the last bead) for more beads: it draws back to the right,
 * where the beads come from, lifting a little, and fades as it goes. Never
 * down: the stage's lower edge is mid-screen on the wall, just above the
 * words, and a hand sinking through it was sliced flat there (and drawn over
 * the epic's caption).
 * @param {number} p @param {number} tx the bead it was pointing at @param {string} id
 * @returns {GloveItem[]}
 */
function pointerLeaves(p, tx, id) {
  // Gone before the next bead's hand comes in (it is the same hand); eased,
  // so it never streaks, even in the epic's quick beats.
  const e = seg(p, 0, LEAVE_BY);
  if (e >= LEAVE_FADE) return [];
  const k = e * e * (3 - 2 * e);
  const r = restingPointer(tx, id);
  return [glove(r.x + 150 * k, r.y - 64 * k, 'point', { id, rot: lerp(POINT_REST.rot, -28, k), s: POINT_REST.s, o: leaving(e) })];
}
/** A hand leaving at a step's start is gone by this p. */
const LEAVE_BY = 0.09;
/** It has faded out by this much of the way (a quick dissolve, not a long grey ghost). */
const LEAVE_FADE = 0.65;
/** A leaving hand's opacity, `e` of the way along. @param {number} e */
const leaving = (e) => {
  const f = clamp01(e / LEAVE_FADE);
  return 1 - f * f * (3 - 2 * f);
};

const rowCord = () => cord([[ROW_L, ROW_Y], [ROW_R, ROW_Y]]);

/** The other hand holds the cord where the row starts, so each bead has something to slide up against. */
const holdingFist = () => glove(slotX(0) - 18, ROW_Y, 'fist', { id: 'left', flip: true, s: 0.86, rot: 14 });

/** Right-hand beads come in from the right, at the cord's height, in their hand. */
const FROM_RIGHT = /** @type {Pt} */ ([1600, ROW_Y - 20]);
const FROM_LEFT = /** @type {Pt} */ ([-140, ROW_Y - 20]);
const BEAD_TIMES = { t0: 0.1, t1: 0.28, t2: 0.4, t3: 0.84 };

/**
 * Steps 1 to 6: one bead of colour BEAD_ORDER[k] joins the ones before it.
 * @param {number} k @param {number} p @returns {Item[]}
 */
function beadStep(k, p) {
  const tx = slotX(k + 1);
  // The landing pop is a glow behind the whole row: pushed after the fist
  // and the beads already on the cord, its rays read as gold stripes painted
  // across them.
  /** @type {Item[]} */
  const items = [...landingPop(p, 0.84, tx, ROW_Y, { seed: k + 1 }), rowCord()];
  items.push(holdingFist());
  // The beads always sit in front of the fist that holds the cord (the thumb
  // never jumps from under the black bead to over it between steps).
  for (let i = 0; i < k; i += 1) items.push(bead(slotX(i + 1), ROW_Y, BEAD_ORDER[i]));
  const b = carriedBead(p, { from: FROM_RIGHT, entry: ROW_R + 58, thread: ROW_R - 46, to: tx, ...BEAD_TIMES });
  if (p >= BEAD_TIMES.t0) {
    items.push(bead(b.x, b.y, BEAD_ORDER[k], { rot: b.rot, sx: b.sx, sy: b.sy }));
    items.push(...carrierGlove(p, b, tx, 'right'));
  }
  if (k > 0) items.push(...pointerLeaves(p, slotX(k), 'right'));
  return items;
}

// Bead-sized, as the handout's knots are (a bead is 74 x 92).
const KNOT_S = 1.75;

/**
 * One end's overhand knot beside its clear bead (`out` -1 for the left end,
 * 1 for the right): the hand swings the tail up and back over into a loop,
 * pushes the end down through it, and pulls it out straight again; the loop
 * cinches into a knot that slides snug against the bead. Returns the cords
 * to draw (null once the knot is tied: the knot item takes over) and where
 * the hand holds the end.
 * @param {number} p @param {-1 | 1} out
 */
function tying(p, out) {
  const kx = out < 0 ? slotX(0) - KNOT_OFF : slotX(7) + KNOT_OFF;
  const end = /** @type {Pt} */ ([out < 0 ? ROW_L + 12 : ROW_R - 12, ROW_Y]);
  const loop = easeInOut(seg(p, TIE.loop, TIE.tuck));
  const tuck = easeInOut(seg(p, TIE.tuck, TIE.pull));
  const tight = easeInOut(seg(p, TIE.pull, TIE.tied));
  const snug = easeInOut(seg(p, TIE.pull + 0.03, TIE.tied));
  const r = lerp(38, 12, tight);
  /** @type {Pt} */
  const k = [kx + out * 36 * (1 - snug), ROW_Y];
  /** @type {Pt} */
  const c = [k[0], ROW_Y - r * 0.95 * (1 - tight)];
  // The hand: at the tip, then up and back over the knot's place, down
  // through the loop, and out to the tip's place again.
  /** @type {Pt} */
  const up = [kx + out * 10, ROW_Y - 124];
  /** @type {Pt} */
  const down = [kx + out * 34, ROW_Y + 84];
  /** @type {Pt} */
  let hand;
  if (p < TIE.tuck) {
    hand = mix(end, up, loop);
    hand[1] -= 30 * Math.sin(Math.PI * loop);
  } else if (p < TIE.pull) {
    hand = tuck < 0.5 ? mix(up, c, tuck * 2) : mix(c, down, tuck * 2 - 1);
  } else {
    hand = mix(down, end, tight);
  }
  if (p < TIE.loop || p >= TIE.tied) return { cords: null, hand, kx, lump: null };
  // The loop: the tail curling round from where it leaves the row
  // (clockwise on the left, the mirror on the right). It closes only as the
  // tail comes back over the standing part, never grows out of a dot.
  const sweep = ((Math.PI * 11) / 6) * Math.max(0.04, loop);
  /** @type {Pt[]} */
  const ring = [];
  for (let i = 0; i <= 22; i += 1) {
    const a = Math.PI / 2 - out * (i / 22) * sweep;
    ring.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  const ringEnd = ring[ring.length - 1];
  /** @type {Item[]} */
  const cords = [cord([[out < 0 ? k[0] + 4 : k[0] - 4, ROW_Y], [out < 0 ? kx + 60 : kx - 60, ROW_Y]])];
  if (p < TIE.tuck) {
    cords.push(cord(ring), cord([ringEnd, hand]));
  } else {
    // Through the loop: in behind its rim, out in front.
    const through = tuck < 0.5 ? hand : c;
    cords.push(cord([ringEnd, mix(ringEnd, through, 0.5), through]), cord(ring));
    if (tuck >= 0.5 || p >= TIE.pull) cords.push(cord([c, hand]));
  }
  // As the loop cinches, the knot's lump lands on it and covers it.
  const land = seg(tight, 0.5, 1);
  const lump = land > 0 ? knot(k[0], ROW_Y, KNOT_S * lerp(0.5, 1, backOut(land)), 0) : null;
  return { cords, hand, kx, lump };
}

/** When step 7's knots are tied: the loop, the tuck, the pull, tied. */
const TIE = { loop: 0.53, tuck: 0.63, pull: 0.72, tied: 0.85 };

/**
 * Step 7: a clear bead on each end, then an overhand knot beside each one.
 * @param {number} p @returns {Item[]}
 */
function finishStep(p) {
  const tieL = tying(p, -1);
  const tieR = tying(p, 1);
  // Pops first, a glow behind the whole row (see beadStep): the clear beads
  // landing, then the knots.
  /** @type {Item[]} */
  const items = [
    ...landingPop(p, 0.42, slotX(0), ROW_Y, { seed: 7, size: 0.85 }),
    ...landingPop(p, 0.42, slotX(7), ROW_Y, { seed: 8, size: 0.85 }),
    ...landingPop(p, TIE.tied - 0.02, slotX(0) - KNOT_OFF, ROW_Y, { seed: 9, size: 0.7 }),
    ...landingPop(p, TIE.tied - 0.02, slotX(7) + KNOT_OFF, ROW_Y, { seed: 10, size: 0.7 }),
  ];
  // The cord: whole, until the ends are being tied.
  if (tieL.cords) items.push(cord([[tieL.kx + 58, ROW_Y], [tieR.kx - 58, ROW_Y]]));
  else items.push(rowCord());
  for (let i = 0; i < 6; i += 1) items.push(bead(slotX(i + 1), ROW_Y, BEAD_ORDER[i]));

  // The holding hand lets go of the cord and draws back to the left for a
  // clear bead, fading as it goes (never down through the stage's lower
  // edge; see pointerLeaves); it comes back with the bead from the left.
  if (p < LEAVE_BY * LEAVE_FADE) {
    const e = seg(p, 0, LEAVE_BY);
    const k = e * e * (3 - 2 * e);
    items.push(glove(lerp(slotX(0) - 18, slotX(0) - 170, k), ROW_Y - 30 * k, 'fist', { id: 'left', flip: true, s: 0.86, rot: 14 - 10 * k, o: leaving(e) }));
  }
  items.push(...pointerLeaves(p, slotX(6), 'right'));

  const T = { t0: 0.1, t1: 0.21, t2: 0.29, t3: 0.42 };
  const L = carriedBead(p, { from: FROM_LEFT, entry: ROW_L - 58, thread: ROW_L + 46, to: slotX(0), ...T });
  const R = carriedBead(p, { from: FROM_RIGHT, entry: ROW_R + 58, thread: ROW_R - 46, to: slotX(7), ...T });
  if (p >= T.t0) {
    items.push(bead(L.x, L.y, 'clear', { rot: L.rot, sx: L.sx, sy: L.sy }));
    items.push(bead(R.x, R.y, 'clear', { rot: R.rot, sx: R.sx, sy: R.sy }));
  }
  // The knots: tied from the tails, then knots.
  if (tieL.cords) items.push(...tieL.cords, ...(tieR.cords ?? []));
  if (tieL.lump) items.push(tieL.lump);
  if (tieR.lump) items.push(tieR.lump);
  if (p >= TIE.tied) {
    items.push(knot(tieL.kx, ROW_Y, KNOT_S, 0));
    items.push(knot(tieR.kx, ROW_Y, KNOT_S, 0));
  }

  if (p < T.t0) {
    // (both hands are off stage fetching beads)
  } else if (p < T.t3) {
    // (tipped further than a bead step's: the tips are nearer the edges)
    items.push(glove(L.x, L.y, 'pinch', { id: 'left', gap: BEAD_GAP, rot: L.rot + edgeTilt(p, -1, T.t2, T.t3, 58), flip: true, s: 0.92 }));
    items.push(glove(R.x, R.y, 'pinch', { id: 'right', gap: BEAD_GAP, rot: R.rot + edgeTilt(p, 1, T.t2, T.t3, 58), s: 0.92 }));
  } else if (p < FINISH_OPEN - FADE / 2) {
    // Each hand goes to its tail's tip and ties the knot with it, then
    // shrinks back a little, ready to let go.
    const m = seg(p, T.t3, TIE.loop);
    const move = m * m * (3 - 2 * m);
    const shrink = easeInOut(seg(p, TIE.tied, FINISH_OPEN - FADE / 2));
    const at = (/** @type {Pt} */ bd, /** @type {Pt} */ h) => mix(bd, h, move);
    const lAt = at([L.x, L.y], tieL.hand);
    const rAt = at([R.x, R.y], tieR.hand);
    items.push(glove(lAt[0], lAt[1], 'pinch', { id: 'left', gap: lerp(BEAD_GAP, 30, move), flip: true, s: lerp(lerp(0.92, 0.72, move), 0.6, shrink) }));
    items.push(glove(rAt[0], rAt[1], 'pinch', { id: 'right', gap: lerp(BEAD_GAP, 30, move), s: lerp(lerp(0.92, 0.72, move), 0.6, shrink) }));
  } else {
    // Let go: both hands spring open under the finished row, a "ta-da" (the
    // pinch fades into the open hand as it pops).
    const k = seg(p, FINISH_OPEN - FADE / 2, FINISH_OPEN + FADE / 2);
    const [openL, openR] = openHands(p);
    items.push(...crossfade(glove(TUG_L[0], ROW_Y, 'pinch', { id: 'left', gap: 30, flip: true, s: 0.6 }), openL, k));
    items.push(...crossfade(glove(TUG_R[0], ROW_Y, 'pinch', { id: 'right', gap: 30, s: 0.6 }), openR, k));
  }
  return items;
}

/** Where step 7's hands hold the tips once the knots are tied. */
const TUG_L = /** @type {Pt} */ ([ROW_L + 12, ROW_Y]);
const TUG_R = /** @type {Pt} */ ([ROW_R - 12, ROW_Y]);

/** When step 7's hands let go and spring open. */
const FINISH_OPEN = 0.9;
/** Where step 7's open hands rest (step 8 starts from them). */
const OPEN_REST = /** @type {readonly [Pt, Pt]} */ ([[196, 392], [1264, 392]]);

/**
 * Step 7's two hands springing open from their pinch (palms where they were,
 * then a pop to full size as they move to rest).
 * @param {number} p @returns {GloveItem[]}
 */
function openHands(p) {
  const tugL = TUG_L;
  const tugR = TUG_R;
  const e = easeOut(seg(p, FINISH_OPEN - FADE / 2, 1));
  const pop = backOut(seg(p, FINISH_OPEN - FADE / 2, 1));
  const lp = palmOf(glove(tugL[0], ROW_Y, 'pinch', { gap: 30, flip: true, s: 0.6 }));
  const rp = palmOf(glove(tugR[0], ROW_Y, 'pinch', { gap: 30, s: 0.6 }));
  return [
    gloveByPalm(mix(lp, OPEN_REST[0], e), 'open', { id: 'left', flip: true, s: lerp(0.5, 0.8, pop), rot: lerp(0, -16, e) }),
    gloveByPalm(mix(rp, OPEN_REST[1], e), 'open', { id: 'right', s: lerp(0.5, 0.8, pop), rot: lerp(0, 16, e) }),
  ];
}

// ── A row of beads bent into an arc (steps 8 to 13, the finale) ──

/**
 * The finished row laid along a circular arc whose lowest point is (cx, yb),
 * curving up at both ends with curvature kappa (0 is straight).
 * @param {{ cx: number, yb: number, kappa: number, s: number, colors?: readonly BeadColor[] }} a
 */
function arcRow({ cx, yb, kappa, s, colors = BRACELET_ROW }) {
  const pitch = SLOT_PITCH * s;
  const knotS = (3.5 * SLOT_PITCH + KNOT_OFF) * s;
  /** @param {number} d @returns {Pt} */
  const at = (d) => {
    if (Math.abs(kappa) < 1e-6) return [cx + d, yb];
    const phi = d * kappa;
    return [cx + Math.sin(phi) / kappa, yb - (1 - Math.cos(phi)) / kappa];
  };
  /** @param {number} d */
  const heading = (d) => d * kappa * DEG;
  /** @type {Item[]} */
  const beads = colors.map((color, k) => {
    const d = (k - 3.5) * pitch;
    const [x, y] = at(d);
    return bead(x, y, color, { rot: heading(d), s });
  });
  const knots = [-knotS, knotS].map((d) => {
    const [x, y] = at(d);
    return knot(x, y, s * KNOT_S, heading(d));
  });
  /** @type {Pt[]} */
  const pts = [];
  for (let i = 0; i <= 16; i += 1) pts.push(at(lerp(-knotS, knotS, i / 16)));
  const lEnd = at(-knotS);
  const rEnd = at(knotS);
  const lOut = unit([lEnd[0] - at(-knotS + 1)[0], lEnd[1] - at(-knotS + 1)[1]]);
  const rOut = unit([rEnd[0] - at(knotS - 1)[0], rEnd[1] - at(knotS - 1)[1]]);
  return { beads, knots, cordPts: pts, left: { pt: lEnd, out: lOut }, right: { pt: rEnd, out: rOut } };
}

/**
 * A cord from an arc's end out to a point, leaving along the arc and
 * arriving along `inDir`.
 * @param {{ pt: Pt, out: Pt }} end @param {Pt} to @param {Pt} inDir @param {number} [bend]
 * @returns {Pt[]}
 */
function arm(end, to, inDir, bend = 0.4) {
  const d = Math.hypot(to[0] - end.pt[0], to[1] - end.pt[1]);
  return cubic(
    end.pt,
    [end.pt[0] + end.out[0] * d * bend, end.pt[1] + end.out[1] * d * bend],
    [to[0] - inDir[0] * d * 0.35, to[1] - inDir[1] * d * 0.35],
    to,
    18,
  );
}

// ── Step 8: cross the two sides, left over right ─────────────

/** Where the hands hold the ends up in a U before crossing them (x, y). */
const U_LEFT = /** @type {Pt} */ ([604, 196]);
const U_RIGHT = /** @type {Pt} */ ([846, 170]);
/** Where the left end ends up once it has crossed over the right one. */
const CROSSED_LEFT = /** @type {Pt} */ ([1084, 196]);

/**
 * Step 8: cross the two ends, left over right. Both hands lift the ends into
 * a U; the right hand then holds its end still while the left hand carries
 * the left (black) end over it, in front of the right hand, to the right.
 * The two strings cross in an X under the hands: the black one on top,
 * heading up and right, the yellow one heading up and left.
 * @param {number} p @returns {Item[]}
 */
function crossStep(p) {
  const u = easeInOut(seg(p, 0.12, 0.46));
  const c = easeInOut(seg(p, 0.5, 0.86));
  // The U is only as deep as the epic's match cut allows: knot 1's frame,
  // in on this X, has to hold the U's lowest beads (see MATCH_AT).
  const row = arcRow({ cx: ROW_CX, yb: lerp(ROW_Y, 436, u), kappa: u / 430, s: lerp(1, 0.86, u) });

  // The hands: from where step 7 left them open, in to take the tips, up
  // into a U; then only the left one moves, up and over the right one.
  const grab = easeInOut(seg(p, 0, 0.12));
  /** @type {Pt} */
  const lHand = mix(mix([ROW_L, ROW_Y], U_LEFT, u), CROSSED_LEFT, c);
  lHand[1] -= 58 * Math.sin(Math.PI * c);
  /** @type {Pt} */
  const rHand = mix([ROW_R, ROW_Y], U_RIGHT, u);
  rHand[1] += 6 * Math.sin(Math.PI * c);
  // Crossed, the black end rises steeply to its hand, so the two strings
  // meet in an X below the hands, in plain view.
  /** @type {Pt} */
  const lIn = unit([lerp(-1, 0, u), lerp(0, -1, u)]);
  /** @type {Pt} */
  const rIn = unit([lerp(1, 0, u) - 0.36 * c, lerp(0, -1, u)]);

  /** @type {Item[]} */
  const items = [cord(row.cordPts)];
  items.push(cord(arm(row.right, rHand, rIn)));
  // The black side's arm morphs from its side of the U into the crossing
  // run: up and right from its end, over the yellow side below the hands,
  // on up to the left hand.
  const dL = Math.hypot(lHand[0] - row.left.pt[0], lHand[1] - row.left.pt[1]);
  const uArm = arm(row.left, lHand, lIn);
  items.push(cord(c <= 0 ? uArm : cubic(
    row.left.pt,
    mix([row.left.pt[0] + row.left.out[0] * dL * 0.4, row.left.pt[1] + row.left.out[1] * dL * 0.4], [row.left.pt[0] + 130, row.left.pt[1] - 95], c),
    mix([lHand[0] - lIn[0] * dL * 0.35, lHand[1] - lIn[1] * dL * 0.35], [lHand[0] - 224, lHand[1] + 134], c),
    lHand,
    18,
  )));
  items.push(...row.beads, ...row.knots);
  // Hands holding the cord's ends up, each arm (cuff) down and away from
  // the bracelet; the left one's still trails back the way it came.
  const lRot = lerp(0, 45, u);
  const rRot = lerp(0, -45, u);
  // A guide over the hands: the way the left end goes, over the right one.
  if (p > 0.4 && p < 0.96) {
    const o = Math.min(seg(p, 0.4, 0.48), 1 - seg(p, 0.88, 0.96));
    items.push(arrow(cubic([U_LEFT[0] + 30, 134], [760, 84], [950, 84], [CROSSED_LEFT[0] - 20, 124], 14), o));
  }
  if (grab < 1) {
    // Open hands close into fists on the tips, palms kept (see gloveByPalm);
    // the open hand fades into the fist.
    const lf = glove(ROW_L, ROW_Y, 'fist', { flip: true, s: 0.8 });
    const rf = glove(ROW_R, ROW_Y, 'fist', { s: 0.8 });
    const lp = mix(OPEN_REST[0], palmOf(lf), grab);
    const rp = mix(OPEN_REST[1], palmOf(rf), grab);
    const k = seg(grab, 0.42, 0.58);
    items.push(...crossfade(
      gloveByPalm(rp, 'open', { id: 'right', s: 0.8, rot: lerp(16, 0, grab) }),
      gloveByPalm(rp, 'fist', { id: 'right', s: 0.8, rot: lerp(16, 0, grab) }), k,
    ));
    items.push(...crossfade(
      gloveByPalm(lp, 'open', { id: 'left', s: 0.8, flip: true, rot: lerp(-16, 0, grab) }),
      gloveByPalm(lp, 'fist', { id: 'left', s: 0.8, flip: true, rot: lerp(-16, 0, grab) }), k,
    ));
  } else {
    // The right hand first: the left one passes over it, in front.
    items.push(glove(rHand[0], rHand[1], 'fist', { id: 'right', rot: rRot, s: 0.8 }));
    items.push(glove(lHand[0], lHand[1], 'fist', { id: 'left', rot: lRot, s: 0.8, flip: true }));
  }
  return items;
}

// ── The knot close-up (steps 9 to 13) ────────────────────────
// The child's own left hand, seen from above: its pointer finger held out to
// the right, the bracelet hanging below it. The two sides cross in an X on
// the finger near its tip, the left (black) side on top, just as step 8
// crossed them. The bottom string lies along the top of the finger toward
// the knuckle, in plain view; the top string wraps under and around the
// finger AND that string three times, working back toward the knuckle, and a
// counter pops for each wrap. Then the left hand's thumb and middle finger
// pinch the loops and the pointer slides out of them, which leaves a tunnel;
// the right hand pushes the end in at the tunnel's knuckle end and pulls it
// out past the X; both ends pulled, the wraps cinch into a knot round the
// bottom string, which is what closes the bracelet. Nothing here is drawn
// mirrored: the picture is the child's own view, left hand on the left.

const FY = 252; // the finger's axis
const XC = 800; // the X's centre, near the fingertip
const TIP_X = XC + 44; // the fingertip
const HAND_S = 1.3;
const HAND_REACH = 214; // the pointer finger, in glove units
const FR = (GLOVE.fingerW * HAND_S) / 2;
const R0 = FR + 9; // the wraps' radius round the finger (and the string on it)
const PITCH0 = 38;
const GAP0 = 14; // between the X and the first wrap
const WRAPS = 2.5; // three unders and three overs; the end leaves at the far edge
// The bracelet hangs below and to the right, clear of the right hand's reach.
const BRACELET_BELOW = { cx: XC + 190, yb: 446, kappa: 1 / 250, s: 0.5 };
/** Where the end is pulled out to, past the X on the fingertip's side. */
const THREAD_OUT = /** @type {Pt} */ ([XC + 150, FY + 6]);
/** The right hand holds the end this far behind its tip, so the tip can lead. */
const TIP_LEAD = 34;
/** The point `d` along a polyline, as a point. @param {Pt[]} pts @param {number} d @returns {Pt} */
function alongPt(pts, d) {
  const q = along(pts, d);
  return [q.x, q.y];
}
/** The right hand's size in the close-up (small, so it never hides the wraps). */
const RIGHT_S = 0.62;

/**
 * The knot's geometry for wraps of radius R and pitch.
 * @param {number} R @param {number} pitch @param {number} gap
 */
function knotGeom(R, pitch, gap) {
  const w = 0.85 * R;
  // The top string meets the finger's near edge and crosses over it, up and
  // toward the fingertip; the bottom string crosses under it and flattens
  // onto the finger, toward the knuckle.
  /** @type {Pt} */ const aTop = [XC - w, FY + R];
  /** @type {Pt} */ const bTop = [XC + w, FY - R];
  /** @type {Pt} */ const aBot = [XC + w, FY + R];
  /** @type {Pt} */ const bBot = [XC - 1.25 * w, FY - 0.42 * R];
  const x1 = XC - w - gap;
  /** A point of the top string's wrap at turn u (u < 0 is the pass under from the X). @param {number} u @returns {Pt} */
  const at = (u) => [u < 0 ? lerp(XC + w, x1, (u + 0.5) / 0.5) : x1 - pitch * u, FY + R * Math.cos(TAU * u)];
  // Where the two strands of the X cross.
  const t = ((aBot[0] - aTop[0]) * (bBot[1] - aBot[1]) - (aBot[1] - aTop[1]) * (bBot[0] - aBot[0]))
    / ((bTop[0] - aTop[0]) * (bBot[1] - aBot[1]) - (bTop[1] - aTop[1]) * (bBot[0] - aBot[0]));
  /** @type {Pt} */
  const cross = [lerp(aTop[0], bTop[0], t), lerp(aTop[1], bTop[1], t)];
  return { R, pitch, aTop, bTop, aBot, bBot, x1, xe: x1 - WRAPS * pitch, at, along: FY - 0.42 * R, inside: FY + 0.22 * R, cross };
}

/** The finished wraps round the finger. */
const G0 = knotGeom(R0, PITCH0, GAP0);

/**
 * The wraps, split into the halves over the finger (front) and under it (back).
 * @param {ReturnType<typeof knotGeom>} g @param {number} uTip
 */
function wraps(g, uTip) {
  /** @type {Pt[][]} */ const front = [];
  /** @type {Pt[][]} */ const back = [];
  for (let k = -1; k / 2 < uTip; k += 1) {
    const u0 = k / 2;
    const u1 = Math.min((k + 1) / 2, uTip);
    if (u1 <= u0 + 1e-6) continue;
    /** @type {Pt[]} */
    const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i += 1) pts.push(g.at(lerp(u0, u1, i / n)));
    (k % 2 === 0 ? front : back).push(pts);
  }
  return { front, back };
}

/** Where the bottom string's tail lies, over the back of the hand. */
const BOTTOM_TAIL = /** @type {Pt} */ ([452, FY - 4]);

/**
 * The bottom string past the X: along the top of the finger toward the
 * knuckle, under the wraps (which close round it), then on over the back of
 * the hand to its tail. It is always in plain view: this is the string a
 * child must lay along the finger.
 * @param {ReturnType<typeof knotGeom>} g @param {Pt} tail
 * @returns {CordItem}
 */
function bottomString(g, tail) {
  const y = g.along;
  /** @type {Pt} */
  const off = [g.xe - 26, y + 1];
  return cord([g.bBot, [g.bBot[0] - 14, y], off, [lerp(off[0], tail[0], 0.5), lerp(y, tail[1], 0.4)], tail]);
}

/**
 * Where the right hand holds the end when the wraps have reached turn u. It
 * circles the finger on the knuckle's side of the wrap it is making, so the
 * wraps already made and the X stay in view; its arm trails to the right, up
 * and right above the finger, down and right below it, and it never reaches
 * over the bracelet.
 * @param {ReturnType<typeof knotGeom>} g @param {number} u
 */
function holdAt(g, u) {
  const tip = g.at(u);
  const ph = TAU * u;
  const c = Math.cos(ph);
  /** @type {Pt} */
  const hand = [tip[0] - 84 + 22 * Math.sin(ph), FY + (g.R + (c > 0 ? 40 : 36)) * c];
  return { tip, hand, behind: Math.sin(ph) < -0.2, rot: (c > 0 ? 40 : 20) * c - PINCH_BODY_DEG };
}

/** The right hand, pinching the top string's end. @param {Pt} at @param {number} rot @param {number} [gap] @param {number} [s] */
const rightHand = (at, rot, gap = 20, s = RIGHT_S) => glove(at[0], at[1], 'pinch', { id: 'right', gap, s, rot });

/**
 * The end the right hand holds: from where it leaves the knot, through the
 * pinch, and out past the fingers by TIP_LEAD. `glint` (0..1) is the gold
 * rim on its tip that lets the eye follow "the top string".
 * @param {Pt} from @param {Pt} hand @param {number} [glint]
 * @returns {{ items: Item[], tip: Pt }}
 */
function heldEnd(from, hand, glint = 1) {
  const d = unit([hand[0] - from[0], hand[1] - from[1]]);
  /** @type {Pt} */
  const tip = [hand[0] + d[0] * TIP_LEAD, hand[1] + d[1] * TIP_LEAD];
  /** @type {Item[]} */
  const items = [];
  if (glint > 0) items.push(cord([[tip[0] - d[0] * 16, tip[1] - d[1] * 16], tip], 'gold', lerp(0.6, 1, glint)));
  items.push(cord([from, hand, tip]));
  return { items, tip };
}

/** Where the left hand's thumb and middle finger pinch the loops (the wraps' knuckle end). */
const GRIP_X = G0.xe + 8;

/**
 * The left hand, its pointer out along the finger's axis. `dx` moves the
 * hand, `ext` slides the pointer back into the fist (0: out of the loops),
 * `grip` brings the thumb and middle finger forward onto the loops. Gripping,
 * those two are their own layer ('grip'), drawn over the loops they pinch.
 * @param {{ dx?: number, ext?: number, grip?: number }} [o] @param {'all' | 'hand' | 'grip'} [layer]
 * @returns {GloveItem}
 */
function fingerHand({ dx = 0, ext = 1, grip = 0 } = {}, layer = 'all') {
  const x = TIP_X + dx;
  return glove(x, FY, 'point', {
    id: layer === 'grip' ? 'finger^' : 'finger', rot: 90, s: HAND_S, flip: true, reach: HAND_REACH,
    ext, grip, gripAt: (x - GRIP_X) / HAND_S, layer,
  });
}

/**
 * The bracelet hanging under the knot, and the two sides rising to the X.
 * @param {ReturnType<typeof knotGeom>} g
 * @returns {Item[]}
 */
function hangingBracelet(g) {
  const row = arcRow(BRACELET_BELOW);
  const topIn = unit([g.bTop[0] - g.aTop[0], g.bTop[1] - g.aTop[1]]);
  const botIn = unit([g.bBot[0] - g.aBot[0], g.bBot[1] - g.aBot[1]]);
  return [
    cord(row.cordPts),
    cord(arm(row.left, g.aTop, topIn, 0.3)),
    cord(arm(row.right, g.aBot, botIn, 0.3)),
    ...row.beads,
    ...row.knots,
  ];
}

/**
 * The X: the bottom string's pass, then the top string's over it.
 * @param {ReturnType<typeof knotGeom>} g @param {number} gold 0..1 how much of the X is lit
 * @returns {Item[]}
 */
function theX(g, gold) {
  /** @type {Item[]} */
  const out = [];
  const q = easeOut(gold);
  /** @param {Pt} a @param {Pt} b @returns {Pt[]} */
  const lighted = (a, b) => [mix(g.cross, a, q), mix(g.cross, b, q)];
  if (gold > 0) out.push(cord(lighted(g.aBot, g.bBot), 'gold'));
  out.push(cord([g.aBot, g.bBot]));
  if (gold > 0) out.push(cord(lighted(g.aTop, g.bTop), 'gold'));
  out.push(cord([g.aTop, g.bTop]));
  return out;
}

/**
 * One, two, three: a counter pops as each wrap's pass over the finger
 * closes, in a row above the knot that reads left to right.
 * @param {ReturnType<typeof knotGeom>} g @param {number} uTip @param {number} [o]
 * @returns {Item[]}
 */
function wrapCounters(g, uTip, o = 1) {
  /** @type {Item[]} */
  const out = [];
  for (let k = 0; k < 3; k += 1) {
    // Each pops as its pass over the finger closes (the last one by the end).
    const done = k + 0.3;
    if (uTip < done) continue;
    const pop = clamp01((uTip - done) / 0.2);
    // (clear of the resting hand's cuff by more than a keyline)
    out.push(badge(XC + 36 + k * 48, FY - g.R - 64, String(k + 1), backOut(pop), o));
  }
  return out;
}

/**
 * The right hand's resting hold on the end once the wraps are made: straight
 * up from the last wrap, clear of the left hand, its arm trailing right.
 */
const REST = { hand: /** @type {Pt} */ ([G0.xe - 16, FY - R0 - 44]), rot: -PINCH_BODY_DEG };

/**
 * The top string's end after the wraps: from where it leaves the last wrap
 * (at the far edge, the knuckle end) up to the right hand, then round the
 * hook, in at the tunnel's knuckle end, through it and out past the X.
 * `loopScale` shrinks the hook as the knot is pulled tight.
 * @param {ReturnType<typeof knotGeom>} g @param {Pt} out the far end @param {number} [loopScale]
 */
function threadRoute(g, out, loopScale = 1) {
  const s = loopScale;
  const e = g.at(WRAPS);
  const y = g.inside;
  /** @param {number} dx @param {number} dy @returns {Pt} */
  const off = (dx, dy) => [e[0] + dx * s, e[1] + dy * s];
  const d = unit([REST.hand[0] - e[0], REST.hand[1] - e[1]]);
  const hand = off(REST.hand[0] - e[0], REST.hand[1] - e[1]);
  const lead = off(REST.hand[0] - e[0] + d[0] * TIP_LEAD, REST.hand[1] - e[1] + d[1] * TIP_LEAD);
  /** @type {Pt} */
  const mouth = [g.xe - 24 * s, y];
  /** @type {Pt[]} */
  const loop = [e, hand, lead, off(-58, -80), off(-100, -62), off(-120, -24), off(-108, 22), [mouth[0] - 40 * s, y], mouth];
  /** @type {Pt[]} */
  const inside = [mouth, [g.x1 + 20, y]];
  /** @type {Pt[]} */
  const exit = [inside[1], [lerp(inside[1][0], out[0], 0.5), lerp(y, out[1], 0.5)], out];
  return { loop, inside, exit, all: [...loop, ...inside.slice(1), ...exit.slice(1)] };
}

const ROUTE = threadRoute(G0, THREAD_OUT);
const ROUTE_LEN = {
  rest: polyLength(ROUTE.loop.slice(0, 3)),
  loop: polyLength(ROUTE.loop),
  inside: polyLength(ROUTE.inside),
  total: polyLength(ROUTE.all),
};

/**
 * The wrapped knot, back to front: the bracelet, the wraps' far halves, the
 * left hand, the bottom string, the X, the wraps' near halves, then what is
 * over them (the left hand's pinching fingers, the end). `left` is the left
 * hand's layers (see leftHand); `threaded` is how far along its route the
 * end has gone (null: still held out in the right hand's rest).
 * @param {ReturnType<typeof knotGeom>} g
 * @param {{ left?: { under: GloveItem[], over: GloveItem[] }, gold?: number, threaded?: number | null, route?: ReturnType<typeof threadRoute>, glint?: number, tail?: Pt }} o
 * @returns {{ under: Item[], over: Item[], tipAt: Pt }}
 */
function wrappedKnot(g, { left = leftHand({}), gold = 0, threaded = null, route = ROUTE, glint = 1, tail = BOTTOM_TAIL }) {
  const { front, back } = wraps(g, WRAPS);
  /** @type {Item[]} */
  const under = hangingBracelet(g);
  for (const pts of back) under.push(cord(pts, 'back'));
  /** @type {Item[]} */
  const end = [];
  /** @type {Item[]} */
  const endInside = [];
  /** The end's hook round to the tunnel's mouth: under the pinching fingers. @type {Item[]} */
  const hook = [];
  /** @type {Pt} */
  let tipAt;
  if (threaded == null) {
    const held = heldEnd(g.at(WRAPS), REST.hand, glint);
    end.push(...held.items);
    tipAt = held.tip;
  } else {
    // The end's hook outside the tunnel passes under the pinching thumb and
    // middle finger (drawn over them, it read as "take the end round your
    // finger"); its run through the tunnel sits between the wraps' two
    // halves; out past the X it is in front. Its tip glints gold.
    const len = clamp(threaded, 1, polyLength(route.all));
    const loopLen = polyLength(route.loop);
    const insideLen = polyLength(route.inside);
    tipAt = alongPt(route.all, len);
    const back16 = alongPt(route.all, Math.max(0, len - 16));
    if (glint > 0 && len <= loopLen) hook.push(cord([back16, tipAt], 'gold', lerp(0.6, 1, glint)));
    if (glint > 0 && len > loopLen + insideLen) end.push(cord([back16, tipAt], 'gold', lerp(0.6, 1, glint)));
    hook.push(cord(slice(route.all, 0, Math.min(len, loopLen))));
    if (len > loopLen) endInside.push(cord(slice(route.all, loopLen, Math.min(len, loopLen + insideLen)), 'back'));
    if (len > loopLen + insideLen) end.push(cord(slice(route.all, loopLen + insideLen, len)));
  }
  under.push(...endInside);
  under.push(...left.under);
  under.push(bottomString(g, tail));
  under.push(...theX(g, gold));
  for (const pts of front) under.push(cord(pts));
  under.push(...hook);
  /** @type {Item[]} */
  const over = [...left.over, ...end];
  return { under, over, tipAt };
}

/** How far knot 2's finger slides in under the X (its cuff starts just inside the safe box, framed). */
const FINGER_SLIDE = 170;
/** The right hand's first hold on the end, before it starts wrapping: up and toward the fingertip, the way the top string crossed. */
const START_HOLD = /** @type {Pt} */ ([904, 202]);
const START_ROT = -20 - PINCH_BODY_DEG;

/**
 * Step 9: the finger slides in under the X with the bottom string lying
 * along it, then the right hand wraps the top string under and around the
 * finger and that string three times.
 * @param {number} p @returns {Item[]}
 */
function wrapStep(p) {
  const g = G0;
  // A short slide, from inside the stage: in the loop the step's chip sits
  // over the stage's left edge, and a hand coming in from off the stage
  // seemed to grow out of it. The tip still starts left of the X.
  const slide = easeOut(seg(p, 0, 0.22));
  const dx = lerp(-FINGER_SLIDE, 0, slide);
  // p is already at a child's pace (stepProgress); easing it again bunched
  // the wraps together, so they run evenly here.
  const w = seg(p, 0.3, 0.9);
  const uTip = lerp(-0.5, WRAPS, w);
  const { front, back } = wraps(g, uTip);
  const h = holdAt(g, uTip);
  const reach = easeInOut(seg(p, 0.18, 0.3));
  const settle = easeInOut(seg(p, 0.9, 1));
  const at = mix(mix(START_HOLD, h.hand, reach), REST.hand, settle);
  const hold = rightHand(at, lerp(lerp(START_ROT, h.rot, reach), REST.rot, settle));
  // The held end is always a front cord: the finger already hides whatever
  // part of it is behind (switching its tone flickered).
  // (the tip's gold rim fades as the hand settles: held at rest, the fingers
  // cover the tip and leave only a stray gold crescent)
  const held = heldEnd(h.tip, at, 1 - settle);
  const behind = reach >= 1 && h.behind;

  /** @type {Item[]} */
  const items = hangingBracelet(g);
  for (const pts of back) items.push(cord(pts, 'back'));
  if (behind) items.push(...held.items, hold);
  items.push(fingerHand({ dx }));
  items.push(bottomString(g, BOTTOM_TAIL));
  items.push(...theX(g, 0));
  for (const pts of front) items.push(cord(pts));
  if (!behind) items.push(...held.items, hold);
  items.push(...wrapCounters(g, uTip));
  return items;
}

/**
 * Step 10: see the X? It lights up and a ring pulses out of it twice.
 * @param {number} p @returns {Item[]}
 */
function xStep(p) {
  const g = G0;
  const gold = seg(p, 0.12, 0.42);
  // The X's gold is the story here; the end's gold rim comes back as the end
  // leaves the hand to be threaded (step 12).
  const k = wrappedKnot(g, { gold, glint: 0 });
  /** @type {Item[]} */
  // Two pops over the X as it lights, behind everything; never a ring round
  // it, even a passing one: a ring round an X reads as "no", and the room
  // read it as "your X is wrong". The resting picture is the gold X alone.
  const items = [
    ...landingPop(p, 0.26, g.cross[0], g.cross[1] - R0 - 34, { seed: 10, size: 1.1, len: 0.26 }),
    ...landingPop(p, 0.5, g.cross[0], g.cross[1] - R0 - 34, { seed: 11, size: 1.1, len: 0.26 }),
    ...k.under, ...k.over,
  ];
  items.push(rightHand(REST.hand, REST.rot));
  // The counters fade.
  if (p < 0.3) items.push(...wrapCounters(g, WRAPS, 1 - seg(p, 0, 0.3)));
  return items;
}

/** How far the left hand draws back as the pointer slides out. */
const DRAW_BACK = 30;

/**
 * Step 11: the left thumb and middle finger pinch the loops; the pointer
 * slides out of them.
 * @param {number} p @returns {Item[]}
 */
function pinchStep(p) {
  const g = G0;
  const grip = easeInOut(seg(p, 0.06, 0.32));
  const slide = easeInOut(seg(p, 0.38, 0.86));
  const hand = { dx: -DRAW_BACK * slide, ext: 1 - slide, grip };
  const k = wrappedKnot(g, { left: leftHand(hand), gold: 1 - seg(p, 0, 0.1), glint: 0 });
  /** @type {Item[]} */
  const items = [...k.under, ...k.over, rightHand(REST.hand, REST.rot)];
  if (p > 0.34 && p < 0.94) {
    // Which way the finger goes: out, back toward the hand.
    const o = Math.min(seg(p, 0.34, 0.42), 1 - seg(p, 0.86, 0.94));
    items.push(arrow([[g.x1 + 6, FY + 104], [g.xe - 120, FY + 104]], o));
  }
  return items;
}

/** The left hand once the pointer is out: the loops pinched. */
const PINCHED = { dx: -DRAW_BACK, ext: 0, grip: 1 };

/**
 * Step 12: the right hand pushes the end in at the tunnel's knuckle end and,
 * once it is through, takes it at the far side and pulls it out past the X.
 * @param {number} p @returns {Item[]}
 */
function threadStep(p) {
  const g = G0;
  const L = ROUTE_LEN;
  // The tip's way along its route: round the hook to the tunnel's mouth, fed
  // through the tunnel, then pulled out.
  const round = easeInOut(seg(p, 0, 0.16));
  const feed = easeInOut(seg(p, 0.16, 0.56));
  const pull = easeInOut(seg(p, 0.8, 1));
  const outAt = L.loop + L.inside + 30;
  const len = p < 0.16 ? lerp(L.rest, L.loop, round) : p < 0.8 ? lerp(L.loop, outAt, feed) : lerp(outAt, L.total, pull);
  // The tip's gold rim comes back as it leaves the fingers for the tunnel.
  const k = wrappedKnot(g, { left: leftHand(PINCHED), threaded: len, glint: seg(p, 0, 0.1) });

  // The right hand: behind the tip round the hook, feeding it in at the
  // mouth, then up and over the loops to the far side, where it takes the
  // tip and pulls.
  const feedAt = alongPt(ROUTE.all, lerp(L.loop - TIP_LEAD, L.loop - 14, feed));
  const takeAt = alongPt(ROUTE.all, outAt - 10);
  /** @type {Pt} */
  let at;
  let rot;
  let gap = 20;
  if (p < 0.56) {
    at = p < 0.16 ? alongPt(ROUTE.all, len - TIP_LEAD) : feedAt;
    rot = lerp(REST.rot, 40 - PINCH_BODY_DEG, easeInOut(seg(p, 0, 0.2)));
  } else if (p < 0.8) {
    const hop = easeInOut(seg(p, 0.56, 0.74));
    const lift = Math.sin(Math.PI * hop) * 110;
    at = [lerp(feedAt[0], takeAt[0], hop), lerp(feedAt[1], takeAt[1], hop) - lift];
    rot = lerp(40, 0, hop) - PINCH_BODY_DEG;
    gap = lerp(20, 44, Math.sin(Math.PI * seg(p, 0.56, 0.8)));
  } else {
    at = alongPt(ROUTE.all, len - 10);
    rot = -PINCH_BODY_DEG;
  }
  /** @type {Item[]} */
  const items = [...k.under, ...k.over, rightHand(at, rot, gap)];
  // A guide ahead of the end: the way it goes.
  if (p < 0.8 && L.total - len > 40) {
    const o = Math.min(seg(p, 0, 0.08), 1 - seg(p, 0.64, 0.78));
    items.push(arrow(slice(ROUTE.all, len + 18, L.total - 6), o));
  }
  return items;
}

/**
 * The left hand's layers for a pose: gripping, its thumb and middle finger
 * are drawn over the loops they pinch.
 * @param {{ dx?: number, ext?: number, grip?: number }} h
 * @returns {{ under: GloveItem[], over: GloveItem[] }}
 */
function leftHand(h) {
  if (h.grip && h.grip > 0) return { under: [fingerHand(h, 'hand')], over: [fingerHand(h, 'grip')] };
  return { under: [fingerHand(h)], over: [] };
}

/**
 * Step 13: pull tight. The left hand lets go of the loops and takes the
 * bottom string; the right hand closes round the end; both pull, the wraps
 * cinch, a pop.
 * @param {number} p @returns {Item[]}
 */
function pullStep(p) {
  const tight = easeInOut(seg(p, 0.16, 0.7));
  const g = knotGeom(lerp(R0, 22, tight), lerp(PITCH0, 25, tight), lerp(GAP0, 8, tight));
  const jerk = Math.sin(Math.PI * seg(p, 0.66, 0.82)) * 16;

  // The right hand already has the end: it turns its grip and closes into a
  // fist round it (the pinch fades into the fist, its palm kept, which draws
  // the end into the fist), then pulls.
  const grab = easeInOut(seg(p, 0, 0.14));
  const close = seg(p, 0.12, 0.12 + 2 * FADE);
  const pinchAt = alongPt(ROUTE.all, ROUTE_LEN.total - 10);
  const catchPalm = palmOf(glove(pinchAt[0], pinchAt[1], 'pinch', { gap: 12, s: 0.86, rot: -32 }));
  /** @type {Pt} */
  const end = close < 1 ? mix(THREAD_OUT, catchPalm, easeInOut(close))
    : [lerp(catchPalm[0], 1080, tight) + jerk, lerp(catchPalm[1], FY, tight)];
  // Pulled through, the end's hook outside the tunnel runs out.
  const route = threadRoute(g, end, lerp(1, 0.12, tight));

  // The left hand lets go of the loops, draws back to the bottom string and
  // closes round it (the open hand fades into the fist), then pulls the
  // other way. The string's tail runs on out of the fist.
  const letGo = easeInOut(seg(p, 0, 0.06));
  const move = easeInOut(seg(p, 0.05, 0.13));
  const lx = lerp(BOTTOM_TAIL[0] + 70, 450, tight) - jerk;
  /** @type {Pt} */
  const tail = [lx - 70, lerp(BOTTOM_TAIL[1], FY, tight)];
  const lFist = glove(lx, lerp(G0.along + 6, FY, tight), 'pull', { id: 'finger', rot: 90, s: 0.92, flip: true });
  const released = fingerHand({ ...PINCHED, grip: 0 });
  const lPoint = gloveByPalm(mix(palmOf(released), palmOf(lFist), move), 'point', {
    id: 'finger', rot: 90, s: lerp(HAND_S, 0.92, move), flip: true, reach: HAND_REACH,
  });
  const fistIn = seg(p, 0.12, 0.12 + FADE);
  /** @type {{ under: GloveItem[], over: GloveItem[] }} */
  let left;
  if (p < 0.05) left = leftHand({ ...PINCHED, grip: 1 - letGo });
  else if (fistIn <= 0) left = { under: [{ ...lPoint, ext: 0 }], over: [] };
  else {
    // The fading open hand stays under the strings; the fist, round the
    // bottom string, is over them.
    const [a, b] = crossfade({ ...lPoint, ext: 0 }, lFist, fistIn);
    left = b ? { under: [a], over: [b] } : { under: [], over: [a] };
  }

  /** @type {Item[]} */
  const items = [];
  // The pop, when the wraps bite: behind the knot it celebrates.
  const knotX = (g.xe + XC + g.R) / 2;
  if (p >= 0.66 && p < 0.9) {
    const e = seg(p, 0.66, 0.9);
    items.push(fx('ring', knotX, FY, lerp(30, 180, easeOut(e)), 1 - e, WHITE));
    items.push(fx('ring', knotX, FY, lerp(20, 124, easeOut(e)), (1 - e) * 0.9, SUN));
  }
  items.push(...landingPop(p, 0.68, knotX, FY, { seed: 13, size: 1.3, len: 0.2 }));
  const k = wrappedKnot(g, { left, threaded: polyLength(route.all), route, tail });
  items.push(...k.under, ...k.over);
  const rPinch = glove(pinchAt[0], pinchAt[1], 'pinch', { id: 'right', gap: lerp(20, 12, grab), s: lerp(RIGHT_S, 0.86, grab), rot: lerp(-PINCH_BODY_DEG, -32, grab) });
  const rFist = gloveByPalm(close < 1 ? catchPalm : end, 'pull', { id: 'right', rot: -90, s: 0.86 });
  items.push(...crossfade(rPinch, rFist, seg(close, 0.25, 0.75)));
  return items;
}

// ── The steps, by index ──────────────────────────────────────

const BUILDERS = [
  (/** @type {number} */ p) => beadStep(0, p),
  (/** @type {number} */ p) => beadStep(1, p),
  (/** @type {number} */ p) => beadStep(2, p),
  (/** @type {number} */ p) => beadStep(3, p),
  (/** @type {number} */ p) => beadStep(4, p),
  (/** @type {number} */ p) => beadStep(5, p),
  finishStep,
  crossStep,
  wrapStep,
  xStep,
  pinchStep,
  threadStep,
  pullStep,
];

export const STEP_COUNT = BUILDERS.length;

/** @param {number} stepIndex */
const stepOf = (stepIndex) => clamp(Math.round(Number.isFinite(stepIndex) ? stepIndex : 0), 0, STEP_COUNT - 1);
/** @param {number} p */
const progressOf = (p) => (Number.isFinite(p) ? clamp01(p) : 1);

/**
 * How long step i's action takes in the one-step loop, in seconds, at a
 * child's pace; it then holds its finished picture for the rest of its slot
 * (lib/bracelets.js STEP_SLOTS; a test keeps a hold of at least 3 s).
 */
const ACTION_SEC = Object.freeze([6, 6, 6, 6, 6, 6, 10, 9, 11.5, 7, 9.5, 11.5, 9.5]);

/** @param {number} stepIndex */
export function actionSec(stepIndex) {
  return ACTION_SEC[stepOf(stepIndex)];
}

/**
 * The step loop's action progress: 0 at 0 s, a child's pace through the
 * action, then 1 (the finished step) until the loop ends.
 * @param {number} stepIndex @param {number} secondsIntoStep
 */
export function stepProgress(stepIndex, secondsIntoStep) {
  const t = Number(secondsIntoStep);
  if (!(t > 0)) return 0;
  const len = actionSec(stepIndex);
  if (t >= len) return 1;
  return pace(t / len);
}

/**
 * The picture a still stage shows for step i (low power, animations off,
 * the overview): the finished step, or, where the step is a move, its key
 * frame with the guide arrow up: knot 1's X just made (the left end over
 * the right, the fists apart; halfway across, at 0.7, the two fists were one
 * clump over the crossing), knot 4's finger coming out, knot 5's end in the
 * tunnel.
 */
const STILL_P = /** @type {Readonly<Record<number, number>>} */ (Object.freeze({ 7: 0.87, 10: 0.62, 11: 0.34 }));
/** @param {number} stepIndex */
export const stillP = (stepIndex) => STILL_P[stepOf(stepIndex)] ?? 1;

/**
 * Step `stepIndex` (0..12) at action progress p, as a display list.
 * @param {number} stepIndex @param {number} p @returns {Item[]}
 */
export function sceneFor(stepIndex, p) {
  return BUILDERS[stepOf(stepIndex)](progressOf(p));
}

// ── The intro and the finale ─────────────────────────────────

const POT_Y = 428;

/**
 * The opening: the title first (the caption under the stage says nothing
 * while it is up), then the empty cord across the table and the bead pots.
 * @param {number} p @returns {Item[]}
 */
export function introScene(p) {
  const q = progressOf(p);
  /** @type {Item[]} */
  const items = [];
  // The title's pops sit behind its letters.
  items.push(...landingPop(q, 0.2, ROW_CX - 380, 116, { seed: 21 }));
  items.push(...landingPop(q, 0.24, ROW_CX + 380, 116, { seed: 22 }));
  const title = seg(q, 0.04, 0.26);
  if (title > 0) items.push(text(ROW_CX, 132, 'BRACELET TIME!', 104, { s: lerp(1.5, 1, backOut(title)), o: easeOut(Math.min(1, title * 2)) }));
  // The empty cord lies on the table from the first frame.
  items.push(cord([[ROW_L, ROW_Y], [ROW_R, ROW_Y]]));
  const colors = /** @type {BeadColor[]} */ ([...BEAD_ORDER, 'clear']);
  colors.forEach((color, i) => {
    const at = 0.34 + i * 0.07;
    if (q < at) return;
    const s = backOut(seg(q, at, at + 0.16));
    items.push({ kind: 'pot', x: r1(ROW_CX + (i - 3) * 152), y: POT_Y, s: r1(s * 1000) / 1000, color });
  });
  return items;
}

const FIN = { cx: 470, cy: 314, r: 140 };
// Seeded, so the confetti falls the same way on every screen.
const FINALE_CONFETTI = (() => {
  const rand = mulberry32(2026_0930);
  const colors = [SUN, WHITE, ...BEAD_ORDER.filter((c) => c !== 'black').map((c) => BEAD_TONES[c].light)];
  return Array.from({ length: 16 }, (_, i) => ({
    x: 700 + rand() * 720,
    to: 300 + rand() * 240,
    at: 0.42 + (i / 16) * 0.2,
    size: 9 + rand() * 9,
    wobble: 0.6 + rand() * 0.9,
    spin: (rand() - 0.5) * 540,
    color: colors[i % colors.length],
  }));
})();
const FIN_KNOT_DEG = -30; // where the sliding knot sits on the loop (clear of the hand, so its wraps and tails show)

/**
 * The finale: the finished bracelet held up, sparkles, YOUR TURN!
 * @param {number} p @returns {Item[]}
 */
export function finaleScene(p) {
  const q = progressOf(p);
  const rise = easeOut(seg(q, 0, 0.3));
  const swing = Math.sin(TAU * 1.5 * seg(q, 0, 0.8)) * 12 * (1 - seg(q, 0, 0.8));
  const lift = lerp(200, 0, rise);
  /** @type {Pt} */
  const pivot = [FIN.cx, FIN.cy - FIN.r + lift];
  /** @param {Pt} pt @returns {Pt} */
  const place = (pt) => rotateAbout([pt[0], pt[1] + lift], pivot, swing);
  /** @param {number} deg @param {number} [r] @returns {Pt} */
  const onLoop = (deg, r = FIN.r) => place([FIN.cx + r * Math.cos(deg / DEG), FIN.cy + r * Math.sin(deg / DEG)]);

  /** @type {Item[]} */
  const items = [];
  // The loop of cord.
  /** @type {Pt[]} */
  const ring = [];
  for (let i = 0; i <= 44; i += 1) ring.push(onLoop(-90 + (i / 44) * 360));
  items.push(cord(ring));
  // The beads ride the bottom of the loop.
  const s = 0.7;
  const step = ((SLOT_PITCH * s) / FIN.r) * DEG;
  BRACELET_ROW.forEach((color, k) => {
    const deg = 90 - (k - 3.5) * step;
    const [x, y] = onLoop(deg);
    items.push(bead(x, y, color, { rot: deg - 90 + swing, s }));
  });
  for (const side of [-1, 1]) {
    const deg = 90 - side * ((3.5 * SLOT_PITCH + KNOT_OFF) * s / FIN.r) * DEG;
    const [x, y] = onLoop(deg);
    items.push(knot(x, y, s * KNOT_S, deg - 90 + swing));
  }
  // The sliding knot: three tight wraps across the loop, and its two tails.
  const kd = FIN_KNOT_DEG;
  const tangent = kd + 90;
  const tx = Math.cos(tangent / DEG);
  const ty = Math.sin(tangent / DEG);
  const [kx, ky] = [FIN.cx + FIN.r * Math.cos(kd / DEG), FIN.cy + FIN.r * Math.sin(kd / DEG)];
  for (const side of [-1, 1]) {
    // Each tail leaves the knot along the loop, then peels outward.
    const out = [kx + side * tx * 40, ky + side * ty * 40];
    const nx = Math.cos(kd / DEG);
    const ny = Math.sin(kd / DEG);
    items.push(cord([place(/** @type {Pt} */ (out)), place([out[0] + side * tx * 30 + nx * 26, out[1] + side * ty * 30 + ny * 26]), place([out[0] + side * tx * 44 + nx * 62, out[1] + side * ty * 44 + ny * 62])]));
  }
  for (let i = 0; i < 3; i += 1) {
    const along = (i - 1) * 24;
    const cx = kx + tx * along;
    const cy = ky + ty * along;
    const nx = Math.cos(kd / DEG);
    const ny = Math.sin(kd / DEG);
    items.push(cord([place([cx - nx * 20 - tx * 8, cy - ny * 20 - ty * 8]), place([cx + nx * 20 + tx * 8, cy + ny * 20 + ty * 8])]));
  }
  // Held up at the top of the loop. (The sparkles below are drawn under the
  // hand and the words: on top, they landed on the glove and on YOUR's R.)
  const handAt = items.length;
  items.push(glove(pivot[0], pivot[1], 'pinch', { id: 'right', gap: 30, s: 0.72, rot: -44 }));

  // The words, each landing with a pop at its outer end (behind the letters).
  items.push(...landingPop(q, 0.5, 836, 196, { seed: 31, size: 1.2, len: 0.2 }));
  items.push(...landingPop(q, 0.6, 1290, 396, { seed: 32, size: 1.2, len: 0.2 }));
  const slam = seg(q, 0.34, 0.52);
  if (slam > 0) {
    items.push(text(1050, 214, 'YOUR', 150, { s: lerp(1.8, 1, backOut(slam)), o: easeOut(Math.min(1, slam * 3)), rot: lerp(-8, -4, slam) }));
  }
  const slam2 = seg(q, 0.44, 0.62);
  if (slam2 > 0) {
    items.push(text(1060, 382, 'TURN!', 150, { s: lerp(1.8, 1, backOut(slam2)), o: easeOut(Math.min(1, slam2 * 3)), rot: lerp(6, 3, slam2) }));
  }

  // Sparkles: a burst round the bracelet as it arrives, a spray round the
  // words as they land, and four that stay.
  /** @type {Item[]} */
  const sparks = [];
  if (q > 0.24 && q < 0.7) {
    const e = seg(q, 0.24, 0.7);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * TAU + 0.3;
      const d = lerp(FIN.r * 0.9, FIN.r * 1.7, easeOut(e));
      const colors = [SUN, WHITE, BEAD_TONES.red.tone, BEAD_TONES.blue.light, BEAD_TONES.green.light];
      sparks.push(fx('sparkle', FIN.cx + Math.cos(a) * d, FIN.cy + Math.sin(a) * d * 0.8, lerp(22, 10, e), 1 - e, colors[i % colors.length], 200 * e));
    }
  }
  // Confetti in the bead colours drifts down past the words, gone by the rest.
  for (const c of FINALE_CONFETTI) {
    const t = seg(q, c.at, c.at + 0.36);
    if (t <= 0 || t >= 1) continue;
    const y = lerp(-30, c.to, easeOut(t));
    const x = c.x + Math.sin(t * TAU * c.wobble) * 22;
    sparks.push(fx('sparkle', x, y, c.size, 1 - t * t, c.color, c.spin * t));
  }
  const stay = easeOut(seg(q, 0.6, 0.8));
  if (stay > 0) {
    for (const [x, y, sz, c] of /** @type {[number, number, number, string][]} */ ([[742, 150, 26, SUN], [1350, 250, 20, WHITE], [760, 454, 18, WHITE], [1336, 460, 28, SUN]])) {
      sparks.push(fx('sparkle', x, y, sz * stay, 1, c, 0));
    }
  }
  items.splice(handAt, 0, ...sparks);
  return items;
}

// ── The epic: all 13 steps in 90 seconds ─────────────────────

export const EPIC_SEC = 90;

/** @typedef {{ kind: 'intro' | 'step' | 'finale', step?: number, start: number, end: number }} EpicBeat */

// The intro, the six bead steps, step 7, the six knot steps, the finale:
// the time goes where the hands have the most to do (the wraps and the
// push), and the X, which is only a look, is quick.
const BEAT_LENGTHS = [4, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 7, 7, 9.5, 4.5, 7.5, 10, 7.5, 6];
/** A step beat's action starts this long after the beat does, and ends this long before it, so every step is seen finished. */
const EPIC_LEAD = 0.25;
const EPIC_HOLD = 1.1;

/** The epic's beats, in order, covering 0..EPIC_SEC exactly. */
export const EPIC_BEATS = /** @type {readonly EpicBeat[]} */ (Object.freeze((() => {
  /** @type {EpicBeat[]} */
  const out = [];
  let t = 0;
  BEAT_LENGTHS.forEach((len, i) => {
    const start = t;
    t = i === BEAT_LENGTHS.length - 1 ? EPIC_SEC : Math.round((t + len) * 100) / 100;
    if (i === 0) out.push(Object.freeze({ kind: 'intro', start, end: t }));
    else if (i === BEAT_LENGTHS.length - 1) out.push(Object.freeze({ kind: 'finale', start, end: t }));
    else out.push(Object.freeze({ kind: 'step', step: i - 1, start, end: t }));
  });
  return out;
})()));

/** @param {number} sec */
function beatAt(sec) {
  return EPIC_BEATS.find((b) => sec >= b.start && sec < b.end) ?? EPIC_BEATS[EPIC_BEATS.length - 1];
}

/**
 * The camera that puts stage point (x, y) in the middle of the view at zoom
 * s, as the translate-then-scale StepArt applies. It never lets the view
 * leave the stage (clamped after rounding, so the rounding cannot open a
 * sliver past the edge either), and is rounded finely: at 0.001 a slow push
 * stalled for frames, then ticked.
 * @param {number} x @param {number} y @param {number} s
 */
function lookAt(x, y, s) {
  const scale = Math.max(1, Math.round(s * 1e5) / 1e5);
  const tx = clamp(Math.round((STAGE_W / 2 - scale * x) * 100) / 100, STAGE_W - STAGE_W * scale, 0);
  const ty = clamp(Math.round((STAGE_H / 2 - scale * y) * 100) / 100, STAGE_H - STAGE_H * scale, 0);
  return { x: Math.round(tx * 1000) / 1000, y: Math.round(ty * 1000) / 1000, scale };
}

// ── The step loop's framing ──────────────────────────────────
// One step at a time, the camera frames each step's action so it fills the
// stage (lens C U1): the bead steps a little closer on the whole row, then,
// once the bead has landed, in on the row and the pointing hand; the knot
// close-up closer on the knot, and in on the cinch as it is pulled tight.
// Keys are (p, x, y, s), eased between. The stills and the overview use the
// same framing, so every picture is the one the loop rests on.

/** @typedef {{ p: number, x: number, y: number, s: number }} FrameKey */

const KNOT_FRAME = { x: 757, y: 276, s: 1.12 };
/** Bead step k's resting frame: in on the row and the hand pointing at the new bead. @param {number} k */
const beadRest = (k) => ({ x: 574 + 39 * k, y: 358, s: 1.45 });
const BEAD_WIDE = { x: 910, y: 330, s: 1.15 };
/** @type {readonly (readonly FrameKey[])[]} */
const STEP_FRAMES = Object.freeze([
  // Each bead step starts where the last one rested (the stage plays straight
  // on from step to step), eases out to the whole row while the old hand goes
  // and the new bead comes, then comes in on the new bead once it has landed.
  ...BEAD_ORDER.map((_, k) => Object.freeze([
    ...(k > 0 ? [{ p: 0, ...beadRest(k - 1) }, { p: 0.12, ...BEAD_WIDE }] : []),
    { p: 0.84, ...BEAD_WIDE },
    { p: 0.98, ...beadRest(k) },
  ])),
  Object.freeze([{ p: 0, ...beadRest(5) }, { p: 0.1, x: 730, y: 280, s: 1 }]),
  Object.freeze([{ p: 0, x: 730, y: 280, s: 1 }]),
  ...[8, 9, 10, 11].map(() => Object.freeze([{ p: 0, ...KNOT_FRAME }])),
  Object.freeze([{ p: 0.3, ...KNOT_FRAME }, { p: 0.72, x: 762, y: 322, s: 1.28 }]),
]);

// ── The epic's camera ────────────────────────────────────────
// Look-at keys: (x, y) is the stage point in the middle of the view, s the
// zoom. Between keys it eases (smoothstep); a key marked `cut` is a jump,
// used only where the picture itself cuts to a new composition, so the cut
// reads as an edit, not a pop (lens B N1): the bead table after the intro,
// the close-up after knot 1, the finale.
//
// - Beads: the whole row while a bead flies in, a push in on it and the hand
//   pointing at it as it lands, and a pull back to the row as the next one
//   comes (lens C U5).
// - Knot 1 comes in on its X, and the close-up opens with its own X on the
//   same spot of the screen: a match cut. Both frames keep every hand, bead
//   and knot inside the safe box (MATCH_AT, knot 1's shallower U).
// - The close-up is never closer than KNOT_ZOOM, so the bracelet hanging
//   below it stays whole (lens B N4); it pans with the work instead. Knot 6
//   pushes in on the cinch and the camera jolts once as it bites (SHAKE).

/** @typedef {{ t: number, x: number, y: number, s: number, cut?: boolean }} CameraKey */

/** The epic time at which step beat b's action reaches progress p (epicShot's pacing, inverted). @param {number} b @param {number} p */
function beatTime(b, p) {
  const beat = EPIC_BEATS[b];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (pace(mid) < p) lo = mid;
    else hi = mid;
  }
  return beat.start + EPIC_LEAD + ((lo + hi) / 2) * (beat.end - beat.start - EPIC_LEAD - EPIC_HOLD);
}

/** Bead k's resting frame in the epic: the loop's, a touch wider, so the push in and the pull back fit a 4.5 s beat. @param {number} k */
const epicBeadRest = (k) => ({ ...beadRest(k), s: 1.38 });
/** Where knot 1's X crosses (its two strands at p = 1, as crossStep draws them). */
export const KNOT1_X = /** @type {Readonly<Pt>} */ (Object.freeze([943.2, 254.1]));
/**
 * The screen point both X's sit on across the match cut, solved for the most
 * room: from it, knot 1's frame at 1.07 and the close-up's at 1.147 both hold
 * every hand, bead and knot inside the safe box (the close-up's finger
 * included, which slides in just after the cut).
 */
const MATCH_AT = /** @type {Pt} */ ([907.9, 258.3]);
/** The look-at that puts stage point X on screen point P at zoom s. @param {Readonly<Pt>} X @param {number} s */
const matchFrame = (X, s) => ({ x: X[0] - (MATCH_AT[0] - STAGE_W / 2) / s, y: X[1] - (MATCH_AT[1] - STAGE_H / 2) / s, s });
/** The close-up's closest zoom that keeps the hanging bracelet and the finger whole (its picture is 382 of the safe box's 440 high). */
const KNOT_ZOOM = 1.14;

/** @type {CameraKey[]} */
const CAMERA_KEYS = (() => {
  /** @type {CameraKey[]} */
  const keys = [
    { t: 0, x: 730, y: 280, s: 1 },
    { t: 3.6, x: 730, y: 290, s: 1.04 },
  ];
  // Beads: cut to the whole row as the table appears; then each bead flies
  // in on the row, the camera pushes in on it as it lands, and stays while
  // the pointing hand goes before it pulls back for the next one.
  for (let k = 0; k < 6; k += 1) {
    const b = EPIC_BEATS[k + 1];
    const land = beatTime(k + 1, 0.84);
    if (k === 0) keys.push({ t: b.start, ...BEAD_WIDE, cut: true });
    else keys.push({ t: b.start + 0.2, ...epicBeadRest(k - 1) }, { t: b.start + 1.7, ...BEAD_WIDE });
    keys.push({ t: land, ...BEAD_WIDE }, { t: land + 1.65, ...epicBeadRest(k) }, { t: b.end, ...epicBeadRest(k) });
  }
  // Step 7: back out to the whole stage as the open hands come in.
  const s7 = EPIC_BEATS[7];
  keys.push({ t: s7.start + 2.6, x: 730, y: 280, s: 1 }, { t: s7.end, x: 730, y: 300, s: 1.03 });
  // Knot 1: the whole stage while the ends cross, then in on the X once the
  // arrow has gone.
  const s8 = EPIC_BEATS[8];
  const m1 = matchFrame(KNOT1_X, 1.07);
  keys.push({ t: s8.start + 0.8, x: 730, y: 290, s: 1 }, { t: beatTime(8, 0.88), x: 730, y: 290, s: 1 });
  keys.push({ t: s8.end - 0.3, ...m1 });
  // Knot 2: the match cut, then over to the whole close-up before the
  // wrapping hand first swings over the top.
  const s9 = EPIC_BEATS[9];
  keys.push({ t: s9.start, ...matchFrame(G0.cross, 1.147), cut: true });
  keys.push({ t: beatTime(9, 0.25), ...KNOT_FRAME }, { t: s9.end, ...KNOT_FRAME, x: 745 });
  // Knot 3: in on the X, as close as the bracelet allows.
  const s10 = EPIC_BEATS[10];
  keys.push({ t: s10.start + 0.6, x: 757, y: 278, s: 1.13 }, { t: beatTime(10, 0.6), x: 780, y: 280, s: KNOT_ZOOM }, { t: s10.end, x: 776, y: 280, s: KNOT_ZOOM });
  // Knot 4: back over the pinching hand. Knot 5 opens a touch wider, which
  // holds the right hand as it swings high to take the end, then drifts
  // right with the end as it is pushed through and pulled out.
  const s11 = EPIC_BEATS[11];
  keys.push({ t: s11.start + 1.6, ...KNOT_FRAME, x: 752 }, { t: s11.end, ...KNOT_FRAME, x: 745 });
  const s12 = EPIC_BEATS[12];
  keys.push({ t: s12.start + 1, x: 750, y: 271, s: 1.1 }, { t: beatTime(12, 0.09), x: 750, y: 271, s: 1.1 });
  keys.push({ t: beatTime(12, 0.3), ...KNOT_FRAME, x: 752 }, { t: s12.end, ...KNOT_FRAME, x: 770 });
  // Knot 6: in on the cinch as it is pulled tight (the loop's framing), and
  // held there to the cut.
  keys.push({ t: beatTime(13, 0.3), ...KNOT_FRAME }, { t: beatTime(13, 0.72), x: 762, y: 322, s: 1.28 });
  const fin = EPIC_BEATS[14];
  keys.push({ t: fin.start, x: 730, y: 280, s: 1.08, cut: true }, { t: fin.start + 1.6, x: 730, y: 280, s: 1 }, { t: EPIC_SEC, x: 730, y: 280, s: 1.03 });
  return keys;
})();
/**
 * The jolt when knot 6's wraps bite (pullStep's jerk and rings): screen px
 * each way, decaying to nothing over `len` seconds, so it is over long before
 * the beat's finished picture.
 */
const SHAKE = Object.freeze({ at: beatTime(13, 0.66), len: 0.6, x: 6, y: 4, hz: 7, decay: 0.2 });

/**
 * The camera at `sec`, as the translate-then-scale StepArt applies.
 * @param {number} sec
 */
function cameraAt(sec) {
  const keys = CAMERA_KEYS;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= sec) i += 1;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  let x = a.x;
  let y = a.y;
  let s = a.s;
  if (b !== a && !b.cut && b.t > a.t) {
    // Smoothstep: a camera eases more gently than the action does.
    const u = seg(sec, a.t, b.t);
    const t = u * u * (3 - 2 * u);
    x = lerp(a.x, b.x, t);
    y = lerp(a.y, b.y, t);
    s = lerp(a.s, b.s, t);
  }
  const since = sec - SHAKE.at;
  if (since > 0 && since < SHAKE.len) {
    const e = Math.exp(-since / SHAKE.decay) * (1 - since / SHAKE.len);
    x += (SHAKE.x * e * Math.sin(TAU * SHAKE.hz * since)) / s;
    y += (SHAKE.y * e * Math.sin(TAU * SHAKE.hz * since + 1.3)) / s;
  }
  return lookAt(x, y, s);
}

/**
 * The framing of step i's still (low power, animations off, the overview):
 * the loop's own, except step 7, whose finished row (clear beads, knots)
 * the still shows close up, as big as the bead steps' beside it, with the
 * open hands out of the frame (the loop itself keeps the whole stage).
 * @param {number} stepIndex
 */
export function stillFrame(stepIndex) {
  const i = stepOf(stepIndex);
  if (i === 6) return lookAt(ROW_CX, ROW_Y + 4, 1.7);
  return stepFrame(i, stillP(i));
}

/**
 * The step loop's camera for step i at action progress p.
 * @param {number} stepIndex @param {number} [p]
 */
export function stepFrame(stepIndex, p = 1) {
  const keys = STEP_FRAMES[stepOf(stepIndex)];
  const q = progressOf(p);
  let a = keys[0];
  let b = keys[0];
  for (const k of keys) {
    if (k.p <= q) a = k;
    if (k.p >= q) { b = k; break; }
    b = k;
  }
  const u = b.p > a.p ? seg(q, a.p, b.p) : 0;
  const t = u * u * (3 - 2 * u);
  return lookAt(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.s, b.s, t));
}

/**
 * The epic at `sec` seconds: its beat, the step it shows (null for the intro
 * and the finale), the action progress p (which reaches 1 before the beat
 * ends, so every step is seen finished) and the camera.
 * @param {number} sec
 */
export function epicShot(sec) {
  const t = Number.isFinite(sec) ? clamp(sec, 0, EPIC_SEC) : 0;
  if (sec >= EPIC_SEC) {
    const beat = EPIC_BEATS[EPIC_BEATS.length - 1];
    return { beat, step: null, p: 1, camera: cameraAt(EPIC_SEC) };
  }
  const beat = beatAt(t);
  const len = beat.end - beat.start;
  const lead = beat.kind === 'step' ? EPIC_LEAD : 0;
  const hold = beat.kind === 'step' ? EPIC_HOLD : 0.9;
  const local = (t - beat.start - lead) / (len - lead - hold);
  const p = beat.kind === 'step' ? pace(clamp01(local)) : clamp01(local);
  return { beat, step: beat.kind === 'step' ? /** @type {number} */ (beat.step) : null, p: Math.round(p * 10000) / 10000, camera: cameraAt(t) };
}

/**
 * The 0-based step the epic shows at `sec`, or null during the intro and finale.
 * @param {number} sec
 */
export function currentEpicStep(sec) {
  return epicShot(sec).step;
}

/**
 * The display list for any epic moment: the intro, a step, or the finale.
 * @param {'intro' | 'finale' | number} which @param {number} p
 * @returns {Item[]}
 */
export function sceneOf(which, p) {
  if (which === 'intro') return introScene(p);
  if (which === 'finale') return finaleScene(p);
  return sceneFor(which, p);
}

// ── Measuring the pictures ───────────────────────────────────
// The wall draws the stage through a soft mask (index.css .pj-bracelet__stage)
// that fades its outer 4% left and right and 8% top and bottom, so anything
// resting there seems to dissolve. Every hand, bead, knot, counter and arrow
// of a resting picture (and of a step's first frame) sits inside SAFE_BOX;
// hands only cross the fade on their way on or off the stage. The boxes below
// are measured from the same geometry StepArt draws.

/** @typedef {{ x0: number, y0: number, x1: number, y1: number }} Box */

const KNOT_HULL = /** @type {Pt[]} */ ([
  [-KNOT_SIZE.rx, -KNOT_SIZE.ry], [KNOT_SIZE.rx, -KNOT_SIZE.ry], [KNOT_SIZE.rx, KNOT_SIZE.ry], [-KNOT_SIZE.rx, KNOT_SIZE.ry],
]);

export const SAFE_BOX = /** @type {Readonly<Box>} */ (Object.freeze({ x0: 70, y0: 60, x1: 1390, y1: 500 }));

/** @param {Pt[]} pts @param {number} pad @returns {Box} */
function boxOf(pts, pad = 0) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/**
 * Points in an item's own frame, moved onto the stage.
 * @param {Pt[]} local @param {{ x: number, y: number, rot: number }} at @param {number} sx @param {number} sy
 * @returns {Pt[]}
 */
function placed(local, at, sx, sy) {
  const a = (at.rot || 0) / DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return local.map(([x, y]) => {
    const px = x * sx;
    const py = y * sy;
    return /** @type {Pt} */ ([at.x + px * c - py * s, at.y + px * s + py * c]);
  });
}

/** The outline of a glove part, in the glove's own frame, as points. @param {GlovePart} part @param {number} [o] @returns {Pt[]} */
function partHull(part, o = GLOVE_OUTLINE) {
  if (part.t === 'cap') {
    const r = part.w / 2 + o;
    return part.pts.flatMap(([x, y]) => [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]].map((q) => /** @type {Pt} */ (q)));
  }
  if (part.t === 'blob') {
    const cx = part.x + part.w / 2;
    const cy = part.y + part.h / 2;
    const corners = /** @type {Pt[]} */ ([[-part.w / 2 - o, -part.h / 2 - o], [part.w / 2 + o, -part.h / 2 - o], [part.w / 2 + o, part.h / 2 + o], [-part.w / 2 - o, part.h / 2 + o]]);
    return placed(corners, { x: cx, y: cy, rot: part.rot }, 1, 1);
  }
  if (part.t === 'bump') {
    const r = part.r + o;
    return [[part.cx - r, part.cy - r], [part.cx + r, part.cy + r]];
  }
  return part.pts.flatMap(([x, y]) => [[x - 4, y - 4], [x + 4, y + 4]].map((q) => /** @type {Pt} */ (q)));
}

/**
 * A glove's outline points on the stage (its parts' corners).
 * @param {GloveItem} g @returns {Pt[]}
 */
export function glovePoints(g) {
  const o = GLOVE_OUTLINE * lineWeight(g.s);
  const local = gloveParts(g.pose, g).flatMap((part) => partHull(part, o));
  return placed(local, g, g.flip ? -g.s : g.s, g.s);
}

/**
 * The stage box an item covers, from the geometry StepArt draws. Cords and
 * effects are measured too, loosely; null for anything without a shape.
 * @param {Item} item @returns {Box | null}
 */
export function itemBox(item) {
  switch (item.kind) {
    case 'glove': return boxOf(glovePoints(item));
    case 'bead': {
      const hw = BEAD_HALF.w + 2.5;
      const hh = BEAD_HALF.h + 2.5;
      return boxOf(placed([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], item, item.s * item.sx, item.s * item.sy));
    }
    case 'knot': return boxOf(placed(KNOT_HULL, item, item.s, item.s));
    case 'badge': return boxOf([[item.x, item.y]], 32.5 * item.s);
    case 'pot': return { x0: item.x - 66 * item.s, y0: item.y - 50 * item.s, x1: item.x + 66 * item.s, y1: item.y + 69 * item.s };
    case 'text': {
      const w = 0.62 * item.size * item.text.length * item.s;
      const h = 0.8 * item.size * item.s;
      return { x0: item.x - w / 2, y0: item.y - h / 2, x1: item.x + w / 2 + 7, y1: item.y + h / 2 + 8 };
    }
    case 'arrow': return boxOf(item.pts, 30);
    case 'cord': return boxOf(item.pts, 11 * item.w);
    case 'burst':
    case 'ring':
    case 'sparkle':
      return boxOf([[item.x, item.y]], item.s);
    default: return null;
  }
}

/** Is box `b` wholly inside `outer`? @param {Box} b @param {Box} outer */
export const boxInside = (b, outer) => b.x0 >= outer.x0 && b.y0 >= outer.y0 && b.x1 <= outer.x1 && b.y1 <= outer.y1;
/** Is box `b` wholly off the stage (so not seen at all)? @param {Box} b */
export const boxOffStage = (b) => b.x1 <= 0 || b.y1 <= 0 || b.x0 >= STAGE_W || b.y0 >= STAGE_H;
