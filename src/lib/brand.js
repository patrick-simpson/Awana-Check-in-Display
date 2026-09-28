// @ts-check
// The lobby's handle on the shared brand kit (shared/brand/, see its
// README): the motion table, the stepped chip's geometry and the catalog
// shapes, all read from the kit itself so there is one copy of each.
//
// Pure data and pure functions only. The components that draw with them
// live in src/components/brand/.

import tokens from '../../shared/brand/tokens.json';
import waveSvg from '../../shared/brand/shapes/wave-journey.svg?raw';
import tabSvg from '../../shared/brand/shapes/tab-c-journey.svg?raw';
import starburstSvg from '../../shared/brand/shapes/starburst.svg?raw';
import tipBlobSvg from '../../shared/brand/shapes/tip-blob.svg?raw';
import sparkleSvg from '../../shared/brand/doodles/sparkle-4pt.svg?raw';
import sparkleXSvg from '../../shared/brand/doodles/sparkle-4pt-x.svg?raw';
import dotSvg from '../../shared/brand/doodles/dot.svg?raw';
import ringSvg from '../../shared/brand/doodles/ring.svg?raw';
import squiggleSvg from '../../shared/brand/doodles/squiggle-wave.svg?raw';
import zigzagSvg from '../../shared/brand/doodles/zigzag.svg?raw';
import loopSvg from '../../shared/brand/doodles/loop.svg?raw';

/* ── Motion: one rhythm, four curves ─────────────────────────────── */

/** One beat, in seconds (framer-motion's unit). Everything starts on one. */
export const BEAT = tokens.motion.beatMs / 1000;

/** @param {number} n */
export const beats = (n) => Math.round(n * tokens.motion.beatMs) / 1000;

/**
 * The only four curves on screen, as framer-motion cubic-bezier arrays:
 * wipe (color fields and waves), settle (type landing), pop (stickers and
 * chips, a small overshoot) and exit (leaving; exits run faster).
 * @type {{ wipe: number[], settle: number[], pop: number[], exit: number[] }}
 */
export const EASE = tokens.motion.curves;

/** Durations in seconds, keyed like tokens.json's durationsMs. */
export const DUR = /** @type {Record<string, number>} */ (
  Object.fromEntries(Object.entries(tokens.motion.durationsMs).map(([k, ms]) => [k, ms / 1000]))
);

/* ── Shapes, straight out of the kit's SVG files ─────────────────── */

/**
 * Pull the viewBox and the path data out of one of the kit's single-shape
 * SVGs. The kit files are plain `<svg viewBox><path d/></svg>`; a file that
 * isn't would throw here at import, which fails the build rather than a
 * screen.
 * @param {string} svg
 * @param {string} name
 * @returns {{ viewBox: string, d: string, stroked: boolean }}
 */
export function parseShape(svg, name) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  const d = svg.match(/\sd="([^"]+)"/)?.[1];
  if (!viewBox || !d) throw new Error(`brand kit shape ${name} is not a single-path SVG`);
  return { viewBox, d, stroked: /fill="none"/.test(svg) };
}

export const SHAPES = {
  wave: parseShape(waveSvg, 'wave'),
  tab: parseShape(tabSvg, 'tab'),
  starburst: parseShape(starburstSvg, 'starburst'),
  tipBlob: parseShape(tipBlobSvg, 'tip-blob'),
};

export const DOODLES = {
  sparkle: parseShape(sparkleSvg, 'sparkle'),
  sparkleX: parseShape(sparkleXSvg, 'sparkle-x'),
  dot: parseShape(dotSvg, 'dot'),
  ring: parseShape(ringSvg, 'ring'),
  squiggle: parseShape(squiggleSvg, 'squiggle'),
  zigzag: parseShape(zigzagSvg, 'zigzag'),
  loop: parseShape(loopSvg, 'loop'),
};

/** @typedef {keyof typeof DOODLES} DoodleKind */

/* ── The stepped chip ────────────────────────────────────────────── */

// Proportions measured off the catalog's own chip (p.63 "GRADES / 9-12"),
// in units of the value's font size (1em): a pill-shaped label tier over a
// wider value block that steps out to the right, with the value set at
// ~1.8x the label.
const CHIP = {
  labelSize: 0.56,
  pillHeight: 1.15,
  pillPad: 0.42,
  pillMin: 2.2,
  blockLeft: 0.84,
  blockTop: 1.05,
  blockHeight: 1.38,
  blockPad: 0.5,
  step: 0.5,
  radiusBR: 0.39,
  radiusBL: 0.27,
};

/**
 * Geometry for one stepped chip, built around its own text so nothing can
 * spill off the plate (the v1 mockup's fixed plate did, for "TONIGHT").
 * Widths are the texts' advance widths in em of a 1em font (see
 * measureEm); the label is drawn at CHIP.labelSize of that.
 *
 * @param {number} labelEm  label advance width at 1em
 * @param {number} valueEm  value advance width at 1em
 */
export function chipGeometry(labelEm, valueEm) {
  const lw = Math.max(0, labelEm) * CHIP.labelSize;
  const vw = Math.max(0, valueEm);
  const H1 = CHIP.pillHeight;
  const r1 = H1 / 2;
  const W1 = Math.max(lw + CHIP.pillPad * 2, CHIP.pillMin);
  const bx0 = CHIP.blockLeft;
  const by0 = CHIP.blockTop;
  const by1 = by0 + CHIP.blockHeight;
  let bx1 = bx0 + vw + CHIP.blockPad * 2;
  // The value block always steps out past the label pill: that step is the
  // chip's whole silhouette.
  if (bx1 < W1 + CHIP.step) bx1 = W1 + CHIP.step;
  const rBR = CHIP.radiusBR;
  const rBL = CHIP.radiusBL;
  /** @param {number} v */
  const n = (v) => Number(v.toFixed(3));
  const d = [
    `M${n(r1)},0`, `L${n(W1 - r1)},0`, `A${n(r1)},${n(r1)} 0 0 1 ${n(W1)},${n(r1)}`,
    `L${n(W1)},${n(by0)}`, `L${n(bx1)},${n(by0)}`, `L${n(bx1)},${n(by1 - rBR)}`,
    `A${rBR},${rBR} 0 0 1 ${n(bx1 - rBR)},${n(by1)}`, `L${n(bx0 + rBL)},${n(by1)}`,
    `A${rBL},${rBL} 0 0 1 ${n(bx0)},${n(by1 - rBL)}`, `L${n(bx0)},${n(H1)}`, `L${n(r1)},${n(H1)}`,
    `A${n(r1)},${n(r1)} 0 0 1 0,${n(r1)}`, `A${n(r1)},${n(r1)} 0 0 1 ${n(r1)},0`, 'Z',
  ].join(' ');
  return {
    d,
    label: { x: W1 / 2, y: H1 / 2 + 0.02, size: CHIP.labelSize, width: lw },
    value: { x: (bx0 + bx1) / 2, y: by0 + CHIP.blockHeight / 2 + 0.03, size: 1, width: vw },
    // Room for the plate's out-of-register offset (below and right).
    width: bx1 + 0.2,
    height: by1 + 0.14,
  };
}

/**
 * A rough advance width for when no canvas is available (tests, SSR).
 * @param {string} text
 */
const ROUGH = (text) => [...text].reduce((w, ch) => w + (ch === ' ' ? 0.3 : ch === ':' || ch === '.' ? 0.3 : 0.64), 0);

/** @type {OffscreenCanvasRenderingContext2D | null | undefined} */
let ctx;

/**
 * The advance width of `text` in em, in the display face. Measured on an
 * OffscreenCanvas where there is one (every screen we run on), else a
 * per-character estimate (jsdom has none, and its DOM canvas only logs
 * "not implemented"). Either way the chip also pins each text to its
 * measured width with SVG textLength, so a font that loads late can
 * squeeze, never spill.
 * @param {string} text
 * @param {string} [family]
 */
export function measureEm(text, family = tokens.fonts.display) {
  if (ctx === undefined) {
    try {
      ctx = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('2d') : null;
    } catch {
      ctx = null;
    }
  }
  if (!ctx) return ROUGH(text);
  ctx.font = `100px "${family}", "Arial Rounded MT Bold", sans-serif`;
  const w = ctx.measureText(text).width / 100;
  return Number.isFinite(w) && w > 0 ? w : ROUGH(text);
}

/* ── Club colors from the kit ────────────────────────────────────── */

export const BRAND_CLUBS = tokens.clubs;
export const HOUSE = tokens.house;
