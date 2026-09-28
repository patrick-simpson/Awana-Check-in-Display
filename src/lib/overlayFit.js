// @ts-check
// Where the lobby's overlays go, and how big their words can be (rebrand
// stage 4b-2). Pure: a layout table, and fits that turn text into sizes by
// measuring it in the face that will draw it (lobbyFrame's measureText), so
// a long name or a 200-character notice steps down instead of spilling out
// of its band. The components only render the result.
//
// Every length is in u, 1% of a 16:9 stage's width (min(1vw, 1.7778vh)),
// the unit the lobby scene, the corner chips and the check-in moment use.

import { measureText } from './lobbyFrame.js';

/** @typedef {import('./lobbyFrame.js').Face} Face */
/** @typedef {(text: string, face: Face) => number} Measure */

/* ── The layout ───────────────────────────────────────────────────── */

/**
 * The overlay bands, measured against the lobby's own furniture:
 *
 *  - the corner tab fills 0-24u across the top-left (its fat end reaches
 *    ~22u for the first 10u down); the top-right stack (the status sticker
 *    over the weather chip) starts at ~78u with the sticker's longest
 *    wording, ~88u without it;
 *  - the slide copy starts at 15.1u and only ever rises to 11u (lobbyFrame
 *    LAYOUT.safeTop), and ends by 45u;
 *  - the house waves' crests sit at ~46.5-48u; the corner chip bottom-right
 *    starts at ~80u; the gear bottom-left ends at ~4u;
 *  - the check-in wave is the bottom 29.25u (52% of the 16:9 box).
 *
 * `band`: the top-centre strip between the corner tab and the top-right
 * stack, above the highest the copy can rise. Notices and milestone toasts
 * take turns in it, one at a time. `flags` is the demo / rehearsal tab that
 * hangs from the top edge above it; while one hangs, the band starts under
 * it and has that much less height.
 *
 * `centre`: the copy's own region, for the two things that take the room
 * over while they are up (a critical notice and the pickup board); the copy
 * steps back behind them the way it does for a name.
 */
export const OVERLAY = {
  band: { top: 1.4, width: 50, bottom: 10.4 },
  flags: { height: 2.5, gap: 0.6 },
  centre: { top: 12, bottom: 46, width: 70 },
};

/* ── One shouted line (a toast) ──────────────────────────────────── */

/**
 * The largest size (on `step`) at which `text` fits `width`, shouted in
 * Galindo caps: one line if it can be read at `min` or more, else the most
 * balanced two-line break at the largest size that fits. Never below `min`:
 * past that the caller's CSS wraps, which is the right failure for a
 * 40-character first name.
 *
 * @param {string} text
 * @param {{ width: number, max: number, min: number, step?: number, twoLineMax?: number }} box
 * @param {Measure} [measure]
 * @returns {{ size: number, lines: string[], fits: boolean }}
 */
export function fitShout(text, { width, max, min, step = 0.1, twoLineMax = max }, measure = measureText) {
  const clean = String(text ?? '').trim().replace(/\s+/g, ' ');
  const caps = clean.toUpperCase();
  const one = measure(caps, 'shout');
  const sizeFor = (/** @type {number} */ em, /** @type {number} */ hi) => {
    if (em <= 0) return hi;
    const s = Math.floor((width / em) / step) * step;
    return Math.min(hi, Number(s.toFixed(3)));
  };
  const s1 = sizeFor(one, max);
  if (s1 >= min) return { size: s1, lines: [clean], fits: true };

  const words = clean.split(' ');
  if (words.length > 1) {
    let best = /** @type {{ size: number, lines: string[] } | null} */ (null);
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const em = Math.max(measure(a.toUpperCase(), 'shout'), measure(b.toUpperCase(), 'shout'));
      const s = sizeFor(em, twoLineMax);
      if (!best || s > best.size) best = { size: s, lines: [a, b] };
    }
    if (best && best.size >= min) return { ...best, fits: true };
    if (best) return { size: min, lines: best.lines, fits: false };
  }
  return { size: min, lines: [clean], fits: false };
}

/* ── A paragraph (a notice) ──────────────────────────────────────── */

/**
 * Greedy word wrap of `text` at `size` into lines no wider than `width`,
 * measured in `face`. A single word wider than the line takes a line of its
 * own (CSS then breaks it, which only a pasted URL ever needs).
 *
 * @param {string} text
 * @param {number} size
 * @param {number} width
 * @param {Face} face
 * @param {Measure} [measure]
 * @returns {string[]}
 */
export function wrapLines(text, size, width, face, measure = measureText) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const space = measure(' ', face) * size || 0.28 * size;
  /** @type {string[]} */
  const lines = [];
  let line = '';
  let w = 0;
  for (const word of words) {
    const ww = measure(word, face) * size;
    if (line && w + space + ww > width) {
      lines.push(line);
      line = word;
      w = ww;
    } else {
      w = line ? w + space + ww : ww;
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The same words in the same number of lines as the greedy wrap, broken so
 * the longest line is as short as it can be (a small min-max partition over
 * the words), so a plate built around the text hugs it instead of running
 * the full width with a short last line.
 *
 * @param {string} text
 * @param {number} count  how many lines
 * @param {number} size
 * @param {Face} face
 * @param {Measure} [measure]
 * @returns {string[]}
 */
export function balanceLines(text, count, size, face, measure = measureText) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const n = words.length;
  const k = Math.max(1, Math.min(count, n));
  if (n === 0) return [];
  if (k === 1) return [words.join(' ')];
  const space = measure(' ', face) * size || 0.28 * size;
  const w = words.map((word) => measure(word, face) * size);
  // span(i, j): the width of words i..j-1 on one line.
  const pre = [0];
  for (let i = 0; i < n; i++) pre.push(pre[i] + w[i]);
  const span = (/** @type {number} */ i, /** @type {number} */ j) => pre[j] - pre[i] + space * (j - i - 1);
  // best[l][j]: the least possible longest line setting the first j words in l lines.
  const best = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity));
  const cut = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
  best[0][0] = 0;
  for (let l = 1; l <= k; l++) {
    for (let j = l; j <= n; j++) {
      for (let i = l - 1; i < j; i++) {
        const v = Math.max(best[l - 1][i], span(i, j));
        if (v < best[l][j]) { best[l][j] = v; cut[l][j] = i; }
      }
    }
  }
  /** @type {string[]} */
  const lines = [];
  let j = n;
  for (let l = k; l >= 1; l--) {
    const i = cut[l][j];
    lines.unshift(words.slice(i, j).join(' '));
    j = i;
  }
  return lines;
}

/**
 * The largest size (on `step`, from `max` down to `min`) at which `text`
 * wraps into at most `maxLines` lines of `width`, and those lines, balanced.
 * At `min` it may take more lines than that (the caller's box grows);
 * `fits` says which happened. `hug` says every line was measured to fit, so
 * the caller may set them unbroken and let its plate hug the longest; a
 * word wider than the whole line (a pasted URL) turns it off, and the
 * caller lets the browser wrap instead.
 *
 * @param {string} text
 * @param {{ width: number, max: number, min: number, maxLines: number, step?: number, face?: Face }} box
 * @param {Measure} [measure]
 * @returns {{ size: number, lines: number, fits: boolean, text: string[], hug: boolean }}
 */
export function fitParagraph(text, { width, max, min, maxLines, step = 0.1, face = 'body' }, measure = measureText) {
  const done = (/** @type {number} */ size, /** @type {number} */ count, /** @type {boolean} */ fits) => {
    const lines = balanceLines(text, count, size, face, measure);
    const hug = lines.every((l) => measure(l, face) * size <= width + 1e-6);
    return { size: Number(size.toFixed(3)), lines: count, fits, text: lines, hug };
  };
  for (let s = max; s >= min - 1e-9; s = Number((s - step).toFixed(3))) {
    const lines = wrapLines(text, s, width, face, measure).length;
    if (lines <= maxLines) return done(s, lines, true);
  }
  return done(min, wrapLines(text, min, width, face, measure).length, false);
}

/* ── The pickup board's name chips ───────────────────────────────── */

/**
 * The board's chips at chip size `s` (the name's font size, u): each club is
 * a run of chips (the club's own label chip, then one chip per name) that
 * wraps inside `width`. Returns how tall the run of rows is, so the fit can
 * pick the largest size that keeps the whole board inside its region.
 *
 * Chip metrics are the CSS's (app.css `.checkout-*`): a name chip is its
 * text plus 1.3 x s of padding, a club's label its Londrina caps at
 * 0.62 x s plus 0.34 x s after it, chips 0.45 x s apart, rows 1.75 x s
 * tall and 0.45 x s apart, and 0.7 x s between clubs.
 *
 * @param {{ club: string, names: string[] }[]} groups
 * @param {number} s
 * @param {number} width
 * @param {Measure} [measure]
 */
export function boardRowsHeight(groups, s, width, measure = measureText) {
  const gap = 0.45 * s;
  const rowH = 1.75 * s;
  let rows = 0;
  for (const g of groups) {
    let x = measure(String(g.club || '').toUpperCase(), 'label') * 0.62 * s + 0.34 * s;
    rows += 1;
    for (const name of g.names) {
      const w = Math.min(width, measure(name, 'shout') * s + 1.3 * s);
      if (x + gap + w > width) {
        rows += 1;
        x = w;
      } else {
        x += gap + w;
      }
    }
  }
  const clubGaps = Math.max(0, groups.length - 1) * 0.7 * s;
  return rows * rowH + Math.max(0, rows - groups.length) * gap + clubGaps;
}

/**
 * The largest name size (on `step`) at which every club's chips fit inside
 * `height` x `width`; `min` if even that overflows (the board then scrolls
 * nothing and simply runs long, which only a 60-name board could make it).
 *
 * @param {{ club: string, names: string[] }[]} groups
 * @param {{ width: number, height: number, max: number, min: number, step?: number }} box
 * @param {Measure} [measure]
 * @returns {{ size: number, fits: boolean }}
 */
export function fitBoard(groups, { width, height, max, min, step = 0.05 }, measure = measureText) {
  for (let s = max; s >= min - 1e-9; s = Number((s - step).toFixed(3))) {
    if (boardRowsHeight(groups, s, width, measure) <= height) return { size: Number(s.toFixed(3)), fits: true };
  }
  return { size: min, fits: false };
}
