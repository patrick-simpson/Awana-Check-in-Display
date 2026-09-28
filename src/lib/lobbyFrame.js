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
 * right) and the bottom corner chip (from ~46.5u).
 *
 * Above `clearTop` sit the corner tab's fat end (from the left edge to
 * ~16.3u, down to ~11.5u) and the top-right stack (the status sticker over
 * the weather chip, from ~73.6u across with the widest label, "Thunderstorm
 * with hail"). The stack is sized partly in px and rem, so in u it reaches
 * further down the smaller the screen: measured, 10.7u at 3840x2160, 11.1u
 * at 1920x1080, 12.8u at 1366x768 and 13.2u at 1280x720, the smallest 16:9
 * TV the lobby is sized for (a 4:3 screen has a band above the 16:9 box). So
 * a row may rise above `clearTop` only if it is no wider than `clearWidth`,
 * centred between the two; a block whose top row is wider stops at
 * `clearTop` (below it the tab is under 3.1u wide and the stack has ended).
 *
 * `measure` is the shouted headline's preferred line length (the mockup's
 * longest line, THE GYM DOORS, runs 63.5u at 7.2u); `width` is the widest any
 * line may ever run.
 */
export const LAYOUT = {
  top: 15.1, safeTop: 11, clearTop: 14, clearWidth: 45, safeBottom: 45, width: 84, measure: 68,
};

/**
 * The kicker: Londrina Solid, tracked caps, one line when it can be.
 * `gap` puts the headline's caps where the mockup's are (its kicker-to-caps
 * distance). Below `min` a long kicker wraps to two balanced lines instead of
 * shrinking further, and only shrinks past `min` when even two lines are too
 * wide: it never runs wider than LAYOUT.width. Two lines get a little leading
 * (`wrappedLineHeight`); one sits on the mockup's line box.
 */
export const KICKER = { size: 2.3, min: 1.6, gap: 1.9, tracking: 0.07, lineHeight: 1, wrappedLineHeight: 1.15 };

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
 *
 * `floor` is the smallest size the operator's own line breaks are kept at;
 * below it the lines run on, separated by `joiner`. A word wider than the
 * whole line (a pasted URL) breaks across lines of its own, but only when it
 * would not fit whole even at `wordFloor`: it keeps the largest size that
 * fits rather than shrinking the whole slide to a hairline. `last` is the
 * size below which nothing ever goes; the fit only gets near it for a frame
 * no operator can type (a full slide under a two-line kicker, a chip and a
 * supporting line).
 */
export const READ = {
  max: 4.2, floor: 1.5, wordFloor: 2.4, last: 0.2, step: 0.1, lineHeight: 1.22, width: 76, shadow: 0, joiner: ' ·',
};

/**
 * Where a word too wide for any line is cut: a hair short of the line, so the
 * browser, which wraps it at the full width (overflow-wrap: anywhere), never
 * needs more lines than the fit counted.
 */
const BREAK_SLACK = 0.97;

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

/** Letters that set a full em wide (ideographs, kana, Hangul, full-width forms). */
const FULL_WIDTH = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303F\uFF01-\uFF60]/u;

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
  return [...text].reduce((w, ch) => w + (ch === ' ' ? 0.3 : FULL_WIDTH.test(ch) ? 1.05 : ROUGH[face]), 0);
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


/* ── Words ───────────────────────────────────────────────────────── */

/**
 * One unbreakable piece of copy, and whether the source had a space (or a
 * line break) before it. Lines only ever break between tokens; a token with
 * `space: false` joins the one before it with nothing, as the words of a
 * Chinese, Japanese or Thai sentence do (those scripts put no spaces between
 * words, so splitting on spaces alone made a whole sentence one "word").
 * @typedef {{ text: string, space: boolean }} Token
 */

// Scripts a line may break inside with no dictionary (UAX #14 class ID)…
const IDEOGRAPHIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
// …and those that need one to find their words (class SA).
const DICTIONARY = /[\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/** @param {'word' | 'grapheme'} granularity */
function segmenter(granularity) {
  try {
    return typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity }) : null;
  } catch {
    return null;
  }
}
const WORD_SEGMENTER = segmenter('word');
const GRAPHEME_SEGMENTER = segmenter('grapheme');

/**
 * The user-perceived characters of `text` (a flag or an accented letter is
 * one), which is where a word too wide for any line may be cut.
 * @param {string} text
 * @returns {string[]}
 */
export function graphemes(text) {
  return GRAPHEME_SEGMENTER ? Array.from(GRAPHEME_SEGMENTER.segment(text), (g) => g.segment) : [...text];
}

/**
 * Where one space-free run may break: between the words of a script written
 * without spaces, and nowhere else, so "Pick-up", "tonight!" and a URL stay
 * whole. Punctuation rides with the word before it (an opening bracket or
 * quote with the word after), so no line starts with "。" or ends with "「".
 * Without Intl.Segmenter, Han and kana still break between characters and a
 * Thai run stays whole (it then breaks only as a word too wide for its line).
 *
 * @param {string} run
 * @param {Intl.Segmenter | null} [words]
 * @returns {string[]}
 */
export function splitRun(run, words = WORD_SEGMENTER) {
  /** @param {string} ch */
  const breaks = (ch) => IDEOGRAPHIC.test(ch) || (words !== null && DICTIONARY.test(ch));
  const chars = [...run];
  if (!chars.some(breaks)) return [run];
  const parts = words ? Array.from(words.segment(run), (s) => s.segment) : graphemes(run);
  /** @type {string[]} */
  const merged = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && !breaks([...prev].pop() ?? '') && !breaks([...part][0] ?? '')) merged[merged.length - 1] = prev + part;
    else merged.push(part);
  }
  /** @type {string[]} */
  const out = [];
  let opening = '';
  for (const part of merged) {
    if (/[\p{L}\p{N}]/u.test(part)) {
      out.push(opening + part);
      opening = '';
      continue;
    }
    // Punctuation, a mark at a time: closing marks join the word before,
    // opening ones (and anything after them) wait for the word after.
    for (const ch of part) {
      if (opening || /[\p{Ps}\p{Pi}]/u.test(ch)) opening += ch;
      else if (out.length) out[out.length - 1] += ch;
      else opening += ch;
    }
  }
  if (opening) {
    if (out.length) out[out.length - 1] += opening;
    else out.push(opening);
  }
  return out;
}

/**
 * The operator's text as paragraphs (their own line breaks) of tokens.
 * @param {string} text
 * @returns {Token[][]}
 */
export function tokenize(text) {
  /** @type {Token[][]} */
  const paras = [];
  for (const line of String(text ?? '').split(/\n+/)) {
    /** @type {Token[]} */
    const tokens = [];
    for (const word of line.split(/\s+/)) {
      if (word) splitRun(word).forEach((piece, i) => tokens.push({ text: piece, space: i === 0 }));
    }
    if (tokens.length) paras.push(tokens);
  }
  return paras;
}

/**
 * @param {string} text
 * @returns {string[][]} paragraphs (the operator's own line breaks) of tokens
 */
export function paragraphs(text) {
  return tokenize(text).map((p) => p.map((t) => t.text));
}

/**
 * Tokens `from`..`to`-1 as the text they read as on one line.
 * @param {Token[]} tokens
 * @param {number} [from]
 * @param {number} [to]
 */
export function joinTokens(tokens, from = 0, to = tokens.length) {
  let out = '';
  for (let i = from; i < to; i += 1) out += (i > from && tokens[i].space ? ' ' : '') + tokens[i].text;
  return out;
}

/* ── Line breaking ───────────────────────────────────────────────── */

/**
 * Split one paragraph into exactly `k` lines so the longest is as short as
 * possible (the balanced break a poster setter would make: MAKING /
 * BRACELETS, BRING YOUR / HANDBOOK). Never inside a token.
 * @param {number[]} widths each token's width
 * @param {number | number[]} gaps the gap before each token (a space, or 0 for a token that joins), or one width for every gap
 * @param {number} k
 * @returns {{ max: number, breaks: number[] }} breaks: index of each line's first token
 */
export function balancedBreaks(widths, gaps, k) {
  const n = widths.length;
  const lines = Math.max(1, Math.min(k, n));
  /** @param {number} i */
  const gap = (i) => (typeof gaps === 'number' ? gaps : gaps[i] ?? 0);
  const prefix = [0];
  const gapped = [0];
  for (let i = 0; i < n; i += 1) {
    prefix.push(prefix[i] + widths[i]);
    gapped.push(gapped[i] + (i > 0 ? gap(i) : 0));
  }
  /** @param {number} i @param {number} j tokens i..j-1 */
  const span = (i, j) => prefix[j] - prefix[i] + gapped[j] - gapped[i + 1];
  // best[l][j]: the least possible longest line setting tokens 0..j-1 in l lines.
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
 * The fewest balanced lines that keep every line of one paragraph within
 * `limit`, as each line's first token, or null when a single token is wider
 * than that or it would take more than `maxLines`.
 * @param {number[]} widths
 * @param {number[]} gaps
 * @param {number} limit
 * @param {number} maxLines
 */
function fewestLines(widths, gaps, limit, maxLines) {
  if (Math.max(...widths) > limit) return null;
  // No line can be shorter than an even share of the words: skip the
  // (quadratic) balancing for any count that could never fit, which is every
  // count for a long paragraph.
  const total = widths.reduce((a, b) => a + b, 0);
  for (let k = 1; k <= Math.min(maxLines, widths.length); k += 1) {
    if (total / k > limit) continue;
    const { max, breaks } = balancedBreaks(widths, gaps, k);
    if (max <= limit) return breaks;
  }
  return null;
}

/**
 * Greedy fill (as a browser would wrap) then balanced (as text-wrap: balance
 * would): find how many lines a greedy fill needs, then the narrowest width
 * that still takes no more. A token wider than the limit gets lines of its
 * own (the caller cuts it) and is reported in `wide`.
 * @param {number[]} widths
 * @param {number[]} gaps
 * @param {number} limit
 * @returns {{ starts: number[], wide: number[] }} starts: each line's first token
 */
function wrapBalanced(widths, gaps, limit) {
  const n = widths.length;
  /** @param {number} w */
  const greedy = (w) => {
    /** @type {number[]} */
    const starts = [];
    let run = -1;
    for (let i = 0; i < n; i += 1) {
      if (widths[i] > limit) {
        starts.push(i);
        run = -1;
      } else if (run < 0 || run + gaps[i] + widths[i] > w) {
        starts.push(i);
        run = widths[i];
      } else {
        run += gaps[i] + widths[i];
      }
    }
    return starts;
  };
  const lines = greedy(limit).length;
  let lo = Math.max(0, ...widths.filter((w) => w <= limit));
  let hi = limit;
  if (lo < hi) {
    for (let step = 0; step < 18; step += 1) {
      const mid = (lo + hi) / 2;
      if (greedy(mid).length <= lines) hi = mid;
      else lo = mid;
    }
  }
  const wide = [];
  for (let i = 0; i < n; i += 1) if (widths[i] > limit) wide.push(i);
  return { starts: greedy(lo < limit ? hi : limit), wide };
}

/**
 * Cut one token too wide for any line into pieces that fit, between its
 * characters, greedily, the way the browser wraps it (overflow-wrap:
 * anywhere at the same width). Cut a hair short, so the browser can never
 * need a line more than the fit counted.
 * @param {string[]} chars its graphemes
 * @param {number[]} widths each grapheme's width
 * @param {number} limit
 */
function cutToken(chars, widths, limit) {
  const pieces = [];
  let piece = '';
  let run = 0;
  chars.forEach((ch, i) => {
    if (piece && run + widths[i] > limit * BREAK_SLACK) {
      pieces.push(piece);
      piece = '';
      run = 0;
    }
    piece += ch;
    run += widths[i];
  });
  if (piece) pieces.push(piece);
  return pieces;
}

/**
 * The measured tokens of one or more paragraphs in one face, ready to be
 * laid out at any size.
 * @typedef {{
 *   paras: Token[][],
 *   widths: number[][],
 *   gaps: number[][],
 *   cut: (p: number, i: number, limit: number) => string[],
 * }} Measured
 */

/**
 * @param {Token[][]} paras
 * @param {Face} face
 * @param {Measure} measure
 * @param {(text: string) => string} [cased]
 * @returns {Measured}
 */
function measured(paras, face, measure, cased = (t) => t) {
  const space = measure(' ', face) || 0.25;
  /** @type {Map<string, { chars: string[], widths: number[] }>} */
  const glyphs = new Map();
  return {
    paras,
    widths: paras.map((p) => p.map((t) => measure(cased(t.text), face))),
    gaps: paras.map((p) => p.map((t, i) => (i > 0 && t.space ? space : 0))),
    cut(p, i, limit) {
      const text = paras[p][i].text;
      let g = glyphs.get(text);
      if (!g) {
        const chars = graphemes(text);
        g = { chars, widths: chars.map((ch) => measure(cased(ch), face)) };
        glyphs.set(text, g);
      }
      return cutToken(g.chars, g.widths, limit);
    },
  };
}

/**
 * One layout of measured paragraphs at one width: each paragraph starts a
 * new row, rows are balanced, and a token wider than `limit` fills rows of
 * its own, cut between its characters.
 * @param {Measured} m
 * @param {number} limit
 */
function layRows(m, limit) {
  /** @type {Array<{ start: number, text: string }>} */
  const rows = [];
  /** @type {number[]} */
  const wide = [];
  let offset = 0;
  m.paras.forEach((tokens, p) => {
    const laid = wrapBalanced(m.widths[p], m.gaps[p], limit);
    laid.starts.forEach((start, r) => {
      if (m.widths[p][start] > limit) {
        for (const text of m.cut(p, start, limit)) rows.push({ start: start + offset, text });
      } else {
        rows.push({ start: start + offset, text: joinTokens(tokens, start, laid.starts[r + 1] ?? tokens.length) });
      }
    });
    wide.push(...laid.wide.map((i) => i + offset));
    offset += tokens.length;
  });
  return { rows, wide };
}

/**
 * @param {Token[]} tokens
 * @param {number[]} starts
 */
function rowTexts(tokens, starts) {
  return starts.map((start, r) => joinTokens(tokens, start, starts[r + 1] ?? tokens.length));
}

/* ── The fit ─────────────────────────────────────────────────────── */

/**
 * The fitted headline. `tokens` is every token in order (as displayed: a
 * run-on list carries its separators); `lines` is each row's text and
 * `starts` the token each row starts with. A token in `wide` is wider than
 * any line and fills the rows that repeat its index, cut between its
 * characters. `joined`: the operator's line breaks could not all fit, so the
 * lines run on, separated by READ.joiner.
 * @typedef {{
 *   mode: 'shout' | 'read',
 *   size: number,
 *   lineHeight: number,
 *   tokens: Token[],
 *   lines: string[],
 *   starts: number[],
 *   wide: number[],
 *   joined: boolean,
 * }} HeadlineFit
 *
 * @typedef {{
 *   top: number,
 *   height: number,
 *   kicker: { text: string, size: number, lines: string[], lineHeight: number } | null,
 *   headline: HeadlineFit,
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
 * The kicker: one line at its size if it fits the layout's width, else
 * shrunk to fit down to KICKER.min, else two balanced lines, shrunk only as
 * far as it takes for the longer of them to fit. Never wider than
 * LAYOUT.width, whatever the operator typed.
 * @param {string} text
 * @param {Measure} measure
 */
function fitKicker(text, measure) {
  const tokens = tokenize(text).flat();
  /** @param {string} t */
  const em = (t) => measure(t.toUpperCase(), 'label') + KICKER.tracking * [...t].length;
  const widths = tokens.map((t) => em(t.text));
  const space = em(' ');
  const gaps = tokens.map((t, i) => (i > 0 && t.space ? space : 0));
  let set = balancedBreaks(widths, gaps, 1);
  let size = Math.min(KICKER.size, LAYOUT.width / set.max);
  if (size < KICKER.min && tokens.length > 1) {
    set = balancedBreaks(widths, gaps, 2);
    size = Math.min(KICKER.size, LAYOUT.width / set.max);
  }
  const lines = rowTexts(tokens, set.breaks);
  return { text, size, lines, lineHeight: lines.length > 1 ? KICKER.wrappedLineHeight : KICKER.lineHeight };
}

/**
 * Fit a frame to the lobby: the kicker to the layout's width, the supporting
 * line and the chip at their own sizes, and the headline to whatever height
 * is left, as big as it will go.
 *
 * The headline is shouted (uppercase Galindo) when it can be: first with up
 * to three lines no longer than the mockup's measure (68u) from 7.2u down to
 * 6u, then with up to two lines at the full width (84u) from 7.2u down to 5u,
 * taking the first size that fits. Words are measured in the real face and
 * never broken. Text that cannot shout at 5u is read instead (sentence case
 * Figtree, 4.2u down to 1.5u, balanced lines of at most 76u, in the theme's
 * reading ink), and so is any slide set to "md". Explicit "xl" and "lg" cap
 * the shouted size. The operator's line breaks are kept down to 1.5u; below
 * that the lines run on, separated by a dot. Whatever the text, the block
 * never reaches past LAYOUT.safeBottom, never runs wider than LAYOUT.width,
 * and a row wider than LAYOUT.clearWidth never rises above LAYOUT.clearTop.
 *
 * @param {Frame} frame
 * @param {Measure} [measure]
 * @returns {FrameFit}
 */
export function fitFrame(frame, measure = measureText) {
  const kicker = frame.kicker ? fitKicker(frame.kicker, measure) : null;
  const kickerH = kicker ? kicker.lines.length * kicker.size * kicker.lineHeight + KICKER.gap : 0;

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
    const m = measured([tokenize(frame.sub).flat()], 'body', measure);
    for (const s of sizes(SUB.size, SUB.min, SUB.step)) {
      const { rows } = layRows(m, SUB.width / s);
      sub = { size: s, lines: rows.map((r) => r.text) };
      if (rows.length <= SUB.maxLines) break;
    }
  }
  const subH = sub ? SUB.gap + sub.lines.length * sub.size * SUB.lineHeight : 0;
  const paras = tokenize(frame.headline);

  /** @param {number} safeTop */
  const layout = (safeTop) => {
    const room = LAYOUT.safeBottom - safeTop - kickerH - chipH - subH;
    const headline = fitHeadline(paras, frame.textSize, room, measure);
    const headH = headline.lines.length
      ? headline.lines.length * headline.size * headline.lineHeight
        + headline.size * (headline.mode === 'shout' ? SHOUT.shadow : READ.shadow)
      : 0;
    const height = kickerH + headH + subH + chipH - (kicker && !headH ? KICKER.gap : 0);
    const top = Math.max(safeTop, Math.min(LAYOUT.top, LAYOUT.safeBottom - height));
    return { top, height, kicker, headline, sub, chip };
  };

  const fit = layout(LAYOUT.safeTop);
  return crowdsTheCorners(fit, measure) ? layout(LAYOUT.clearTop) : fit;
}

/**
 * Whether any row of a fitted block starts above LAYOUT.clearTop and is
 * wider than LAYOUT.clearWidth, where it would run into the corner tab or
 * the top-right stack.
 * @param {FrameFit} fit
 * @param {Measure} measure
 */
function crowdsTheCorners(fit, measure) {
  if (fit.top >= LAYOUT.clearTop - 1e-9) return false;
  /** @type {Array<[number, number]>} each row's height and width, top down */
  const rows = [];
  if (fit.kicker) {
    const { size, lines, lineHeight } = fit.kicker;
    lines.forEach((line, i) => rows.push([
      size * lineHeight + (i === lines.length - 1 ? KICKER.gap : 0),
      (measure(line.toUpperCase(), 'label') + KICKER.tracking * [...line].length) * size,
    ]));
  }
  const h = fit.headline;
  for (const line of h.lines) {
    rows.push([h.size * h.lineHeight, measure(h.mode === 'shout' ? line.toUpperCase() : line, h.mode) * h.size]);
  }
  let y = fit.top;
  for (const [height, width] of rows) {
    if (y >= LAYOUT.clearTop - 1e-9) return false;
    if (width > LAYOUT.clearWidth) return true;
    y += height;
  }
  return false;
}

/**
 * @param {Token[][]} paras
 * @param {string} textSize
 * @param {number} room the height left for the headline, in u
 * @param {Measure} measure
 * @returns {HeadlineFit}
 */
function fitHeadline(paras, textSize, room, measure) {
  const tokens = paras.flat();
  if (!tokens.length) {
    return { mode: 'shout', size: SHOUT.max, lineHeight: SHOUT.lineHeight, tokens, lines: [], starts: [], wide: [], joined: false };
  }
  return (textSize !== 'md' && fitShout(paras, textSize, room, measure)) || fitRead(paras, room, measure);
}

/**
 * @param {Token[][]} paras
 * @param {string} textSize
 * @param {number} room
 * @param {Measure} measure
 * @returns {HeadlineFit | null}
 */
function fitShout(paras, textSize, room, measure) {
  const ceiling = SHOUT.ceiling[textSize] ?? SHOUT.max;
  const m = measured(paras, 'shout', measure, (t) => t.toUpperCase());
  // First at the mockup's measure, down to `measured`; only then the full
  // width, down to `min`. A long headline would rather step down a little
  // than run edge to edge. Three lines only at the measure: three full-width
  // lines of caps are a wall, and a headline that long reads better in the
  // read layout.
  const passes = [
    ...sizes(ceiling, Math.min(ceiling, SHOUT.measured), SHOUT.step).map((s) => [s, LAYOUT.measure, SHOUT.maxLines]),
    ...sizes(ceiling, SHOUT.min, SHOUT.step).map((s) => [s, LAYOUT.width, SHOUT.wideLines]),
  ];
  for (const [s, limit, most] of passes) {
    if (s * SHOUT.lineHeight * paras.length > room) continue;
    const em = limit / s - SHOUT.shadow;
    /** @type {number[]} */
    const starts = [];
    let offset = 0;
    let complete = true;
    for (let p = 0; p < paras.length && complete; p += 1) {
      const breaks = fewestLines(m.widths[p], m.gaps[p], em, most);
      if (breaks) starts.push(...breaks.map((b) => b + offset));
      else complete = false;
      offset += paras[p].length;
    }
    if (complete && starts.length <= most
      && starts.length * s * SHOUT.lineHeight + s * SHOUT.shadow <= room) {
      const tokens = paras.flat();
      return { mode: 'shout', size: s, lineHeight: SHOUT.lineHeight, tokens, lines: rowTexts(tokens, starts), starts, wide: [], joined: false };
    }
  }
  return null;
}

/**
 * The read layout at every size from `max` down to `min`: the first size
 * that fits without cutting a word, unless a word is wider than a whole
 * line even at READ.wordFloor, in which case the largest size that fits
 * with that word cut across rows of its own.
 * @param {Measured} m
 * @param {number} room
 * @param {number} max
 * @param {number} min
 */
function readFit(m, room, max, min) {
  /** @type {null | { size: number, rows: Array<{ start: number, text: string }>, wide: number[] }} */
  let cut = null;
  for (const s of sizes(max, min, READ.step)) {
    const { rows, wide } = layRows(m, READ.width / s - READ.shadow);
    const fits = rows.length * s * READ.lineHeight + s * READ.shadow <= room + 1e-9;
    if (fits && !wide.length) return { size: s, rows, wide };
    if (fits && !cut) cut = { size: s, rows, wide };
    if (cut && wide.length && s <= READ.wordFloor + 1e-9) return cut;
  }
  return cut;
}

/**
 * @param {Token[][]} paras
 * @param {number} room
 * @param {Measure} measure
 * @returns {HeadlineFit}
 */
function fitRead(paras, room, measure) {
  /**
   * @param {Token[][]} ps
   * @param {boolean} joined
   * @param {{ size: number, rows: Array<{ start: number, text: string }>, wide: number[] }} r
   * @returns {HeadlineFit}
   */
  const done = (ps, joined, r) => ({
    mode: 'read',
    size: r.size,
    lineHeight: READ.lineHeight,
    tokens: ps.flat(),
    lines: r.rows.map((row) => row.text),
    starts: r.rows.map((row) => row.start),
    wide: r.wide,
    joined,
  });

  const kept = readFit(measured(paras, 'read', measure), room, READ.max, READ.floor);
  if (kept) return done(paras, false, kept);

  // The operator's breaks cannot all fit at a readable size (a list of
  // twenty names, one per line): run the lines on, a dot between each, so
  // the block still fits instead of running down behind the house waves.
  const joined = paras.length > 1;
  const run = joined
    ? [paras.flatMap((p, i) => p.map((t, j) => (i < paras.length - 1 && j === p.length - 1 ? { ...t, text: t.text + READ.joiner } : t)))]
    : paras;
  const m = measured(run, 'read', measure);
  const ran = readFit(m, room, READ.max, READ.floor) ?? readFit(m, room, READ.floor - READ.step, READ.last);
  if (ran) return done(run, joined, ran);
  // No frame an operator can type gets here: the smallest there is.
  return done(run, joined, { size: READ.last, ...layRows(m, READ.width / READ.last) });
}
