import { useContext } from 'react';
import { M, ZeroAnimationContext } from '../../lib/motion.jsx';
import {
  PosterDepth, Wordmark, CountdownChip, RotatingDetail,
  landsAt, keyframes, buildShake, seeded, SHOWREEL_SEC, EASE_SLAM, EASE_OUT, EASE_INOUT,
} from './kit.jsx';

// ─────────────────────────────────────────────────────────────
// Salvation bracelets for kids in Uganda: the gospel, one bead at a time.
//
// One club night only (Wed, Sept 30), so it is FEATURED in promos.js and
// takes every other lap while it is live. It opens in the dark and ends on
// the printed lavender and cream poster: the story goes from dark to light.
//
// Beat sheet (seconds into the 15 s hold):
//   0.6  a black waxed cord draws itself across the dark, a rim light
//        running along it. The camera starts a slow push.
//   1.3  the beads fall onto the cord one at a time, every 1.2 s, in
//        gospel order. Each one lands with a squash and a shock ring, its
//        colour floods the screen out of the bead itself, and its truth
//        slams in above the cord:
//          1.3  SIN      black: a heavy thud, the frame shakes, dust
//          2.5  BLOOD    red: a cross of light opens behind the word
//          3.7  PURITY   white: glints pop around the word
//          4.9  BAPTISM  blue: ripples run out of the bead
//          6.1  GROWTH   green: vines climb in from both corners
//          7.3  HEAVEN   gold: rays turn, light blooms, sparkles
//        Each flood carries its own word and effect, so the next flood
//        wipes the last truth away with nothing leaving on its own.
//   8.4  the cord lifts into a loop and the beads ride it down to the
//        bottom of the bracelet on the right (the camera pulls back).
//   9.1  the knot cinches: two clear slider beads close on it, the tails
//        spring out, a sparkle pops, and the poster's lavender floods out
//        of the knot while the cream wave rises under the bracelet.
//   9.7  wordmark, the THIS WEEK chip, WE'RE MAKING (a beat after the
//        flood, so a slow screen never sets the copy on the gold);
//        9.95 BRACELETS drops letter by letter, each letter flashing a
//        bead colour before it settles gold; 10.45 FOR KIDS IN UGANDA
//        wipes in; 10.7 the subline; 10.85 the date pill.
//   9.85 the journey: a hand-drawn Maine with a pin on Waterville, where
//        our club meets, and (10.0) a dotted flight line drawn east to a
//        hand-drawn Uganda (10.2 to 11.0), a tiny bracelet riding it, and
//        the Uganda pin dropping with a ring as it arrives (11.0). The
//        doodles land around the card. End card assembled by 11.3.
//  12.0  the chip pulses and a glint runs along the beads (12.3); the
//        chip pulses again at 13.6. End card holds.
//
// The LAST keyframe of everything is the finished poster, which is the
// frame ?lowPower=1 freezes on. The dark, every flood, every word and
// effect in them, the shock rings and the tiny traveller end invisible.
// ─────────────────────────────────────────────────────────────

const SUBLINE = 'Salvation bracelets for Ugandan school kids';

// The subline is the poster's own small print, so it is the LAST line and
// the frozen card carries it. Most nights it is the only line (it simply
// fades in and holds); on the night, one line plays first on the way in.
export const DETAILS = Object.freeze({
  default: Object.freeze([SUBLINE]),
  tonight: Object.freeze(['Made at club tonight', SUBLINE]),
});

// The six truths, in gospel order (owner's call, 2026-09-28), in the words
// the bracelet kit itself prints on each colour.
export const BEADS = Object.freeze([
  Object.freeze({ key: 'sin', word: 'SIN', tone: '#1c1b22', light: '#4a4852', dark: '#050507', flood: '#09080d' }),
  Object.freeze({ key: 'blood', word: 'BLOOD', tone: '#d7263d', light: '#ff6b78', dark: '#8e0e20', flood: '#b3122a' }),
  Object.freeze({ key: 'purity', word: 'PURITY', tone: '#f4f3f0', light: '#ffffff', dark: '#c9c6d4', flood: '#fbfaf7' }),
  Object.freeze({ key: 'baptism', word: 'BAPTISM', tone: '#1f5fd6', light: '#6aa0ff', dark: '#0e3690', flood: '#1648b8' }),
  Object.freeze({ key: 'growth', word: 'GROWTH', tone: '#22a447', light: '#6ee08a', dark: '#0f6a2a', flood: '#15873a' }),
  Object.freeze({ key: 'heaven', word: 'HEAVEN', tone: '#ffc928', light: '#fff0a8', dark: '#d18f00', flood: '#f7b512' }),
]);

// ── The clock ────────────────────────────────────────────────
const T_CORD = 0.6;
const T_BEADS = Object.freeze([1.3, 2.5, 3.7, 4.9, 6.1, 7.3]);
const FALL = 0.4;
const T_LOOP = 8.4;
const T_TIED = 9.1;
const T_POSTER = 9.1;
// Every flood is cleared together, once the poster has covered them all,
// with seconds of slack for a slow screen (see "The floods").
export const T_GONE = 11.8;
const T_ARC = 10.2;
const T_PIN = 11.0;
const END_PULSES = Object.freeze([12.0, 13.6]);

// ── Geometry (the stage is a 1600x900 viewBox) ───────────────
const VIEW_W = 1600;
const VIEW_H = 900;
const CORD_Y = 640;
const BEAD_X = Object.freeze([425, 575, 725, 875, 1025, 1175]);
// The full-bleed layers (the dark, the floods, the poster) overscan the
// frame by BLEED % on every side so the shake never shows an edge, so a
// point on the stage is placed in THEIR box, not the frame's.
const BLEED = 3;
const pct = (v, of) => `${((((v / of) * 100) + BLEED) / (100 + BLEED * 2) * 100).toFixed(2)}%`;

// The bracelet on the end card: an ellipse, the knot at its top.
const LOOP = Object.freeze({ cx: 1225, cy: 628, rx: 215, ry: 138 });
const KNOT = Object.freeze({ x: LOOP.cx, y: LOOP.cy - LOOP.ry });
const BEAD_REST_SCALE = 0.52;

const n1 = (v) => Math.round(v * 10) / 10;

/**
 * The cord as four cubic segments, straight or looped, so framer-motion can
 * morph one `d` into the other point for point. The straight cord's middle
 * two segments (where the beads sit) become the loop's lower half.
 */
function cordPath(looped) {
  if (!looped) {
    const xs = [-80, 360, 800, 1240, 1680];
    let d = `M${xs[0]} ${CORD_Y}`;
    for (let i = 0; i < 4; i += 1) {
      const a = xs[i];
      const b = xs[i + 1];
      d += ` C${n1(a + (b - a) / 3)} ${CORD_Y} ${n1(a + ((b - a) * 2) / 3)} ${CORD_Y} ${b} ${CORD_Y}`;
    }
    return d;
  }
  const { cx, cy, rx, ry } = LOOP;
  const k = 0.5523;
  return [
    `M${cx} ${cy - ry}`,
    `C${n1(cx - k * rx)} ${cy - ry} ${cx - rx} ${n1(cy - k * ry)} ${cx - rx} ${cy}`,
    `C${cx - rx} ${n1(cy + k * ry)} ${n1(cx - k * rx)} ${cy + ry} ${cx} ${cy + ry}`,
    `C${n1(cx + k * rx)} ${cy + ry} ${cx + rx} ${n1(cy + k * ry)} ${cx + rx} ${cy}`,
    `C${cx + rx} ${n1(cy - k * ry)} ${n1(cx + k * rx)} ${cy - ry} ${cx} ${cy - ry}`,
  ].join(' ');
}
const CORD_STRAIGHT = cordPath(false);
const CORD_LOOPED = cordPath(true);

/**
 * Where each bead rests on the loop: spaced by ARC LENGTH (an ellipse's
 * angle is not its distance), centred a little right of the bottom like the
 * printed poster, each one turned to follow the cord.
 */
const BEAD_REST = (() => {
  const { cx, cy, rx, ry } = LOOP;
  const at = (t) => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  const centre = (72 * Math.PI) / 180;
  const spacing = 66;
  // Walk out from the centre angle toward larger angles (leftward) until
  // the arc length reaches `dist`; negative distances walk rightward.
  const angleAt = (dist) => {
    const dir = Math.sign(dist) || 1;
    let t = centre;
    let run = 0;
    let [px, py] = at(t);
    while (run < Math.abs(dist)) {
      t += dir * 0.0005;
      const [x, y] = at(t);
      run += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
    return t;
  };
  return BEADS.map((_, i) => {
    const t = angleAt((2.5 - i) * spacing);
    const [x, y] = at(t);
    const rotate = (Math.atan2(-ry * Math.cos(t), rx * Math.sin(t)) * 180) / Math.PI;
    return { x: n1(x), y: n1(y), rotate: n1(rotate) };
  });
})();

// ── The camera and the shake ─────────────────────────────────
const CAMERA = keyframes([
  [0, { scale: 1 }],
  [T_LOOP, { scale: 1.05 }],
  [T_TIED, { scale: 1 }],
], ['linear', EASE_INOUT]);

export const BRACELET_SHAKE = buildShake([
  // Only SIN lands with a thud; a jolt on every bead read as a strobe.
  { at: T_BEADS[0], amp: 12 },
  { at: T_TIED + 0.02, amp: 3 },
], SHOWREEL_SEC);

// ── The cord ─────────────────────────────────────────────────
const CORD = keyframes([
  [0, { pathLength: 0, d: CORD_STRAIGHT, opacity: 0 }],
  [T_CORD, { pathLength: 0, opacity: 0 }],
  [T_CORD + 0.05, { opacity: 1 }],
  [T_CORD + 0.7, { pathLength: 1 }],
  [T_LOOP, { d: CORD_STRAIGHT }],
  [T_TIED, { d: CORD_LOOPED, pathLength: 1, opacity: 1 }],
], [EASE_OUT, EASE_OUT, EASE_OUT, 'linear', EASE_INOUT]);

// The rim light rides the cord in the dark and is gone once it is on paper.
const CORD_RIM = keyframes([
  [0, { pathLength: 0, d: CORD_STRAIGHT, opacity: 0 }],
  [T_CORD, { pathLength: 0, opacity: 0 }],
  [T_CORD + 0.05, { opacity: 0.55 }],
  [T_CORD + 0.7, { pathLength: 1 }],
  [T_LOOP, { d: CORD_STRAIGHT, opacity: 0.55 }],
  [T_TIED, { d: CORD_LOOPED, opacity: 0 }],
], [EASE_OUT, EASE_OUT, EASE_OUT, 'linear', EASE_INOUT]);

// ── The beads ────────────────────────────────────────────────
function beadMove(i) {
  const at = T_BEADS[i];
  const x = BEAD_X[i];
  const rest = BEAD_REST[i];
  const spin = i % 2 ? 24 : -20;
  return keyframes([
    [0, { x, y: -160, rotate: spin, scaleX: 1, scaleY: 1, opacity: 0 }],
    [at - FALL - 0.02, { y: -160, opacity: 0 }],
    [at - FALL, { opacity: 1 }],
    [at, { y: CORD_Y, rotate: 0, scaleX: 1, scaleY: 1 }],
    [at + 0.07, { y: CORD_Y + 12, scaleX: 1.16, scaleY: 0.8 }],
    [at + 0.2, { y: CORD_Y - 16, scaleX: 0.94, scaleY: 1.08 }],
    [at + 0.34, { y: CORD_Y, scaleX: 1, scaleY: 1 }],
    [T_LOOP + i * 0.03, { x, y: CORD_Y, rotate: 0, scaleX: 1, scaleY: 1 }],
    [T_TIED, {
      x: rest.x, y: rest.y, rotate: rest.rotate, scaleX: BEAD_REST_SCALE, scaleY: BEAD_REST_SCALE, opacity: 1,
    }],
  ], ['linear', 'linear', [0.55, 0, 1, 0.45], EASE_OUT, EASE_OUT, EASE_OUT, 'linear', EASE_INOUT]);
}
const BEAD_MOVES = BEADS.map((_, i) => beadMove(i));

// A glint runs along the finished bracelet, one bead after the next.
const glint = (i) => keyframes([
  [0, { opacity: 0.55 }],
  [12.3 + i * 0.09, { opacity: 0.55 }],
  [12.42 + i * 0.09, { opacity: 1 }],
  [12.8 + i * 0.09, { opacity: 0.55 }],
], 'easeInOut');
const GLINTS = BEADS.map((_, i) => glint(i));

// The shock ring where each bead lands.
const SHOCKS = T_BEADS.map((at) => landsAt(at, 0.7, { opacity: [0, 0.45, 0], scale: [0.2, 1, 1.9] }, EASE_OUT));

// The dust off the first, heaviest bead.
const DUST = (() => {
  const rnd = seeded(930);
  return Array.from({ length: 12 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const dx = side * (40 + rnd() * 150);
    const dy = -(20 + rnd() * 110);
    return {
      key: i,
      r: n1(3 + rnd() * 6),
      anim: landsAt(T_BEADS[0] + 0.02, 0.9 + rnd() * 0.4, {
        opacity: [0, 0.8, 0],
        x: [BEAD_X[0], BEAD_X[0] + dx * 0.7, BEAD_X[0] + dx],
        y: [CORD_Y, CORD_Y + dy * 0.8, CORD_Y + dy],
      }, EASE_OUT),
    };
  });
})();

// ── The knot ─────────────────────────────────────────────────
const SLIDERS = [-1, 1].map((side) => {
  const rest = { x: KNOT.x + side * 27, y: KNOT.y + 2, rotate: side * -14, scale: 0.46 };
  return {
    side,
    rest,
    anim: keyframes([
      [0, { x: KNOT.x + side * 150, y: KNOT.y + 4, rotate: side * 40, scale: 0, opacity: 0 }],
      [T_TIED - 0.25, { x: KNOT.x + side * 150, scale: 0, opacity: 0 }],
      [T_TIED - 0.2, { opacity: 1 }],
      [T_TIED + 0.05, { x: KNOT.x + side * 22, rotate: side * -8, scale: 0.5 }],
      [T_TIED + 0.25, { ...rest, opacity: 1 }],
    ], ['linear', 'linear', EASE_SLAM, EASE_OUT]),
  };
});

const TAIL_L = `M${KNOT.x - 4} ${KNOT.y} C${KNOT.x - 18} ${KNOT.y - 30} ${KNOT.x - 40} ${KNOT.y - 50} ${KNOT.x - 66} ${KNOT.y - 62}`;
const TAIL_R = `M${KNOT.x + 4} ${KNOT.y} C${KNOT.x + 18} ${KNOT.y - 30} ${KNOT.x + 40} ${KNOT.y - 50} ${KNOT.x + 66} ${KNOT.y - 62}`;
const FRAY = [-1, 1].flatMap((s) => [
  `M${KNOT.x + s * 66} ${KNOT.y - 62} l${s * 14} -10`,
  `M${KNOT.x + s * 66} ${KNOT.y - 62} l${s * 16} 2`,
  `M${KNOT.x + s * 66} ${KNOT.y - 62} l${s * 6} -16`,
]);
const TAILS = keyframes([
  [0, { pathLength: 0, opacity: 0 }],
  [T_TIED, { pathLength: 0, opacity: 0 }],
  [T_TIED + 0.03, { opacity: 1 }],
  [T_TIED + 0.35, { pathLength: 1, opacity: 1 }],
], EASE_SLAM);
const FRAYED = landsAt(T_TIED + 0.3, 0.2, { opacity: [0, 1] }, 'easeOut');
const KNOT_POP = landsAt(T_TIED + 0.05, 0.7, { opacity: [0, 1, 0], scale: [0.2, 1.3, 1.6], rotate: [0, 20, 45] }, EASE_OUT);
const SHADOW = landsAt(T_POSTER + 0.1, 0.6, { opacity: [0, 1] }, 'easeOut');

// The bracelet breathes once the card is built. Ambient: rests at 0.
const FLOAT = {
  initial: { y: 0 },
  animate: { y: [0, -6, 0] },
  transition: { duration: 3.4, ease: 'easeInOut', repeat: Infinity, delay: 11.4 },
};

// ── The floods ───────────────────────────────────────────────
// Each truth's colour spreads out of its own bead as a DISC: a small solid
// circle (20vmax across) that the GPU scales up until it covers the frame.
// It is rasterised once, at its small size, and the spread is pure
// compositing: no clip-path, no repaint, nothing screen-sized to re-draw.
// The first cut clipped six full-screen gradient layers with animated
// clip-paths, and a phone's GPU could not keep up: it composited stale
// tiles, flashing hard-edged rectangles of the dark and of earlier
// colours at every bead (owner's screen recording, 2026-09-28).
//
// Each disc simply paints OVER the last. None switches itself off
// mid-sequence (one that did, the moment the next was due to cover it,
// could leave a frame with nothing covering the stage); they all clear
// together at T_GONE, long after the poster's own disc has covered them.
// Each word and effect lives in its own small layer above the discs, and
// fades as the next colour arrives.
//
// The spread is slow and even (a fast one strobed), and each disc grows
// only to just past the farthest corner of whatever screen it is on, from
// a wide TV down to a phone held upright.
const FLOOD_OPEN = 0.95;
const EASE_SPREAD = [0.37, 0, 0.25, 1];
const DISC_VMAX = 20;
/**
 * How far a disc starting at (xPct, yPct) of the overscanned box must scale
 * to cover it, on every screen shape the signage may be shown on.
 */
export function discScale(xPct, yPct) {
  let need = 0;
  for (const aspect of [16 / 9, 4 / 3, 1, 9 / 16]) {
    // The box, in fractions of vmax (it overscans the frame by BLEED).
    const grow = (100 + BLEED * 2) / 100;
    const w = (aspect >= 1 ? 1 : aspect) * grow;
    const h = (aspect >= 1 ? 1 / aspect : 1) * grow;
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      need = Math.max(need, Math.hypot((cx - xPct) * w, (cy - yPct) * h));
    }
  }
  // need is a radius in vmax fractions; the disc's own radius is DISC_VMAX / 2.
  return Math.ceil(((need * 100 * 1.04) / (DISC_VMAX / 2)) * 10) / 10;
}
const disc = (at, x, y, gone, open = FLOOD_OPEN) => keyframes([
  [0, { scale: 0, opacity: 1 }],
  [at, { scale: 0 }],
  [at + open, { scale: discScale(x, y) }],
  ...(gone ? [[gone, { opacity: 1 }], [gone + 0.02, { opacity: 0 }]] : []),
], gone ? [EASE_OUT, EASE_SPREAD, 'linear', 'linear'] : [EASE_OUT, EASE_SPREAD]);
const BEAD_XP = BEAD_X.map((x) => parseFloat(pct(x, VIEW_W)) / 100);
const CORD_YP = parseFloat(pct(CORD_Y, VIEW_H)) / 100;
export const FLOODS = BEADS.map((_, i) => disc(T_BEADS[i], BEAD_XP[i], CORD_YP, T_GONE));

// Each truth's word and effect: in once its colour is spreading, out just
// after the next bead lands. The word itself slams in only when its colour
// has reached the top of the frame (WORD_IN), so it never sits on the last
// colour (white BAPTISM on white), and the last word is gone by then, so
// two never overlap.
const WORLD_IN = 0.2;
const WORD_IN = 0.42;
const WORLDS = BEADS.map((_, i) => {
  const at = T_BEADS[i];
  const out = i < BEADS.length - 1 ? T_BEADS[i + 1] + 0.1 : T_POSTER + 0.25;
  return keyframes([
    [0, { opacity: 0 }],
    [at + WORLD_IN, { opacity: 0 }],
    [at + WORLD_IN + 0.05, { opacity: 1 }],
    [out, { opacity: 1 }],
    [out + 0.2, { opacity: 0 }],
  ], 'linear');
});

// ONE CLOCK for the whole bead sequence. framer-motion hands opacity (and a
// whole `transform` string) to the browser's own animation engine but runs
// individual transforms (scale, x, y) and every SVG value on its JavaScript
// frame loop; on a busy screen the two drift apart, and a colour or a word
// arrived a second before its bead. An `onUpdate` callback keeps a value on
// the frame loop (framer-motion's own documented rule), so every disc, word
// layer and word carries this one, and the sequence slows down together on
// a slow screen instead of coming apart.
const SAME_CLOCK = () => {};

// The word slams in just behind its colour, then keeps pushing in until
// its layer fades as the next bead lands.
const word = (i) => {
  const at = T_BEADS[i];
  const until = i < BEADS.length - 1 ? T_BEADS[i + 1] + 0.3 : T_POSTER + 0.4;
  return keyframes([
    [0, { opacity: 0, scale: 1.7, y: '6vh' }],
    [at + WORD_IN, { opacity: 0, scale: 1.7, y: '6vh' }],
    [at + WORD_IN + 0.26, { opacity: 1, scale: 0.95, y: '0vh' }],
    [at + WORD_IN + 0.42, { scale: 1 }],
    [until, { scale: 1.07, opacity: 1 }],
  ], ['linear', EASE_SLAM, EASE_OUT, 'linear']);
};
const WORDS = BEADS.map((_, i) => word(i));

// BLOOD: a cross of light opens behind the word.
const CROSS_V = landsAt(T_BEADS[1] + 0.2, 0.7, { scaleY: [0, 1], opacity: [0, 1] }, EASE_OUT);
const CROSS_H = landsAt(T_BEADS[1] + 0.42, 0.6, { scaleX: [0, 1], opacity: [0, 1] }, EASE_OUT);

// PURITY: glints pop around the word.
const GLEAMS = (() => {
  const rnd = seeded(418);
  return [[22, 18], [78, 14], [14, 44], [86, 40], [30, 58], [70, 60], [50, 10]].map(([x, y], i) => ({
    key: i,
    x,
    y,
    size: n1(4 + rnd() * 4),
    anim: landsAt(T_BEADS[2] + 0.25 + i * 0.09, 0.6, { opacity: [0, 1, 0], scale: [0, 1.2, 0], rotate: [0, 45, 90] }, EASE_OUT),
  }));
})();

// BAPTISM: rings run out of the bead across the water.
const RIPPLES = [0, 0.22, 0.44].map((lag) => landsAt(
  T_BEADS[3] + 0.1 + lag, 1.1, { opacity: [0, 0.7, 0], scale: [0.1, 1, 1.8] }, EASE_OUT,
));

// GROWTH: two vines climb in from the bottom corners.
const VINE_L = 'M-20 930 C60 820 40 700 150 610 C250 530 190 420 300 330';
const VINE_R = 'M1620 930 C1540 820 1560 700 1450 610 C1350 530 1410 420 1300 330';
const VINE = landsAt(T_BEADS[4] + 0.1, 0.9, { pathLength: [0, 1], opacity: [0, 1] }, EASE_OUT);
const LEAVES = [
  [95, 760, -40], [150, 610, 30], [230, 520, -50], [270, 400, 20], [300, 330, -10],
].flatMap(([x, y, r], i) => [
  { key: `l${i}`, x, y, r, at: T_BEADS[4] + 0.25 + i * 0.12 },
  { key: `r${i}`, x: VIEW_W - x, y, r: -r + 180, at: T_BEADS[4] + 0.3 + i * 0.12 },
]).map((leaf) => ({ ...leaf, anim: landsAt(leaf.at, 0.45, { scale: [0, 1.2, 1], opacity: [0, 1, 1] }, EASE_OUT) }));
const LEAF_PATH = 'M0 0 C18 -26 52 -30 78 -8 C52 14 20 16 0 0z';

// HEAVEN: rays turn and the light blooms.
const RAYS = keyframes([
  [0, { opacity: 0, scale: 0.4, rotate: 0 }],
  [T_BEADS[5] + 0.1, { opacity: 0, scale: 0.4, rotate: 0 }],
  [T_BEADS[5] + 0.7, { opacity: 1, scale: 1, rotate: 20 }],
  [T_POSTER + 0.4, { opacity: 1, scale: 1.1, rotate: 60 }],
], [EASE_OUT, EASE_OUT, 'linear']);
const BLOOM = landsAt(T_BEADS[5] + 0.05, 0.8, { opacity: [0, 1, 0.75], scale: [0.3, 1.2, 1] }, EASE_OUT);

// ── The poster ground ────────────────────────────────────────
const KNOT_XP = parseFloat(pct(KNOT.x, VIEW_W)) / 100;
const KNOT_YP = parseFloat(pct(KNOT.y, VIEW_H)) / 100;
// The poster's lavender spreads a touch faster than a truth's colour: the
// copy waits for it (COPY_GATE), and the card has a beat sheet to keep.
const POSTER_OPEN = 0.75;
export const POSTER = disc(T_POSTER, KNOT_XP, KNOT_YP, null, POSTER_OPEN);
// The end card's copy and shapes open only once the lavender covers the
// frame, on the SAME clock as the lavender (see SAME_CLOCK), so a slow
// screen can never set the copy on the gold. Each piece still makes its
// own entrance inside the gate.
export const COPY_GATE = keyframes([
  [0, { opacity: 0 }],
  [T_POSTER + POSTER_OPEN, { opacity: 0 }],
  [T_POSTER + POSTER_OPEN + 0.02, { opacity: 1 }],
], 'linear');
// The poster's shapes arrive once its lavender has most of the frame.
const GROUND = landsAt(T_POSTER + 0.3, 0.35, { opacity: [0, 1] }, 'easeOut');
const CREAM = landsAt(T_POSTER + 0.3, 0.8, { y: ['40%', '-3%', '0%'] }, EASE_OUT);
const BLOB_A = landsAt(T_POSTER + 0.3, 0.9, { scale: [0.6, 1], opacity: [0, 1] }, EASE_OUT);
const BLOB_B = landsAt(T_POSTER + 0.4, 0.9, { scale: [0.6, 1], opacity: [0, 1] }, EASE_OUT);

// The lavender side of the card. A soft blob top right behind the map, one
// on the left behind the headline, and the cream wave with warm corners.
const BLOB_TR = 'M1010 -20 C1060 120 1180 200 1260 300 C1340 400 1420 520 1620 560 L1620 -20 Z';
const BLOB_L = 'M-20 120 C80 80 170 150 190 240 C210 330 140 390 60 430 C20 450 -20 450 -20 450 Z';
const CREAM_WAVE = 'M-20 600 C160 560 320 620 520 640 C760 664 900 560 1120 560 C1300 560 1420 630 1620 600 L1620 920 L-20 920 Z';

// ── The journey ──────────────────────────────────────────────
// From our club in Waterville, Maine, east to Uganda. Both are hand drawn
// from the real borders (lon/lat, smoothed), each on its own little map:
// at true scale Maine would be a speck an ocean away.
/**
 * A lon/lat projection that puts (lon0, lat0) at stage point (x, y), with
 * `k` px per degree of latitude and longitude squeezed by cos(latitude).
 */
const projection = ({ x, y, k, lon0, lat0 }) => {
  const kx = k * Math.cos((lat0 * Math.PI) / 180);
  return ([lon, lat]) => [x + (lon - lon0) * kx, y + (lat0 - lat) * k];
};

// Waterville sits exactly on the home pin.
const HOME = Object.freeze({ x: 1044, y: 322 });
const toMaine = projection({ x: HOME.x, y: HOME.y, k: 32, lon0: -69.63, lat0: 44.55 });
const MAINE = [
  [-70.7, 43.08], [-70.98, 43.35], [-70.99, 44.1], [-71.08, 45.3], [-70.84, 45.4], [-70.4, 45.73],
  [-70.26, 46.1], [-70.05, 46.4], [-69.99, 46.7], [-69.23, 47.45], [-68.9, 47.18], [-68.23, 47.35],
  [-67.79, 47.07], [-67.79, 45.94], [-67.43, 45.59], [-67.46, 45.28], [-67.0, 44.8], [-67.8, 44.5],
  [-68.6, 44.3], [-69.1, 44.0], [-69.8, 43.75], [-70.3, 43.6],
];

// Uganda, with the Ugandan part of Lake Victoria cut out of the south-east.
const toUganda = projection({ x: 1228, y: 96, k: 40, lon0: 29.58, lat0: 4.22 });
const UGANDA = [
  [30.86, 3.49], [31.25, 3.79], [31.95, 3.6], [32.4, 3.75], [33.02, 3.89], [33.51, 3.75], [33.99, 4.22],
  [34.39, 3.62], [34.48, 2.95], [35.0, 1.9], [34.55, 1.12], [34.05, 0.45], [33.9, -0.95], [31.8, -1.0],
  [30.82, -1.06], [30.42, -1.13], [29.6, -1.39], [29.58, -0.9], [29.82, -0.2], [29.88, 0.6], [30.1, 1.1],
  [30.48, 1.58], [31.3, 2.2], [31.18, 2.62], [30.78, 3.0],
];
const LAKE = [
  [31.8, -1.0], [31.75, -0.6], [32.05, -0.1], [32.45, 0.05], [32.7, 0.25], [33.2, 0.4], [33.55, 0.12],
  [33.9, 0.05], [33.9, -0.95],
];

/** A closed Catmull-Rom curve through the points, as cubic Béziers. */
function smoothClosed(points, project) {
  const p = points.map(project);
  const count = p.length;
  let d = `M${n1(p[0][0])} ${n1(p[0][1])}`;
  for (let i = 0; i < count; i += 1) {
    const p0 = p[(i - 1 + count) % count];
    const p1 = p[i];
    const p2 = p[(i + 1) % count];
    const p3 = p[(i + 2) % count];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
  }
  return `${d}z`;
}
const MAINE_PATH = smoothClosed(MAINE, toMaine);
const UGANDA_PATH = smoothClosed(UGANDA, toUganda);
const LAKE_PATH = smoothClosed(LAKE, toUganda);

const [PIN_X, PIN_Y] = toUganda([32.35, 1.55]);
// The Waterville label sits just under Maine's southern coast.
const HOME_LABEL_Y = n1(Math.max(...MAINE.map((pt) => toMaine(pt)[1])) + 27);
const ARC_C = Object.freeze({ x: 1110, y: 96 });
const ARC_PATH = `M${HOME.x} ${HOME.y} Q${ARC_C.x} ${ARC_C.y} ${n1(PIN_X)} ${n1(PIN_Y)}`;

// The tiny traveller rides the same quadratic, sampled into keyframes.
const TRAVEL = (() => {
  const steps = 12;
  const q = (t, a, c, b) => (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t ** 2 * b;
  const frames = [[0, { x: HOME.x, y: HOME.y, opacity: 0, scale: 0.4 }], [T_ARC, { x: HOME.x, y: HOME.y, opacity: 0, scale: 0.4 }]];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    frames.push([T_ARC + (T_PIN - T_ARC) * t, {
      x: n1(q(t, HOME.x, ARC_C.x, PIN_X)),
      y: n1(q(t, HOME.y, ARC_C.y, PIN_Y)),
      opacity: 1,
      scale: 0.4 + 0.6 * Math.sin(Math.PI * t),
    }]);
  }
  frames.push([T_PIN + 0.08, { opacity: 0, scale: 0.2 }]);
  return keyframes(frames, 'linear');
})();

const MAINE_LINE = landsAt(9.85, 0.7, { pathLength: [0, 1], opacity: [0, 1] }, EASE_INOUT);
const MAINE_FILL = landsAt(10.2, 0.5, { opacity: [0, 1] }, 'easeOut');
const HOME_LABEL = landsAt(10.15, 0.4, { opacity: [0, 1] }, 'easeOut');
const MAP_LINE = landsAt(10.0, 0.9, { pathLength: [0, 1], opacity: [0, 1] }, EASE_INOUT);
const MAP_FILL = landsAt(10.5, 0.5, { opacity: [0, 1] }, 'easeOut');
const LAKE_FILL = landsAt(10.7, 0.5, { opacity: [0, 1] }, 'easeOut');
const HOME_PIN = landsAt(10.0, 0.45, { y: [-40, 6, 0], opacity: [0, 1, 1] }, EASE_OUT);
// (Opacity too: a zero-length round-capped stroke still paints a dot.)
const ARC = landsAt(T_ARC, T_PIN - T_ARC, { pathLength: [0, 1], opacity: [0, 1] }, EASE_INOUT);
const UG_PIN = landsAt(T_PIN, 0.5, { y: [-60, 8, 0], opacity: [0, 1, 1], scale: [0.6, 1.1, 1] }, EASE_OUT);
const UG_RING = landsAt(T_PIN + 0.1, 0.9, { opacity: [0, 0.9, 0], scale: [0.2, 1, 1.8] }, EASE_OUT);
const MAP_LABELS = landsAt(T_PIN + 0.1, 0.4, { opacity: [0, 1] }, 'easeOut');

// ── The doodles on the card ──────────────────────────────────
const SPARK = 'M0 -50 C6 -12 12 -6 50 0 C12 6 6 12 0 50 C-6 12 -12 6 -50 0 C-12 -6 -6 -12 0 -50z';
const DOODLES = Object.freeze([
  { kind: 'spark', x: 1540, y: 128, s: 0.8, tone: '#ffffff', at: 10.45 },
  { kind: 'spark', x: 1478, y: 212, s: 0.36, tone: '#ffd23f', at: 10.55 },
  { kind: 'spark', x: 952, y: 104, s: 0.34, tone: '#ffd23f', at: 10.6 },
  { kind: 'spark', x: 900, y: 540, s: 0.3, tone: '#ffffff', at: 10.9 },
  { kind: 'spark', x: 1560, y: 520, s: 0.46, tone: '#f5a30b', at: 11.0 },
  { kind: 'spark', x: 940, y: 800, s: 0.32, tone: '#f5a30b', at: 11.05 },
  { kind: 'spark', x: 1520, y: 836, s: 0.42, tone: '#f5a30b', at: 11.15 },
  { kind: 'zig', x: 980, y: 452, s: 1, tone: '#ffffff', at: 10.8 },
  { kind: 'zig', x: 1080, y: 846, s: 0.9, tone: '#f5a30b', at: 11.1 },
  { kind: 'dot', x: 1580, y: 330, s: 7, tone: '#ffffff', at: 10.7 },
  { kind: 'dot', x: 870, y: 640, s: 6, tone: '#f5a30b', at: 10.95 },
  { kind: 'dot', x: 1576, y: 720, s: 8, tone: '#b7a6f2', at: 11.1 },
  { kind: 'dot', x: 1110, y: 460, s: 5, tone: '#ffd23f', at: 11.2 },
  { kind: 'smile', x: 1508, y: 432, s: 1, tone: '#ffd23f', at: 11.2 },
].map((d, i) => ({
  ...d,
  key: i,
  anim: landsAt(d.at, 0.5, { scale: [0, 1.25, 1], opacity: [0, 1, 1], rotate: [-30, 8, 0] }, EASE_OUT),
  // The sparkles twinkle forever; the loop rests on full size.
  twinkle: d.kind === 'spark'
    ? { initial: { scale: 1 }, animate: { scale: [1, 0.72, 1] }, transition: { duration: 1.6 + (i % 3) * 0.5, ease: 'easeInOut', repeat: Infinity, delay: 11.6 + (i % 4) * 0.3 } }
    : {},
})));

function Doodle({ d }) {
  let art;
  if (d.kind === 'spark') art = <path d={SPARK} fill={d.tone} />;
  else if (d.kind === 'zig') art = <path d="M-40 14 L-14 -14 L6 10 L36 -20" fill="none" stroke={d.tone} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />;
  else if (d.kind === 'dot') art = <circle r={d.s} fill={d.tone} />;
  else {
    art = (
      <g fill="none" stroke={d.tone} strokeWidth="6" strokeLinecap="round">
        <circle r="46" />
        <path d="M-22 10 C-12 28 12 28 22 10" />
        <path d="M-15 -14 v8 M15 -14 v8" />
      </g>
    );
  }
  const scale = d.kind === 'spark' || d.kind === 'zig' ? d.s : 1;
  return (
    <g transform={`translate(${d.x} ${d.y})`}>
      <M.g {...d.anim}>
        <M.g {...d.twinkle}>
          <g transform={`scale(${scale})`}>{art}</g>
        </M.g>
      </M.g>
    </g>
  );
}

// ── The copy ─────────────────────────────────────────────────
const WORDMARK_URL = (() => {
  try {
    return new URL('shared/brand/logos/awana-clubs-white.svg', window.location.href).href;
  } catch {
    return '';
  }
})();

const MAKING = [
  landsAt(9.85, 0.5, { opacity: [0, 1], y: ['0.6em', '0em'], rotate: [-6, 0] }, EASE_OUT),
  landsAt(9.98, 0.5, { opacity: [0, 1], y: ['0.6em', '0em'], rotate: [6, 0] }, EASE_OUT),
];
const HERO = 'BRACELETS';
const HERO_AT = 10.1;
const heroLetter = (i) => {
  const bead = BEADS[i % BEADS.length];
  const at = HERO_AT + i * 0.06;
  return keyframes([
    [0, { opacity: 0, y: '-0.9em', rotate: i % 2 ? 16 : -16, scale: 1.3, color: bead.tone }],
    [at, { opacity: 0, y: '-0.9em', rotate: i % 2 ? 16 : -16, scale: 1.3, color: bead.tone }],
    [at + 0.22, { opacity: 1, y: '0.06em', rotate: 0, scale: 0.94 }],
    [at + 0.34, { y: '0em', scale: 1, color: bead.tone }],
    [at + 0.6, { color: '#f5a30b' }],
  ], ['linear', [0.5, 0, 0.9, 0.5], EASE_OUT, 'easeOut']);
};
const HERO_LETTERS = [...HERO].map((_, i) => heroLetter(i));
const FOR_KIDS = landsAt(10.6, 0.6, { clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], x: ['-0.4em', '0em'] }, EASE_OUT);
const DATE_PILL = landsAt(10.95, 0.5, { opacity: [0, 1, 1], scale: [0.5, 1.08, 1], rotate: [-6, 1, 0] }, EASE_SLAM);
const DATE_TEXT = landsAt(11.05, 0.4, { opacity: [0, 1], y: ['0.4em', '0em'] }, EASE_OUT);

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

/** The poster's own short date: "WED, SEPT 30". Empty for a bad key. */
export function posterDate(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  if (!m) return '';
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return '';
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * A group that rides its keyframes, or, under zero animation, simply sits at
 * its resting transform as a plain SVG attribute. framer-motion applies an
 * SVG element's transform only after measuring its box on the next frame,
 * so the frozen card would otherwise paint one frame with every bead stacked
 * at the stage's top-left corner (on the Pi, where that frame is long).
 */
function Moving({ anim, rest, className, children }) {
  const still = useContext(ZeroAnimationContext);
  if (still) {
    return (
      <g className={className} transform={`translate(${rest.x} ${rest.y}) rotate(${rest.rotate}) scale(${rest.scale})`}>
        {children}
      </g>
    );
  }
  return <M.g className={className} {...anim}>{children}</M.g>;
}

function Bead({ bead, index }) {
  const id = `promo-brc-${bead.key}`;
  const rest = BEAD_REST[index];
  return (
    <Moving className="promo-brc-bead" anim={BEAD_MOVES[index]} rest={{ ...rest, scale: BEAD_REST_SCALE }}>
      <ellipse cx="0" cy="58" rx="58" ry="12" fill="url(#promo-brc-bead-shadow)" />
      <rect x="-60" y="-52" width="120" height="104" rx="30" fill={`url(#${id})`} stroke={bead.dark} strokeOpacity="0.55" strokeWidth="3" />
      {/* The hole's shadow where the cord goes in, and the base's shade. */}
      <rect x="-60" y="-10" width="10" height="20" rx="4" fill="rgba(0,0,0,0.28)" />
      <rect x="50" y="-10" width="10" height="20" rx="4" fill="rgba(0,0,0,0.28)" />
      <rect x="-44" y="26" width="88" height="14" rx="7" fill="rgba(0,0,0,0.12)" />
      <M.rect x="-40" y="-40" width="80" height="17" rx="8.5" fill="#ffffff" {...GLINTS[index]} />
    </Moving>
  );
}

export default function BraceletsPromo({ promo, lines }) {
  const { tonight } = promo;
  const kicker = tonight ? 'Tonight!' : 'This week';

  return (
    <div className={`promo-slide promo-slide--bracelets${tonight ? ' promo-brc--tonight' : ''}`}>
      <M.div
        className="promo-brc-shake"
        initial={{ x: 0, y: 0 }}
        animate={{ x: BRACELET_SHAKE.x, y: BRACELET_SHAKE.y }}
        transition={{ duration: SHOWREEL_SEC, times: BRACELET_SHAKE.times, ease: 'linear' }}
      >
        <M.div className="promo-brc-camera" {...CAMERA}>
          {/* The dark the story opens in. */}
          <div className="promo-brc-night" aria-hidden="true" />

          {/* One disc per truth, each spreading its colour out of its bead. */}
          <div className="promo-brc-discs" aria-hidden="true">
            {BEADS.map((bead, i) => (
              <M.div
                key={bead.key}
                className={`promo-brc-disc promo-brc-disc--${bead.key}`}
                style={{ left: pct(BEAD_X[i], VIEW_W), top: pct(CORD_Y, VIEW_H) }}
                onUpdate={SAME_CLOCK}
                {...FLOODS[i]}
              />
            ))}
          </div>
          <div className="promo-brc-light" aria-hidden="true" />

          {/* Each truth's word and effect, over its colour. */}
          {BEADS.map((bead, i) => (
            <M.div key={bead.key} className={`promo-brc-world promo-brc-world--${bead.key}`} aria-hidden="true" onUpdate={SAME_CLOCK} {...WORLDS[i]}>
              {bead.key === 'blood' && (
                <div className="promo-brc-cross">
                  <M.div className="promo-brc-cross-v" {...CROSS_V} />
                  <M.div className="promo-brc-cross-h" {...CROSS_H} />
                </div>
              )}
              {bead.key === 'purity' && GLEAMS.map((g) => (
                <M.svg
                  key={g.key}
                  className="promo-brc-gleam"
                  style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.size}vmin` }}
                  viewBox="-50 -50 100 100"
                  {...g.anim}
                >
                  <path d={SPARK} />
                </M.svg>
              ))}
              {bead.key === 'baptism' && (
                <svg className="promo-brc-fx" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
                  {RIPPLES.map((r, j) => (
                    <g key={j} transform={`translate(${BEAD_X[3]} ${CORD_Y})`}>
                      <M.ellipse rx="520" ry="200" className="promo-brc-ripple" {...r} />
                    </g>
                  ))}
                </svg>
              )}
              {bead.key === 'growth' && (
                <svg className="promo-brc-fx" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
                  <M.path d={VINE_L} className="promo-brc-vine" {...VINE} />
                  <M.path d={VINE_R} className="promo-brc-vine" {...VINE} />
                  {LEAVES.map((leaf) => (
                    <g key={leaf.key} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r})`}>
                      <M.path d={LEAF_PATH} className="promo-brc-leaf" {...leaf.anim} />
                    </g>
                  ))}
                </svg>
              )}
              {bead.key === 'heaven' && (
                <>
                  <M.div className="promo-brc-rays" {...RAYS} />
                  <M.div className="promo-brc-bloom" {...BLOOM} />
                </>
              )}
              <div className="promo-brc-word-slot">
                <M.h2 className={`promo-brc-word promo-brc-word--${bead.key}`} onUpdate={SAME_CLOCK} {...WORDS[i]}>{bead.word}</M.h2>
              </div>
            </M.div>
          ))}

          {/* The printed poster's lavender spreads out of the knot, over
              everything above, then its shapes arrive on it. */}
          <div className="promo-brc-discs" aria-hidden="true">
            <M.div
              className="promo-brc-disc promo-brc-disc--poster"
              style={{ left: pct(KNOT.x, VIEW_W), top: pct(KNOT.y, VIEW_H) }}
              onUpdate={SAME_CLOCK}
              {...POSTER}
            />
          </div>
          <M.div className="promo-brc-poster" aria-hidden="true" onUpdate={SAME_CLOCK} {...GROUND}>
            <svg className="promo-brc-ground" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
              <M.path d={BLOB_TR} fill="#c4b6f6" style={{ transformOrigin: '100% 0%' }} {...BLOB_A} />
              <M.path d={BLOB_L} fill="#c4b6f6" style={{ transformOrigin: '0% 50%' }} {...BLOB_B} />
              <M.g {...CREAM}>
                <path d={CREAM_WAVE} fill="#fdf2dc" />
                <ellipse cx="1600" cy="900" rx="170" ry="130" fill="#fbe2b0" />
                <ellipse cx="-10" cy="880" rx="150" ry="110" fill="#fbe7bf" />
              </M.g>
            </svg>
          </M.div>

          {/* The stage: the journey, the doodles, the cord and the beads. */}
          <svg className="promo-brc-stage" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <radialGradient id="promo-brc-floor">
                <stop offset="0" stopColor="#604628" stopOpacity="0.26" />
                <stop offset="1" stopColor="#604628" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="promo-brc-bead-shadow">
                <stop offset="0" stopColor="#000" stopOpacity="0.4" />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </radialGradient>
              {BEADS.map((bead) => (
                <linearGradient key={bead.key} id={`promo-brc-${bead.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={bead.light} />
                  <stop offset="0.42" stopColor={bead.tone} />
                  <stop offset="1" stopColor={bead.dark} />
                </linearGradient>
              ))}
            </defs>

            <g className="promo-brc-map">
              <M.path d={MAINE_PATH} className="promo-brc-country-fill" {...MAINE_FILL} />
              <M.path d={MAINE_PATH} className="promo-brc-country-line" {...MAINE_LINE} />
              <M.path d={UGANDA_PATH} className="promo-brc-country-fill" {...MAP_FILL} />
              <M.path d={LAKE_PATH} className="promo-brc-lake" {...LAKE_FILL} />
              <M.path d={UGANDA_PATH} className="promo-brc-country-line" {...MAP_LINE} />
              {/* pathLength owns the dash array, so it draws a mask and the
                  dotted line shows through it. */}
              <mask id="promo-brc-arc-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={VIEW_W} height={VIEW_H}>
                <M.path d={ARC_PATH} className="promo-brc-arc-reveal" {...ARC} />
              </mask>
              <path d={ARC_PATH} className="promo-brc-arc" mask="url(#promo-brc-arc-mask)" />
              <M.g {...HOME_PIN}>
                <circle cx={HOME.x} cy={HOME.y} r="11" className="promo-brc-home" />
                <circle cx={HOME.x} cy={HOME.y} r="4" fill="#2b1b5a" />
              </M.g>
              <g transform={`translate(${n1(PIN_X)} ${n1(PIN_Y)})`}>
                <M.circle r="46" className="promo-brc-pin-ring" {...UG_RING} />
                <M.g {...UG_PIN}>
                  <path d="M0 0 C-4 -12 -22 -24 -22 -40 A22 22 0 1 1 22 -40 C22 -24 4 -12 0 0z" className="promo-brc-pin" />
                  <circle cy="-40" r="8" fill="#ffffff" />
                </M.g>
              </g>
              <M.text x={HOME.x} y={HOME_LABEL_Y} className="promo-brc-map-label" textAnchor="middle" {...HOME_LABEL}>WATERVILLE, ME</M.text>
              <M.g {...MAP_LABELS}>
                <text x={n1(PIN_X)} y={n1(PIN_Y) + 44} className="promo-brc-map-label promo-brc-map-label--ug" textAnchor="middle">UGANDA</text>
              </M.g>
              <M.g {...TRAVEL}>
                <circle r="18" fill="none" stroke="#1c1b22" strokeWidth="4" />
                {BEADS.map((bead, i) => (
                  <circle key={bead.key} cx={n1(18 * Math.cos(Math.PI * (0.15 + i * 0.14)))} cy={n1(18 * Math.sin(Math.PI * (0.15 + i * 0.14)))} r="5" fill={bead.tone} />
                ))}
              </M.g>
            </g>

            {DOODLES.map((d) => <Doodle key={d.key} d={d} />)}

            <M.ellipse cx={LOOP.cx + 10} cy={LOOP.cy + LOOP.ry + 34} rx="230" ry="26" fill="url(#promo-brc-floor)" {...SHADOW} />

            {SHOCKS.map((s, i) => (
              <g key={BEADS[i].key} transform={`translate(${BEAD_X[i]} ${CORD_Y})`}>
                <M.circle r="120" className="promo-brc-shock" {...s} />
              </g>
            ))}
            {DUST.map((p) => <M.circle key={p.key} r={p.r} className="promo-brc-dust" {...p.anim} />)}

            <M.g {...FLOAT}>
              <M.path className="promo-brc-cord" {...CORD} />
              <M.path className="promo-brc-cord-rim" {...CORD_RIM} />
              <M.path d={TAIL_L} className="promo-brc-cord promo-brc-tail" {...TAILS} />
              <M.path d={TAIL_R} className="promo-brc-cord promo-brc-tail" {...TAILS} />
              <M.g {...FRAYED}>
                {FRAY.map((f) => <path key={f} d={f} className="promo-brc-fray" />)}
              </M.g>
              {BEADS.map((bead, i) => <Bead key={bead.key} bead={bead} index={i} />)}
              {SLIDERS.map((s) => (
                <Moving key={s.side} anim={s.anim} rest={s.rest}>
                  <rect x="-44" y="-40" width="88" height="80" rx="24" className="promo-brc-slider" />
                  <rect x="-30" y="-30" width="60" height="12" rx="6" fill="#ffffff" opacity="0.85" />
                </Moving>
              ))}
              <g transform={`translate(${KNOT.x} ${KNOT.y - 6})`}>
                <M.path d={SPARK} className="promo-brc-knot-pop" {...KNOT_POP} />
              </g>
            </M.g>
          </svg>
        </M.div>
      </M.div>

      <PosterDepth />
      <M.div className="promo-brc-copy" onUpdate={SAME_CLOCK} {...COPY_GATE}>
        <Wordmark at={9.9} src={WORDMARK_URL} />

        <div className="promo-brc-stack">
          <CountdownChip label={kicker} at={9.95} pulses={[...END_PULSES]} />
          <h2 className="promo-brc-headline" aria-label={`We’re making ${HERO} for kids in Uganda`}>
            <span className="promo-brc-making" aria-hidden="true">
              <M.span className="promo-brc-beat" {...MAKING[0]}>WE’RE</M.span>
              {' '}
              <M.span className="promo-brc-beat" {...MAKING[1]}>MAKING</M.span>
            </span>
            <span className="promo-brc-hero" aria-hidden="true">
              {[...HERO].map((ch, i) => (
                <M.span key={i} className="promo-brc-letter" {...HERO_LETTERS[i]}>{ch}</M.span>
              ))}
            </span>
            <M.span className="promo-brc-for" aria-hidden="true" {...FOR_KIDS}>FOR KIDS IN UGANDA</M.span>
          </h2>
        </div>

        <div className="promo-brc-foot">
          <RotatingDetail lines={lines} startMs={10800} stepMs={1100} />
          <M.div className="promo-brc-date" {...DATE_PILL}>
            <M.span className="promo-date promo-brc-date-text" {...DATE_TEXT}>{posterDate(promo.eventDate)}</M.span>
          </M.div>
        </div>
      </M.div>
    </div>
  );
}
