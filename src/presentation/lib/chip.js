// @ts-check
// The stepped chip's geometry for the projector: the catalog's two-tier
// lockup (p.63 "GRADES / 9-12"), a small label on a pill over a big value on
// a block that steps out beneath it. The projector may not import the lobby's
// src/lib/brand.js (the isolation rule), so this is its own copy of the same
// proportions; chip.test.js checks the two agree, so they cannot drift.
//
// Pure functions only. StepChip.jsx draws with them.

// Proportions measured off the catalog's own chip, in units of the value's
// font size (1em): the label is set at ~0.56 of the value.
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
 * Geometry for one chip, built around its own text so nothing can spill off
 * the plate. Widths are advance widths in em of a 1em font (see measureEm).
 * @param {number} labelEm
 * @param {number} valueEm
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
 * A rough advance width for when no canvas is available (tests).
 * @param {string} text
 */
const ROUGH = (text) => [...text].reduce((w, ch) => w + (ch === ' ' || ch === ':' || ch === '.' ? 0.3 : 0.64), 0);

/** @type {OffscreenCanvasRenderingContext2D | null | undefined} */
let ctx;

/**
 * The advance width of `text` in em of the shout face (Galindo), measured on
 * an OffscreenCanvas where there is one, else a per-character estimate. The
 * chip also pins each text to its measured width with SVG textLength, so a
 * face that loads late can squeeze, never spill.
 * @param {string} text
 * @param {string} [family]
 */
export function measureEm(text, family = 'Galindo') {
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

/**
 * The widest a value can get while it counts: every digit swapped for a
 * zero (Galindo's widest figure), so a chip carrying a ticking number is
 * sized once for the whole count instead of twitching every second.
 * @param {string} value
 */
export function widestDigits(value) {
  return value.replace(/[0-9]/g, '0');
}
