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

/** One step's loop on the wall (lib/bracelets.js STEP_SEC; a test pins them together). */
export const LOOP_SEC = 10;

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
  clear: Object.freeze({ tone: 'rgba(214, 236, 255, 0.18)', light: 'rgba(255, 255, 255, 0.9)', dark: 'rgba(170, 205, 240, 0.4)' }),
}));

/** The six coloured beads in the order they go on (the handout's steps 1 to 6). */
export const BEAD_ORDER = /** @type {readonly BeadColor[]} */ (Object.freeze(['black', 'red', 'white', 'blue', 'green', 'yellow']));

/** The finished row, left to right (step 7). */
export const BRACELET_ROW = /** @type {readonly BeadColor[]} */ (Object.freeze(['clear', ...BEAD_ORDER, 'clear']));

/** The cartoon glove's pointer finger, in the glove's own units (StepArt draws it). */
export const GLOVE = Object.freeze({ fingerW: 48, pointReach: 128 });

/**
 * The pinch pose's hand body direction in the glove's own frame, degrees
 * (the fingertips pinch at the origin, the hand trails off down and right;
 * StepArt draws it that way). A mirrored (left) glove's body is at 180 - this.
 */
export const PINCH_BODY_DEG = 32;
const PINCH_BODY_DEG_FLIPPED = 180 - PINCH_BODY_DEG;
/** A left glove pinching the wraps with its hand trailing down and left. */
const PINCH_COIL_ROT = 125 - PINCH_BODY_DEG_FLIPPED;

/** `camera` is a plain translate-then-scale of the stage: {0, 0, 1} is no camera at all. */
export const IDENTITY_CAMERA = Object.freeze({ x: 0, y: 0, scale: 1 });

// ── Display list items ───────────────────────────────────────

/** @typedef {[number, number]} Pt */
/** @typedef {'open' | 'pinch' | 'point' | 'fist' | 'pull'} GlovePose */
/** @typedef {{ kind: 'cord', pts: Pt[], tone: 'front' | 'back' | 'gold', w: number }} CordItem */
/** @typedef {{ kind: 'bead', x: number, y: number, rot: number, s: number, sx: number, sy: number, color: BeadColor }} BeadItem */
/** @typedef {{ kind: 'glove', x: number, y: number, rot: number, s: number, pose: GlovePose, flip: boolean, gap: number, reach: number }} GloveItem */
/** @typedef {{ kind: 'knot', x: number, y: number, rot: number, s: number }} KnotItem */
/** @typedef {{ kind: 'pot', x: number, y: number, s: number, color: BeadColor }} PotItem */
/** @typedef {{ kind: 'text', x: number, y: number, s: number, rot: number, o: number, size: number, text: string }} TextItem */
/** @typedef {{ kind: 'badge', x: number, y: number, s: number, o: number, text: string }} BadgeItem */
/** @typedef {{ kind: 'burst' | 'ring' | 'sparkle', x: number, y: number, s: number, rot: number, o: number, color: string }} FxItem */
/** @typedef {{ kind: 'arrow', pts: Pt[], o: number }} ArrowItem */
/** @typedef {CordItem | BeadItem | GloveItem | KnotItem | PotItem | TextItem | BadgeItem | FxItem | ArrowItem} Item */

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
/** @param {number} t */
const easeIn = (t) => t * t * t;
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
 * A glove: `gap` is the pinch's opening, `reach` the pointer finger's length
 * (both in the glove's own units).
 * @param {number} x @param {number} y @param {GlovePose} pose
 * @param {{ rot?: number, s?: number, flip?: boolean, gap?: number, reach?: number }} [o]
 * @returns {GloveItem}
 */
const glove = (x, y, pose, { rot = 0, s = 1, flip = false, gap = 60, reach = GLOVE.pointReach } = {}) => ({
  kind: 'glove', x: r1(x), y: r1(y), rot: r1(fold(rot)), s: r1(s * 1000) / 1000, pose, flip, gap: r1(gap), reach: r1(reach),
});

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

/**
 * Where a carried bead is at p: in from off stage, lined up with the cord's
 * tip, threaded on, slid along to its slot, a squash as it lands.
 * @param {number} p
 * @param {{ from: Pt, entry: number, thread: number, to: number, t0: number, t1: number, t2: number, t3: number }} m
 */
function carriedBead(p, { from, entry, thread, to, t0, t1, t2, t3 }) {
  const dir = Math.sign(to - entry) || 1;
  const a = easeOut(seg(p, t0, t1));
  /** @type {Pt} */
  const ctrl = [entry - dir * 150, ROW_Y + 24];
  const u = 1 - a;
  let x = u * u * from[0] + 2 * u * a * ctrl[0] + a * a * entry;
  let y = u * u * from[1] + 2 * u * a * ctrl[1] + a * a * ROW_Y;
  let rot = -22 * dir * (1 - a);
  if (p > t1) {
    x = lerp(entry, thread, easeInOut(seg(p, t1, t2)));
    y = ROW_Y;
    rot = 4 * dir * Math.sin(Math.PI * seg(p, t1, t2));
  }
  if (p > t2) {
    x = lerp(thread, to, easeInOut(seg(p, t2, t3)));
    rot = 0;
  }
  const q = Math.sin(Math.PI * seg(p, t3, t3 + 0.09));
  return { x, y, rot, sx: 1 - 0.16 * q, sy: 1 + 0.08 * q };
}

/**
 * The glove that carries a bead, then lets go and points at it.
 * @param {number} p @param {{ x: number, y: number, rot: number }} b @param {number} tx
 * @param {number} release @param {boolean} left
 * @returns {GloveItem}
 */
function carrierGlove(p, b, tx, release, left) {
  if (p < release) return glove(b.x, b.y, 'pinch', { gap: BEAD_GAP, rot: b.rot, flip: left, s: 0.92 });
  const q = easeInOut(seg(p, release, 1));
  const side = left ? -1 : 1;
  if (q < 0.3) {
    const k = q / 0.3;
    return glove(lerp(b.x, tx + 20 * side, k), lerp(ROW_Y, ROW_Y + 22, k), 'pinch', { gap: lerp(BEAD_GAP, 150, k), flip: left, s: 0.92 });
  }
  const k = (q - 0.3) / 0.7;
  return glove(lerp(tx + 34 * side, tx + 40 * side, k), lerp(ROW_Y + 118, ROW_Y + 84, easeOut(k)), 'point', { rot: -26 * side, flip: left, s: 0.84 });
}

const rowCord = () => cord([[ROW_L, ROW_Y], [ROW_R, ROW_Y]]);

/**
 * Steps 1 to 6: one bead of colour BEAD_ORDER[k] joins the ones before it.
 * @param {number} k @param {number} p @returns {Item[]}
 */
function beadStep(k, p) {
  /** @type {Item[]} */
  const items = [rowCord()];
  for (let i = 0; i < k; i += 1) items.push(bead(slotX(i + 1), ROW_Y, BEAD_ORDER[i]));
  // The other hand holds the cord where the row starts, so each bead has
  // something to slide up against.
  items.push(glove(slotX(0) - 18, ROW_Y, 'fist', { flip: true, s: 0.86, rot: 14 }));
  const tx = slotX(k + 1);
  const b = carriedBead(p, { from: [1500, 660], entry: ROW_R + 58, thread: ROW_R - 46, to: tx, t0: 0, t1: 0.26, t2: 0.4, t3: 0.84 });
  items.push(bead(b.x, b.y, BEAD_ORDER[k], { rot: b.rot, sx: b.sx, sy: b.sy }));
  items.push(carrierGlove(p, b, tx, 0.86, false));
  items.push(...landingPop(p, 0.84, tx, ROW_Y, { seed: k + 1 }));
  return items;
}

/** The two knots that tie the clear beads in place. @param {number} [s] */
const KNOT_S = 1.3;

/**
 * Step 7: a clear bead on each end, then tie each one in place.
 * @param {number} p @returns {Item[]}
 */
function finishStep(p) {
  /** @type {Item[]} */
  const items = [rowCord()];
  for (let i = 0; i < 6; i += 1) items.push(bead(slotX(i + 1), ROW_Y, BEAD_ORDER[i]));

  // The holding hand lets go of the cord first.
  if (p < 0.14) {
    const e = easeIn(seg(p, 0, 0.14));
    items.push(glove(lerp(slotX(0) - 18, 250, e), lerp(ROW_Y, 700, e), 'fist', { flip: true, s: 0.86, rot: 14 + 20 * e }));
  }

  const T = { t0: 0.08, t1: 0.3, t2: 0.42, t3: 0.64 };
  const L = carriedBead(p, { from: [-40, 660], entry: ROW_L - 58, thread: ROW_L + 46, to: slotX(0), ...T });
  const R = carriedBead(p, { from: [1500, 660], entry: ROW_R + 58, thread: ROW_R - 46, to: slotX(7), ...T });
  items.push(bead(L.x, L.y, 'clear', { rot: L.rot, sx: L.sx, sy: L.sy }));
  items.push(bead(R.x, R.y, 'clear', { rot: R.rot, sx: R.sx, sy: R.sy }));

  // The knots: tied just outside each clear bead, with a tug on the tail.
  const tie = seg(p, 0.7, 0.86);
  if (p >= 0.7) {
    const k = backOut(tie);
    items.push(knot(slotX(0) - KNOT_OFF, ROW_Y, k * KNOT_S, lerp(-140, 0, easeOut(tie))));
    items.push(knot(slotX(7) + KNOT_OFF, ROW_Y, k * KNOT_S, lerp(140, 0, easeOut(tie))));
  }

  if (p < 0.66) {
    items.push(glove(L.x, L.y, 'pinch', { gap: BEAD_GAP, rot: L.rot, flip: true, s: 0.92 }));
    items.push(glove(R.x, R.y, 'pinch', { gap: BEAD_GAP, rot: R.rot, s: 0.92 }));
  } else if (p < 0.9) {
    // Both hands take the tails and tug them outward: the knot pulls snug.
    const move = easeInOut(seg(p, 0.66, 0.72));
    const tug = Math.sin(Math.PI * tie) * 26;
    const lx = lerp(L.x, slotX(0) - KNOT_OFF - 92, move) - tug;
    const rx = lerp(R.x, slotX(7) + KNOT_OFF + 92, move) + tug;
    items.push(glove(lx, ROW_Y, 'pinch', { gap: lerp(BEAD_GAP, 30, move), flip: true, s: 0.92 }));
    items.push(glove(rx, ROW_Y, 'pinch', { gap: lerp(BEAD_GAP, 30, move), s: 0.92 }));
  } else {
    // Let go: both hands open under the finished row.
    const e = easeOut(seg(p, 0.9, 1));
    items.push(glove(lerp(slotX(0) - KNOT_OFF - 92, 250, e), lerp(ROW_Y, 452, e), 'open', { flip: true, s: 0.78, rot: lerp(0, -18, e) }));
    items.push(glove(lerp(slotX(7) + KNOT_OFF + 92, 1210, e), lerp(ROW_Y, 452, e), 'open', { s: 0.78, rot: lerp(0, 18, e) }));
  }

  items.push(...landingPop(p, 0.64, slotX(0), ROW_Y, { seed: 7, size: 0.85 }));
  items.push(...landingPop(p, 0.64, slotX(7), ROW_Y, { seed: 8, size: 0.85 }));
  items.push(...landingPop(p, 0.84, slotX(0) - KNOT_OFF, ROW_Y, { seed: 9, size: 0.7 }));
  items.push(...landingPop(p, 0.84, slotX(7) + KNOT_OFF, ROW_Y, { seed: 10, size: 0.7 }));
  return items;
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

/** @param {number} p @returns {Item[]} */
function crossStep(p) {
  const u = easeInOut(seg(p, 0.12, 0.46));
  const c = easeInOut(seg(p, 0.52, 0.9));
  const row = arcRow({ cx: ROW_CX, yb: lerp(ROW_Y, 458, u), kappa: u / 430, s: lerp(1, 0.86, u) });

  // The hands: in to take the tips, up into a U, then across each other.
  const grab = easeOut(seg(p, 0, 0.12));
  /** @type {Pt} */
  const lHand = mix(mix(mix([60, 640], [ROW_L, ROW_Y], grab), [372, 118], u), [1030, 74], c);
  /** @type {Pt} */
  const rHand = mix(mix(mix([1400, 640], [ROW_R, ROW_Y], grab), [1088, 118], u), [430, 96], c);
  // Mid-cross, the left hand rides a little higher: it is going OVER.
  lHand[1] -= 46 * Math.sin(Math.PI * c);
  rHand[1] += 22 * Math.sin(Math.PI * c);
  // Before the hands arrive the tips lie where the row left them.
  const lTip = mix([ROW_L, ROW_Y], lHand, p < 0.12 ? 0 : 1);
  const rTip = mix([ROW_R, ROW_Y], rHand, p < 0.12 ? 0 : 1);
  /** @type {Pt} */
  const lIn = unit([lerp(-1, 0, u) + 0.55 * c, lerp(0, -1, u) + 0.3 * c]);
  /** @type {Pt} */
  const rIn = unit([lerp(1, 0, u) - 0.55 * c, lerp(0, -1, u) + 0.3 * c]);

  /** @type {Item[]} */
  const items = [cord(row.cordPts)];
  items.push(cord(arm(row.right, rTip, rIn)));
  items.push(cord(arm(row.left, lTip, lIn)));
  items.push(...row.beads, ...row.knots);
  if (p >= 0.02) {
    // Hands holding the cord's ends, the arm (cuff) away from the bracelet.
    const lRot = lerp(lerp(0, 90, u), 225, c);
    const rRot = lerp(lerp(0, -90, u), -225, c);
    items.push(glove(rHand[0], rHand[1], 'fist', { rot: rRot, s: 0.8 }));
    items.push(glove(lHand[0], lHand[1], 'fist', { rot: lRot, s: 0.8, flip: true }));
  }
  // A guide for the crossing: which way the left end travels.
  if (p > 0.46 && p < 0.96) {
    const o = Math.min(seg(p, 0.46, 0.54), 1 - seg(p, 0.86, 0.96));
    items.push(arrow(cubic([470, 44], [600, 8], [820, 8], [950, 36], 14), o));
  }
  return items;
}

// ── The knot close-up (steps 9 to 13) ────────────────────────
// A top view of a pointer finger held out to the right (its hand on the
// left), with the bracelet hanging below. The two sides cross on the finger
// in an X near the knuckle; the top string then wraps under and around the
// finger three times, toward the fingertip, and a counter pops for each wrap.
// Take the finger out and the wraps are a tunnel; thread the end back
// through it and pull, and the wraps cinch into a barrel knot around the
// bottom string.
//
// The geometry below is written for the mirror image (finger pointing LEFT,
// wraps running right to left); `mirror()` flips each finished picture, so
// the wall shows the finger pointing right and the counters read 1, 2, 3.

const FY = 240; // the finger's axis
const TIP_X = 400; // the fingertip
const HAND_S = 1.45;
const HAND_REACH = 252; // the pointer finger, in glove units
const FR = (GLOVE.fingerW * HAND_S) / 2;
const XC = 664; // the X's centre, on the finger near the knuckle
const R0 = FR + 9; // the wraps' radius around the finger
const PITCH0 = 56;
const GAP0 = 34; // between the X and the first wrap
const WRAPS = 3; // three overs and three unders; the end leaves at the near edge
const HOLD_REACH = 96; // how far the wrapping hand holds the end out
// Drawn in the mirror image too, so its row is reversed here and reads
// clear, black ... yellow, clear on the wall, as in steps 1 to 7.
const BRACELET_BELOW = { cx: XC, yb: 506, kappa: 1 / 250, s: 0.5, colors: [...BRACELET_ROW].reverse() };
const THREAD_OUT = /** @type {Pt} */ ([XC + 150, FY - 4]);

/**
 * Flip a finished picture left to right (see above).
 * @param {Item[]} items @returns {Item[]}
 */
function mirror(items) {
  return items.map((it) => {
    if (it.kind === 'cord' || it.kind === 'arrow') {
      return { ...it, pts: it.pts.map(([x, y]) => /** @type {Pt} */ ([r1(STAGE_W - x), y])) };
    }
    if (it.kind === 'glove') return { ...it, x: r1(STAGE_W - it.x), rot: r1(-it.rot || 0), flip: !it.flip };
    if (it.kind === 'badge' || it.kind === 'pot') return { ...it, x: r1(STAGE_W - it.x) };
    return { ...it, x: r1(STAGE_W - it.x), rot: r1(-it.rot || 0) };
  });
}

/**
 * The knot's geometry for wraps of radius R and pitch.
 * @param {number} R @param {number} pitch @param {number} gap
 */
function knotGeom(R, pitch, gap) {
  const w = 0.85 * R;
  /** @type {Pt} */ const aTop = [XC - w, FY + R];
  /** @type {Pt} */ const bTop = [XC + w, FY - R];
  /** @type {Pt} */ const aBot = [XC + w, FY + R];
  /** @type {Pt} */ const bBot = [XC - w, FY - R];
  const x1 = XC - w - gap;
  /** A point of the top string's wrap at turn u (u < 0 is the pass under from the X). @param {number} u @returns {Pt} */
  const at = (u) => [u < 0 ? lerp(XC + w, x1, (u + 0.5) / 0.5) : x1 - pitch * u, FY + R * Math.cos(TAU * u)];
  return { R, pitch, aTop, bTop, aBot, bBot, x1, xe: x1 - WRAPS * pitch, at, inset: R * 0.22 };
}

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

/**
 * The bottom string past the X: over the far edge, under the finger (or
 * through the tunnel), then out past the fingertip to its tail, which is in
 * plain view again.
 * @param {ReturnType<typeof knotGeom>} g @param {Pt} tail
 * @param {number} fingerTip the fingertip's x (Infinity once it is out)
 * @returns {Item[]}
 */
function bottomString(g, tail, fingerTip) {
  const y = FY + g.inset;
  // Hidden while it runs under the finger or through the wraps.
  const out = Math.min(g.xe - 12, fingerTip - 4);
  return [
    cord([g.bBot, [g.bBot[0] - 8, FY - g.R * 0.45], [g.bBot[0] - 26, y], [out, y]], 'back'),
    cord([[out, y], [lerp(out, tail[0], 0.55), lerp(y, tail[1], 0.3)], tail]),
  ];
}

/**
 * The top string's end, from the last wrap (at the near edge): down, round
 * to the left, into the tunnel's mouth, through it, out past the X.
 * @param {ReturnType<typeof knotGeom>} g @param {Pt} out the far end
 */
function threadRoute(g, out, loopScale = g.R / R0) {
  const s = loopScale;
  const e = g.at(WRAPS);
  const y = FY - g.inset;
  const mouthL = g.xe - 24 * s;
  /** @type {Pt[]} */
  const loop = [
    e,
    [e[0] - 2 * s, e[1] + 52 * s],
    [e[0] - 44 * s, e[1] + 80 * s],
    [e[0] - 92 * s, e[1] + 50 * s],
    [e[0] - 100 * s, y + 14 * s],
    [mouthL, y],
  ];
  /** @type {Pt[]} */
  const inside = [[mouthL, y], [XC + g.R * 0.85 + 26 * s, y]];
  /** @type {Pt[]} */
  const exit = [inside[1], [lerp(inside[1][0], out[0], 0.5), lerp(y, out[1], 0.5)], out];
  return { loop, inside, exit, all: [...loop, ...inside.slice(1), ...exit.slice(1)] };
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
  const lighted = (a, b) => {
    const m = mix(a, b, 0.5);
    return [mix(m, a, q), mix(m, b, q)];
  };
  if (gold > 0) out.push(cord(lighted(g.aBot, g.bBot), 'gold'));
  out.push(cord([g.aBot, g.bBot]));
  if (gold > 0) out.push(cord(lighted(g.aTop, g.bTop), 'gold'));
  out.push(cord([g.aTop, g.bTop]));
  return out;
}

const BOTTOM_TAIL = /** @type {Pt} */ ([278, 300]);

/** The hand with its pointer finger out; dx slides it back out of the wraps. @param {number} [dx] */
const pointerHand = (dx = 0) => glove(TIP_X + dx, FY, 'point', { rot: -90, s: HAND_S, reach: HAND_REACH });

/**
 * Where the wrapping hand holds the end when the wraps have reached turn u.
 * It rides an ellipse round the finger: below, over the front, above, then
 * round the back, its hand always trailing away from the finger.
 * @param {ReturnType<typeof knotGeom>} g @param {number} u
 */
function holdAt(g, u) {
  const tip = g.at(u);
  const ph = TAU * u;
  /** @type {Pt} */
  const hand = [tip[0] + 64 * Math.sin(ph), tip[1] + HOLD_REACH * Math.cos(ph)];
  const outward = Math.atan2(Math.cos(ph), 0.7 * Math.sin(ph)) * DEG;
  return { tip, hand, behind: Math.sin(ph) < -0.2, rot: outward - PINCH_BODY_DEG_FLIPPED };
}

/** The wrapping hand holding the end, flipped (it is the other hand). */
const holdingGlove = (/** @type {Pt} */ at, /** @type {number} */ rot, gap = 20) => glove(at[0], at[1], 'pinch', { gap, flip: true, s: 0.8, rot });

/**
 * Step 9: set the bottom string on the finger, wrap the top string under and
 * around it three times.
 * @param {number} p @returns {Item[]}
 */
function wrapStep(p) {
  const g = knotGeom(R0, PITCH0, GAP0);
  const w = pace(seg(p, 0.06, 0.92));
  const uTip = lerp(-0.5, WRAPS, w);
  const { front, back } = wraps(g, uTip);
  const h = holdAt(g, uTip);
  const hold = holdingGlove(h.hand, h.rot);
  const tail = cord([h.tip, h.hand], h.behind ? 'back' : 'front');

  /** @type {Item[]} */
  const items = hangingBracelet(g);
  for (const pts of back) items.push(cord(pts, 'back'));
  items.push(...bottomString(g, BOTTOM_TAIL, TIP_X));
  if (h.behind) items.push(tail, hold);
  items.push(pointerHand());
  items.push(...theX(g, 0));
  for (const pts of front) items.push(cord(pts));
  if (!h.behind) items.push(tail, hold);
  items.push(...wrapCounters(g, uTip));
  return mirror(items);
}

/**
 * One, two, three: a counter under each wrap as its pass over the finger closes.
 * @param {ReturnType<typeof knotGeom>} g @param {number} uTip @param {number} [o]
 * @returns {Item[]}
 */
function wrapCounters(g, uTip, o = 1) {
  /** @type {Item[]} */
  const out = [];
  for (let k = 0; k < 3; k += 1) {
    const done = k + 0.5;
    if (uTip < done) continue;
    const pop = clamp01((uTip - done) / 0.22);
    out.push(badge(g.x1 - g.pitch * (k + 0.25), FY - g.R - 50, String(k + 1), backOut(pop), o));
  }
  return out;
}

/**
 * The finished wraps with the end: held out (step 10), loose (11), or
 * threaded `threaded` of the way along its route (12).
 * @param {ReturnType<typeof knotGeom>} g
 * @param {{ fingerDX?: number | null, threaded?: number, held?: Pt | null }} o
 */
function wrappedKnot(g, { fingerDX = 0, threaded = 0, held = null }) {
  const { front, back } = wraps(g, WRAPS);
  const route = threadRoute(g, THREAD_OUT);
  const loopLen = polyLength(route.loop);
  const insideLen = polyLength(route.inside);
  const total = polyLength(route.all);
  const len = lerp(64, total, threaded);
  /** @type {Item[]} */
  const backItems = [];
  /** @type {Item[]} */
  const frontItems = [];
  if (held) {
    frontItems.push(cord([g.at(WRAPS), held]));
  } else {
    // The end's loop outside the tunnel is in front; its run through the
    // tunnel sits between the wraps' two halves; out past the X it is in
    // front again.
    frontItems.push(cord(slice(route.all, 0, Math.min(len, loopLen))));
    if (len > loopLen) backItems.push(cord(slice(route.all, loopLen, Math.min(len, loopLen + insideLen)), 'back'));
    if (len > loopLen + insideLen) frontItems.push(cord(slice(route.all, loopLen + insideLen, len)));
  }
  const tipAt = along(route.all, len);
  return { g, front, back, backItems, frontItems, tipAt, fingerDX, route, len, total };
}

/**
 * Draws a wrappedKnot, back to front, with extra layers.
 * @param {ReturnType<typeof wrappedKnot>} k
 * @param {{ gold?: number, over?: Item[] }} [o]
 * @returns {Item[]}
 */
function drawKnot(k, { gold = 0, over = [] } = {}) {
  /** @type {Item[]} */
  const items = hangingBracelet(k.g);
  for (const pts of k.back) items.push(cord(pts, 'back'));
  items.push(...bottomString(k.g, BOTTOM_TAIL, k.fingerDX == null ? Infinity : TIP_X + k.fingerDX));
  items.push(...k.backItems);
  if (k.fingerDX != null) items.push(pointerHand(k.fingerDX));
  items.push(...theX(k.g, gold));
  for (const pts of k.front) items.push(cord(pts));
  items.push(...k.frontItems);
  items.push(...over);
  return items;
}

/**
 * Step 10: it should make an X. The X lights up and a ring pulses round it.
 * @param {number} p @returns {Item[]}
 */
function xStep(p) {
  const g = knotGeom(R0, PITCH0, GAP0);
  const h = holdAt(g, WRAPS);
  const k = wrappedKnot(g, { held: h.hand });
  const gold = seg(p, 0.12, 0.42);
  /** @type {Item[]} */
  const over = [holdingGlove(h.hand, h.rot)];
  for (const [a, len] of [[0.2, 0.3], [0.48, 0.3]]) {
    if (p >= a && p < a + len) {
      const t = seg(p, a, a + len);
      over.push(fx('ring', XC, FY, lerp(R0 * 1.1, R0 * 2.6, easeOut(t)), 1 - t, SUN));
    }
  }
  // The resting picture keeps a ring round the X, and the counters fade.
  if (p >= 0.12) over.push(fx('ring', XC, FY, R0 * 1.6, easeOut(seg(p, 0.12, 0.32)) * 0.95, SUN));
  if (p < 0.3) over.push(...wrapCounters(g, WRAPS, 1 - seg(p, 0, 0.3)));
  if (p >= 0.26 && p < 0.52) over.push(...landingPop(p, 0.26, XC, FY - R0 - 30, { seed: 10, size: 1.1, len: 0.26 }));
  return mirror(drawKnot(k, { gold, over }));
}

/** Pinching the wraps from above, fingertips pressed on the loops. */
function wrapPinch(/** @type {ReturnType<typeof knotGeom>} */ g) {
  const cx = (g.x1 + g.xe) / 2;
  return glove(cx, FY - g.R - 8, 'pinch', { gap: (g.x1 - g.xe) * 0.62, flip: true, s: 0.9, rot: 90 });
}

/**
 * Step 11: pinch the loops, take the finger out.
 * @param {number} p @returns {Item[]}
 */
function pinchStep(p) {
  const g = knotGeom(R0, PITCH0, GAP0);
  const out = (XC + 0.85 * R0 + 70) - TIP_X;
  const slide = easeInOut(seg(p, 0.36, 0.88));
  const reach = easeInOut(seg(p, 0, 0.3));
  const k = wrappedKnot(g, { fingerDX: out * slide, held: reach < 0.5 ? holdAt(g, WRAPS).hand : null });
  const h = holdAt(g, WRAPS);
  const target = wrapPinch(g);
  const hand = reach < 1
    ? glove(lerp(h.hand[0], target.x, reach), lerp(h.hand[1], target.y, reach), 'pinch', {
      gap: lerp(20, target.gap + 50, reach), flip: true, s: lerp(0.8, 0.9, reach), rot: lerp(h.rot, target.rot, reach),
    })
    : glove(target.x, target.y, 'pinch', { gap: lerp(target.gap + 50, target.gap, seg(p, 0.3, 0.36)), flip: true, s: 0.9, rot: target.rot });
  /** @type {Item[]} */
  const over = [hand];
  if (p > 0.34 && p < 0.94) {
    const o = Math.min(seg(p, 0.34, 0.42), 1 - seg(p, 0.84, 0.94));
    const x0 = XC + 120 + out * slide * 0.5;
    over.push(arrow([[x0 - 70, FY + 104], [x0 + 90, FY + 104]], o));
  }
  return mirror(drawKnot(k, { over }));
}

/**
 * Step 12: thread the end of the top string through the loops.
 * @param {number} p @returns {Item[]}
 */
function threadStep(p) {
  const g = knotGeom(R0, PITCH0, GAP0);
  const t = easeInOut(seg(p, 0.12, 0.8));
  const k = wrappedKnot(g, { fingerDX: null, threaded: t });
  // The hand whose finger came out waits past the X to take the end.
  const catchAt = seg(p, 0.78, 0.88);
  const pull = easeOut(seg(p, 0.84, 1));
  const catcher = glove(THREAD_OUT[0] + 8 + 20 * pull, THREAD_OUT[1], 'pinch', { gap: lerp(70, 18, catchAt), s: 0.86 });
  /** @type {Item[]} */
  const over = [wrapPinch(g), catcher];
  // A guide ahead of the end: the way it goes.
  if (p < 0.84 && k.total - k.len > 40) {
    const o = Math.min(seg(p, 0, 0.1), 1 - seg(p, 0.7, 0.84));
    over.push(arrow(slice(k.route.all, k.len + 18, k.total - 6), o));
  }
  // A glint rides the end while it travels, so the eye follows it.
  if (p > 0.08 && p < 0.84) {
    over.push(fx('sparkle', k.tipAt.x, k.tipAt.y, 22, Math.min(seg(p, 0.08, 0.16), 1 - seg(p, 0.76, 0.84)), SUN, 360 * p));
  }
  return mirror(drawKnot(k, { over }));
}

/**
 * Step 13: pull tight. Both ends pulled, the wraps cinch, a pop.
 * @param {number} p @returns {Item[]}
 */
function pullStep(p) {
  const tight = easeInOut(seg(p, 0.16, 0.7));
  const g = knotGeom(lerp(R0, 22, tight), lerp(PITCH0, 25, tight), lerp(GAP0, 8, tight));
  const g0 = knotGeom(R0, PITCH0, GAP0);
  const jerk = Math.sin(Math.PI * seg(p, 0.66, 0.82)) * 16;
  const lx = lerp(300, 214, tight) - jerk;
  const rx = lerp(THREAD_OUT[0] + 28, 1020, tight) + jerk;
  const { front, back } = wraps(g, WRAPS);
  // Pulled through, the end's loop outside the tunnel runs out.
  const route = threadRoute(g, [rx, FY], lerp(1, 0.12, tight));
  /** @type {Pt} */
  const bTail = [lx, lerp(BOTTOM_TAIL[1], FY + 4, tight)];
  /** @type {Item[]} */
  const items = hangingBracelet(g);
  for (const pts of back) items.push(cord(pts, 'back'));
  items.push(...bottomString(g, bTail, Infinity));
  items.push(cord(route.inside, 'back'));
  items.push(...theX(g, 0));
  for (const pts of front) items.push(cord(pts));
  items.push(cord(route.loop));
  items.push(cord(route.exit));
  // The hands: one lets go of the wraps and takes the bottom string's tail,
  // the other already has the end. Then both pull.
  const grab = easeInOut(seg(p, 0, 0.14));
  const pinch = wrapPinch(g0);
  items.push(grab < 1
    ? glove(lerp(pinch.x, lx, grab), lerp(pinch.y, bTail[1], grab), 'pinch', { gap: lerp(pinch.gap, 18, grab), flip: true, s: 0.9, rot: 90 })
    : glove(lx, bTail[1], 'pull', { rot: 90, s: 0.86, flip: true }));
  items.push(grab < 1
    ? glove(THREAD_OUT[0] + 28, THREAD_OUT[1], 'pinch', { gap: 18, s: 0.86 })
    : glove(rx, FY, 'pull', { rot: -90, s: 0.86 }));
  // The pop, when the wraps bite.
  const knotX = (g.xe + XC + g.R) / 2;
  if (p >= 0.66 && p < 0.9) {
    const e = seg(p, 0.66, 0.9);
    items.push(fx('ring', knotX, FY, lerp(30, 180, easeOut(e)), 1 - e, WHITE));
    items.push(fx('ring', knotX, FY, lerp(20, 124, easeOut(e)), (1 - e) * 0.9, SUN));
  }
  items.push(...landingPop(p, 0.68, knotX, FY, { seed: 13, size: 1.3, len: 0.2 }));
  return mirror(items);
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
 * How long step i's action takes in the one-step loop, in seconds (it then
 * holds its finished picture until LOOP_SEC).
 * @param {number} stepIndex
 */
export function actionSec(stepIndex) {
  const i = stepOf(stepIndex);
  if (i < 6) return 6.2;
  return 7;
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
 * Step `stepIndex` (0..12) at action progress p, as a display list.
 * @param {number} stepIndex @param {number} p @returns {Item[]}
 */
export function sceneFor(stepIndex, p) {
  return BUILDERS[stepOf(stepIndex)](progressOf(p));
}

// ── The intro and the finale ─────────────────────────────────

const POT_Y = 452;

/**
 * The opening: the empty cord across the table, the bead pots, a title.
 * @param {number} p @returns {Item[]}
 */
export function introScene(p) {
  const q = progressOf(p);
  const draw = easeInOut(seg(q, 0, 0.36));
  /** @type {Item[]} */
  const items = [];
  if (draw > 0) items.push(cord([[ROW_L, ROW_Y], [lerp(ROW_L + 1, ROW_R, draw), ROW_Y]]));
  const colors = /** @type {BeadColor[]} */ ([...BEAD_ORDER, 'clear']);
  colors.forEach((color, i) => {
    const at = 0.2 + i * 0.07;
    if (q < at) return;
    const s = backOut(seg(q, at, at + 0.16));
    items.push({ kind: 'pot', x: r1(ROW_CX + (i - 3) * 152), y: POT_Y, s: r1(s * 1000) / 1000, color });
  });
  const title = seg(q, 0.5, 0.74);
  if (title > 0) items.push(text(ROW_CX, 132, 'BRACELET TIME!', 104, { s: lerp(1.5, 1, backOut(title)), o: easeOut(Math.min(1, title * 2)) }));
  items.push(...landingPop(q, 0.66, ROW_CX - 360, 110, { seed: 21 }));
  items.push(...landingPop(q, 0.7, ROW_CX + 360, 110, { seed: 22 }));
  return items;
}

const FIN = { cx: 452, cy: 334, r: 176 };
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
const FIN_KNOT_DEG = -48; // where the sliding knot sits on the loop

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
  const s = 0.8;
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
  // Held up at the top of the loop.
  items.push(glove(pivot[0], pivot[1], 'pinch', { gap: 30, s: 0.9, rot: -90 }));

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
  if (q > 0.24 && q < 0.7) {
    const e = seg(q, 0.24, 0.7);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * TAU + 0.3;
      const d = lerp(FIN.r * 0.9, FIN.r * 1.7, easeOut(e));
      const colors = [SUN, WHITE, BEAD_TONES.red.tone, BEAD_TONES.blue.light, BEAD_TONES.green.light];
      items.push(fx('sparkle', FIN.cx + Math.cos(a) * d, FIN.cy + Math.sin(a) * d * 0.8, lerp(22, 10, e), 1 - e, colors[i % colors.length], 200 * e));
    }
  }
  // Confetti in the bead colours drifts down past the words, gone by the rest.
  for (const c of FINALE_CONFETTI) {
    const t = seg(q, c.at, c.at + 0.36);
    if (t <= 0 || t >= 1) continue;
    const y = lerp(-30, c.to, easeOut(t));
    const x = c.x + Math.sin(t * TAU * c.wobble) * 22;
    items.push(fx('sparkle', x, y, c.size, 1 - t * t, c.color, c.spin * t));
  }
  const stay = easeOut(seg(q, 0.6, 0.8));
  if (stay > 0) {
    for (const [x, y, sz, c] of /** @type {[number, number, number, string][]} */ ([[742, 150, 26, SUN], [1388, 250, 20, WHITE], [760, 454, 18, WHITE], [1370, 470, 28, SUN]])) {
      items.push(fx('sparkle', x, y, sz * stay, 1, c, 0));
    }
  }
  return items;
}

// ── The epic: all 13 steps in 90 seconds ─────────────────────

export const EPIC_SEC = 90;

/** @typedef {{ kind: 'intro' | 'step' | 'finale', step?: number, start: number, end: number }} EpicBeat */

const BEAT_LENGTHS = [4, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 6.5, 6.75, 6.75, 6.75, 6.75, 6.75, 6.75, 6];

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

// The camera, as look-at keys: (x, y) is the stage point in the middle of
// the view, s the zoom. Between keys it eases; a key marked `cut` is a jump
// (used where the picture itself cuts to a new composition).
/** @typedef {{ t: number, x: number, y: number, s: number, cut?: boolean }} CameraKey */

/** @type {CameraKey[]} */
const CAMERA_KEYS = (() => {
  /** @type {CameraKey[]} */
  const keys = [
    { t: 0, x: 730, y: 280, s: 1 },
    { t: 3.6, x: 730, y: 290, s: 1.04 },
  ];
  // Beads: a slow pan along the cord, pushing in a touch as each one lands.
  for (let i = 0; i < 6; i += 1) {
    const b = EPIC_BEATS[i + 1];
    const tx = slotX(i + 1);
    keys.push({ t: b.start + 0.4, x: 800, y: 296, s: 1.1 });
    keys.push({ t: b.start + 0.4 + 0.84 * (b.end - b.start - 1.4), x: Math.max(700, tx + 90), y: 296, s: 1.16 });
  }
  const s7 = EPIC_BEATS[7];
  keys.push({ t: s7.start + 1, x: 730, y: 300, s: 1 }, { t: s7.end, x: 730, y: 300, s: 1.03 });
  const s8 = EPIC_BEATS[8];
  keys.push({ t: s8.start + 0.8, x: 730, y: 290, s: 1 }, { t: s8.end, x: 730, y: 250, s: 1.05 });
  // The knot close-up is drawn mirrored (see mirror()), so its keys are too.
  const mx = (/** @type {number} */ x) => STAGE_W - x;
  const s9 = EPIC_BEATS[9];
  keys.push({ t: s9.start, x: mx(XC) + 80, y: 262, s: 1.12, cut: true }, { t: s9.end, x: mx(XC) + 120, y: 262, s: 1.22 });
  const s10 = EPIC_BEATS[10];
  keys.push({ t: s10.start + 2, x: mx(XC) + 10, y: 250, s: 1.4 }, { t: s10.end, x: mx(XC) + 10, y: 250, s: 1.44 });
  const s11 = EPIC_BEATS[11];
  keys.push({ t: s11.start + 2.4, x: mx(XC) + 50, y: 262, s: 1.16 }, { t: s11.end, x: mx(XC) - 10, y: 262, s: 1.1 });
  const s12 = EPIC_BEATS[12];
  keys.push({ t: s12.start + 1, x: mx(XC) + 90, y: 252, s: 1.2 }, { t: s12.end, x: mx(XC) + 20, y: 252, s: 1.2 });
  const s13 = EPIC_BEATS[13];
  keys.push({ t: s13.start + 1, x: mx(XC) + 30, y: 262, s: 1.1 });
  keys.push({ t: s13.start + 0.25 + 0.68 * (s13.end - s13.start - 1.35), x: mx(XC) + 40, y: 252, s: 1.26 });
  keys.push({ t: s13.end, x: mx(XC) + 20, y: 270, s: 1.08 });
  const fin = EPIC_BEATS[14];
  keys.push({ t: fin.start, x: 730, y: 280, s: 1.08, cut: true }, { t: fin.start + 1.6, x: 730, y: 280, s: 1 }, { t: EPIC_SEC, x: 730, y: 280, s: 1.03 });
  return keys;
})();

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
  // Never let the view leave the stage (clamped after rounding, so the
  // rounding cannot open a sliver past the edge either).
  const scale = Math.max(1, Math.round(s * 1000) / 1000);
  const tx = clamp(r1(STAGE_W / 2 - scale * x), STAGE_W - STAGE_W * scale, 0);
  const ty = clamp(r1(STAGE_H / 2 - scale * y), STAGE_H - STAGE_H * scale, 0);
  return { x: Math.round(tx * 1000) / 1000, y: Math.round(ty * 1000) / 1000, scale };
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
  const lead = beat.kind === 'step' ? 0.25 : 0;
  const hold = beat.kind === 'step' ? 1.1 : 0.9;
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
