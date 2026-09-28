// @ts-check
// The lobby's copy frame (rebrand stage 4b): what a slide says and how big it
// can say it. Pure: a slide goes in, a frame model comes out, and the fit
// turns that model into sizes and line breaks by measuring the words in the
// faces that will draw them. The components only render the result.
//
// Every length here is in u: 1% of a 16:9 stage's width, which on a TV is
// min(1vw, 1.7778vh) and in the slide editor's 1600x900 thumbnail frame is
// 16px. The copy is laid out on a 100u x 56.25u box (centred on screens that
// are not 16:9), so a slide fits the same way on every screen and in every
// thumbnail.

import { chipGeometry } from './brand.js';

/* ── The layout box ──────────────────────────────────────────────── */

/**
 * Where the copy may go, measured off the approved mockup's renders (its
 * .slide-c sits at 14.6u, and its kicker's line box puts the letters half a
 * unit lower than ours, so ours starts at 15.1u to land on the same pixels). The
 * block starts at `top` and only rises (to `safeTop`) when it would otherwise
 * reach past `safeBottom`, which clears the house waves' crest (the
 * sunflower wave peaks at ~46.7u at the left edge, the orange at ~48u at the
 * right) and the bottom corner chip (from ~46.5u). `safeTop` keeps the widest
 * line clear of the corner tab's fat end and of the top-right chip stack.
 * `measure` is the shouted headline's preferred line length (the mockup's
 * longest line, THE GYM DOORS, runs 63.5u at 7.2u); `width` is the widest any
 * line may ever run.
 */
export const LAYOUT = { top: 15.1, safeTop: 11, safeBottom: 45, width: 84, measure: 68 };

/**
 * The kicker: Londrina Solid, tracked caps, one line. `gap` puts the
 * headline's caps where the mockup's are (its kicker-to-caps distance).
 */
export const KICKER = { size: 2.3, min: 1.6, gap: 1.9, tracking: 0.07 };

/**
 * The shouted headline: Galindo at true size, uppercase, line-height .98,
 * with a hard offset shadow of .42u at 7.2u (0.058em). `ceiling` is the
 * largest size a slide's textSize allows; below `min` a headline is no longer
 * a shout, and the frame falls back to the read layout.
 */
export const SHOUT = {
  max: 7.2,
  min: 5,
  /** The smallest size still set to the preferred measure before a line may run the full width. */
  measured: 6,
  step: 0.1,
  lineHeight: 0.98,
  /** At the measure a shout may take three lines; at the full width, two. */
  maxLines: 3,
  wideLines: 2,
  shadow: 0.058,
  /** @type {Record<string, number>} */
  ceiling: { auto: 7.2, xl: 7.2, lg: 5.8 },
};

/**
 * The read layout, for text too long to shout: Figtree (the kit's reading
 * voice) in the sentence case the operator typed, balanced lines, set in the
 * theme's dark reading ink rather than white-on-sky (a paragraph needs the
 * contrast a shout gets from its offset shadow). Every line lands as one
 * piece instead of word by word.
 */
export const READ = { max: 4.2, floor: 1.5, step: 0.1, lineHeight: 1.22, width: 76, shadow: 0 };

/** The supporting line under the headline (a special night's note, the book nudge). */
export const SUB = { size: 2.6, min: 2, step: 0.1, lineHeight: 1.2, gap: 1.4, width: 64, maxLines: 3 };

/** The stepped chip under it all ("WED / SEP 30"), 3.6u under the caps as in the mockup. */
export const CHIP = { size: 3.6, gap: 1.8 };

/* ── Themes, in the kit palette ──────────────────────────────────── */

/**
 * The five operator themes, re-expressed in the brand kit: a flat field with
 * tone-on-tone clouds (field darker, cloud lighter, like the studio sky), a
 * doodle colour, and the copy's colours. Values are kit tokens wherever the
 * kit has one; the few literals are the shades between two tokens that the
 * kit does not name (a lavender field between the Journey tint and Journey,
 * a navy shadow under the night sky). The headline's hard shadow changes per
 * theme where the Awana-blue one would vanish (night) or clash (the rest).
 *
 * @type {Record<string, { field: string, cloud: string, doodle: string, kicker: string, face: string, shadow: string, sub: string }>}
 */
export const LOBBY_THEMES = {
  // The studio sky: the approved mockup, exactly.
  sky: {
    field: 'var(--brand-sky)',
    cloud: 'var(--brand-cloud)',
    doodle: '#fff',
    kicker: 'var(--brand-blue-deep)',
    face: '#fff',
    shadow: 'var(--brand-blue)',
    sub: 'var(--brand-blue-deep)',
  },
  // Warm apricot under a cream sky; the headline burns hot orange so it
  // still reads on a light warm field.
  sunset: {
    field: '#FFD493',
    cloud: 'var(--brand-cream)',
    doodle: '#fff',
    kicker: 'var(--brand-hot-deep)',
    face: 'var(--brand-hot)',
    shadow: 'var(--brand-hot-deep)',
    sub: 'var(--brand-hot-deep)',
  },
  // The deep house blue after dark, cream starlight, a navy shadow.
  night: {
    field: 'var(--brand-blue-deep)',
    cloud: '#3F64AA',
    doodle: 'var(--brand-cream)',
    kicker: 'var(--brand-sun)',
    face: '#fff',
    shadow: '#1B2D5C',
    sub: 'var(--brand-cream)',
  },
  // T&T's green, pale.
  meadow: {
    field: '#B4DCBE',
    cloud: 'var(--brand-tnt-tint)',
    doodle: '#fff',
    kicker: 'var(--brand-trek-deep)',
    face: '#fff',
    shadow: 'var(--brand-tnt-deep)',
    sub: 'var(--brand-trek-deep)',
  },
  // The 2026-27 catalog cover's soft lavender, in Journey's colours.
  lavender: {
    field: '#C8BCDE',
    cloud: 'var(--brand-journey-tint)',
    doodle: '#fff',
    kicker: 'var(--brand-journey-ink)',
    face: '#fff',
    shadow: 'var(--brand-journey)',
    sub: 'var(--brand-journey-ink)',
  },
};

/** @param {string | null | undefined} theme */
export function lobbyTheme(theme) {
  return LOBBY_THEMES[theme ?? ''] ? /** @type {string} */ (theme) : 'sky';
}

/* ── Measuring ───────────────────────────────────────────────────── */

/** @typedef {'shout' | 'read' | 'label' | 'body'} Face */

/**
 * The canvas font for each face, matching the CSS stacks that draw them
 * (--font-shout, --font-body at 800 and 700, --font-condensed). Galindo's
 * stack falls back to Baloo 2 for the letters Galindo lacks, as the CSS does.
 * @type {Record<Face, string>}
 */
const FONTS = {
  shout: '400 100px Galindo, "Baloo 2 Variable", "Arial Rounded MT Bold", sans-serif',
  read: '800 100px "Figtree Variable", Figtree, "Segoe UI", system-ui, sans-serif',
  label: '400 100px "Londrina Solid", "Arial Narrow", sans-serif',
  body: '700 100px "Figtree Variable", Figtree, "Segoe UI", system-ui, sans-serif',
};

/**
 * Per-character estimates for when there is no canvas (jsdom, SSR): a
 * little wide on purpose, so an estimate never promises a fit the real face
 * would break.
 * @type {Record<Face, number>}
 */
const ROUGH = { shout: 0.7, read: 0.58, label: 0.46, body: 0.56 };

/** @type {OffscreenCanvasRenderingContext2D | null | undefined} */
let ctx;

/**
 * The advance width of `text` in em in one of the lobby's faces, measured on
 * an OffscreenCanvas (every screen we run on has one), else estimated.
 * @param {string} text
 * @param {Face} face
 * @returns {number}
 */
export function measureText(text, face) {
  if (ctx === undefined) {
    try {
      ctx = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('2d') : null;
    } catch {
      ctx = null;
    }
  }
  if (ctx) {
    ctx.font = FONTS[face];
    const w = ctx.measureText(text).width / 100;
    if (Number.isFinite(w) && w > 0) return w;
  }
  return [...text].reduce((w, ch) => w + (ch === ' ' ? 0.3 : ROUGH[face]), 0);
}

/** @typedef {(text: string, face: Face) => number} Measure */

/* ── The frame model ─────────────────────────────────────────────── */

/**
 * @typedef {{ label: string, value: string }} ChipText
 * @typedef {{
 *   kicker: string,
 *   headline: string,
 *   sub: string,
 *   chip: ChipText | null,
 *   textSize: string,
 * }} Frame
 */

/** @param {unknown} v */
const clean = (v) => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').trim() : '');

/**
 * What one slide says, in the frame's terms: the kicker (a typed slide's
 * eyebrow), the headline (its text), an optional supporting line and an
 * optional stepped chip. A calendar slide carries a `frame` of its own
 * (src/lib/calendarLogic.js) that moves its date into the chip; a typed slide
 * never can, because sanitizeSlides keeps only the fields it knows.
 *
 * @param {any} slide
 * @returns {Frame}
 */
export function slideFrame(slide) {
  const own = slide && typeof slide.frame === 'object' && slide.frame ? slide.frame : null;
  const chip = own?.chip && own.chip.label && own.chip.value
    ? { label: String(own.chip.label), value: String(own.chip.value) }
    : null;
  return {
    kicker: clean(slide?.eyebrow),
    headline: String((own ? own.headline : slide?.text) ?? '').trim(),
    sub: clean(own ? own.sub : slide?.subtext),
    chip,
    // A calendar frame is sized for its own short headline; the textSize it
    // carries was chosen for the old frame, where the date sat in the text.
    textSize: own ? 'auto' : String(slide?.textSize ?? 'auto'),
  };
}

/* ── Line breaking ───────────────────────────────────────────────── */

/**
 * @param {string} text
 * @returns {string[][]} paragraphs (the operator's own line breaks) of words
 */
export function paragraphs(text) {
  return String(text ?? '')
    .split(/\n+/)
    .map((p) => p.split(/\s+/).filter(Boolean))
    .filter((p) => p.length > 0);
}

/**
 * Split one paragraph into exactly `k` lines so the longest is as short as
 * possible (the balanced break a poster setter would make: MAKING /
 * BRACELETS, BRING YOUR / HANDBOOK). Never inside a word.
 * @param {number[]} widths each word's width
 * @param {number} space the width of a space
 * @param {number} k
 * @returns {{ max: number, breaks: number[] }} breaks: index of each line's first word
 */
export function balancedBreaks(widths, space, k) {
  const n = widths.length;
  const lines = Math.max(1, Math.min(k, n));
  const prefix = [0];
  for (const w of widths) prefix.push(prefix[prefix.length - 1] + w);
  /** @param {number} i @param {number} j words i..j-1 */
  const span = (i, j) => prefix[j] - prefix[i] + space * (j - i - 1);
  // best[l][j]: the least possible longest line setting words 0..j-1 in l lines.
  const best = Array.from({ length: lines + 1 }, () => new Array(n + 1).fill(Infinity));
  const from = Array.from({ length: lines + 1 }, () => new Array(n + 1).fill(0));
  best[0][0] = 0;
  for (let l = 1; l <= lines; l += 1) {
    for (let j = l; j <= n; j += 1) {
      for (let i = l - 1; i < j; i += 1) {
        const cost = Math.max(best[l - 1][i], span(i, j));
        if (cost < best[l][j]) {
          best[l][j] = cost;
          from[l][j] = i;
        }
      }
    }
  }
  const breaks = [];
  for (let l = lines, j = n; l > 0; l -= 1) {
    const i = from[l][j];
    breaks.unshift(i);
    j = i;
  }
  return { max: best[lines][n], breaks };
}

/**
 * @param {string[]} words
 * @param {number[]} breaks
 */
function cut(words, breaks) {
  return breaks.map((start, i) => words.slice(start, breaks[i + 1] ?? words.length));
}

/**
 * The fewest balanced lines that keep every line of one paragraph within
 * `limit`, or null when a single word is wider than that.
 * @param {string[]} words
 * @param {number[]} widths
 * @param {number} space
 * @param {number} limit
 * @param {number} maxLines
 */
function fewestLines(words, widths, space, limit, maxLines) {
  if (Math.max(...widths) > limit) return null;
  for (let k = 1; k <= Math.min(maxLines, words.length); k += 1) {
    const { max, breaks } = balancedBreaks(widths, space, k);
    if (max <= limit) return cut(words, breaks);
  }
  return null;
}

/**
 * Greedy fill (as a browser would wrap) then balanced (as text-wrap: balance
 * would): find how many lines a greedy fill needs, then the narrowest width
 * that still takes no more. A word wider than the limit gets a line of its
 * own and reports `overflow`.
 * @param {string[]} words
 * @param {number[]} widths
 * @param {number} space
 * @param {number} limit
 */
function wrapBalanced(words, widths, space, limit) {
  const greedy = (/** @type {number} */ w) => {
    /** @type {number[]} */
    const breaks = [0];
    let run = widths[0];
    for (let i = 1; i < widths.length; i += 1) {
      if (run + space + widths[i] > w) {
        breaks.push(i);
        run = widths[i];
      } else {
        run += space + widths[i];
      }
    }
    return breaks;
  };
  const lines = greedy(limit).length;
  let lo = Math.max(...widths);
  let hi = limit;
  if (lo < hi) {
    for (let step = 0; step < 18; step += 1) {
      const mid = (lo + hi) / 2;
      if (greedy(mid).length <= lines) hi = mid;
      else lo = mid;
    }
  }
  return { lines: cut(words, greedy(lo < limit ? hi : limit)), overflow: Math.max(...widths) > limit };
}

/* ── The fit ─────────────────────────────────────────────────────── */

/**
 * @typedef {{
 *   top: number,
 *   height: number,
 *   kicker: { text: string, size: number } | null,
 *   headline: { mode: 'shout' | 'read', size: number, lineHeight: number, lines: string[][], overflow: boolean },
 *   sub: { size: number, lines: string[] } | null,
 *   chip: { label: string, value: string, size: number, height: number } | null,
 * }} FrameFit
 */

/** @param {number} max @param {number} min @param {number} step */
function sizes(max, min, step) {
  const out = [];
  for (let s = max; s >= min - 1e-9; s -= step) out.push(Math.round(s * 100) / 100);
  return out;
}

/**
 * Fit a frame to the lobby: the kicker to one line, the supporting line and
 * the chip at their own sizes, and the headline to whatever height is left,
 * as big as it will go.
 *
 * The headline is shouted (uppercase Galindo) when it can be: first with up
 * to three lines no longer than the mockup's measure (68u) from 7.2u down to
 * 6u, then with up to two lines at the full width (84u) from 7.2u down to 5u,
 * taking the first size that fits. Words are measured in the real face and never broken. Text
 * that cannot shout at 5u in three lines is read instead (sentence case
 * Figtree, 4.2u down, balanced lines, in the theme's reading ink), and
 * so is any slide set to "md". Explicit "xl" and "lg" cap the shouted size.
 *
 * @param {Frame} frame
 * @param {Measure} [measure]
 * @returns {FrameFit}
 */
export function fitFrame(frame, measure = measureText) {
  const budget = LAYOUT.safeBottom - LAYOUT.safeTop;

  // Kicker: one line, tracked, shrunk only if an operator typed a long one.
  let kicker = null;
  if (frame.kicker) {
    const text = frame.kicker.toUpperCase();
    const em = measure(text, 'label') + KICKER.tracking * [...text].length;
    kicker = { text: frame.kicker, size: Math.max(KICKER.min, Math.min(KICKER.size, LAYOUT.width / em)) };
  }
  const kickerH = kicker ? kicker.size + KICKER.gap : 0;

  // Chip: fixed size, its height from the kit's own geometry.
  let chip = null;
  if (frame.chip) {
    const g = chipGeometry(measure(frame.chip.label, 'shout'), measure(frame.chip.value, 'shout'));
    chip = { ...frame.chip, size: CHIP.size, height: g.height * CHIP.size };
  }
  const chipH = chip ? CHIP.gap + chip.height : 0;

  // Supporting line: body face, a few balanced lines.
  let sub = null;
  if (frame.sub) {
    const words = frame.sub.split(/\s+/).filter(Boolean);
    const widths = words.map((w) => measure(w, 'body'));
    const space = measure(' ', 'body') || 0.25;
    for (const s of sizes(SUB.size, SUB.min, SUB.step)) {
      const { lines } = wrapBalanced(words, widths, space, SUB.width / s);
      sub = { size: s, lines: lines.map((l) => l.join(' ')) };
      if (lines.length <= SUB.maxLines) break;
    }
  }
  const subH = sub ? SUB.gap + sub.lines.length * sub.size * SUB.lineHeight : 0;

  const room = budget - kickerH - chipH - subH;
  const paras = paragraphs(frame.headline);
  const headline = fitHeadline(paras, frame.textSize, room, measure);
  const headH = headline.lines.length
    ? headline.lines.length * headline.size * headline.lineHeight
      + headline.size * (headline.mode === 'shout' ? SHOUT.shadow : READ.shadow)
    : 0;

  const height = kickerH + headH + subH + chipH - (kicker && !headH ? KICKER.gap : 0);
  const top = Math.max(LAYOUT.safeTop, Math.min(LAYOUT.top, LAYOUT.safeBottom - height));
  return { top, height, kicker, headline, sub, chip };
}

/**
 * @param {string[][]} paras
 * @param {string} textSize
 * @param {number} room the height left for the headline, in u
 * @param {Measure} measure
 * @returns {FrameFit['headline']}
 */
function fitHeadline(paras, textSize, room, measure) {
  if (!paras.length) return { mode: 'shout', size: SHOUT.max, lineHeight: SHOUT.lineHeight, lines: [], overflow: false };

  if (textSize !== 'md') {
    const ceiling = SHOUT.ceiling[textSize] ?? SHOUT.max;
    const upper = paras.map((p) => p.map((w) => w.toUpperCase()));
    const widths = upper.map((p) => p.map((w) => measure(w, 'shout')));
    const space = measure(' ', 'shout') || 0.3;
    // First at the mockup's measure, down to `measured`; only then the full
    // width, down to `min`. A long headline would rather step down a little
    // than run edge to edge.
    // Three lines only at the measure: three full-width lines of caps are a
    // wall, and a headline that long reads better in the read layout.
    const passes = [
      ...sizes(ceiling, Math.min(ceiling, SHOUT.measured), SHOUT.step).map((s) => [s, LAYOUT.measure, SHOUT.maxLines]),
      ...sizes(ceiling, SHOUT.min, SHOUT.step).map((s) => [s, LAYOUT.width, SHOUT.wideLines]),
    ];
    for (const [s, limit, most] of passes) {
      if (s * SHOUT.lineHeight * paras.length > room) continue;
      const em = limit / s - SHOUT.shadow;
      const set = [];
      for (let p = 0; p < paras.length; p += 1) {
        const lines = fewestLines(paras[p], widths[p], space, em, most);
        if (!lines) break;
        set.push(...lines);
      }
      const complete = set.length > 0 && set.flat().length === paras.flat().length;
      if (complete && set.length <= most
        && set.length * s * SHOUT.lineHeight + s * SHOUT.shadow <= room) {
        return { mode: 'shout', size: s, lineHeight: SHOUT.lineHeight, lines: set, overflow: false };
      }
    }
  }

  // Too long to shout: read it.
  const widths = paras.map((p) => p.map((w) => measure(w, 'read')));
  const space = measure(' ', 'read') || 0.25;
  /** @type {FrameFit['headline'] | null} */
  let last = null;
  // Down to a floor no typed slide reaches (a full 500 characters under a
  // kicker reads at about 2.4u), so the box can never be overrun.
  for (const s of sizes(READ.max, READ.floor, READ.step)) {
    const em = READ.width / s - READ.shadow;
    let overflow = false;
    const lines = paras.flatMap((p, i) => {
      const r = wrapBalanced(p, widths[i], space, em);
      overflow = overflow || r.overflow;
      return r.lines;
    });
    last = { mode: 'read', size: s, lineHeight: READ.lineHeight, lines, overflow };
    if (!overflow && lines.length * s * READ.lineHeight + s * READ.shadow <= room) return last;
  }
  return /** @type {FrameFit['headline']} */ (last);
}
