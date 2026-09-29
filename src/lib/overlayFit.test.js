import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OVERLAY, PICKUP_TIME, balanceLines, bandRoom, bandTop, boardPlacement, boardRowsHeight, fitBoard,
  fitParagraph, fitShout, lobbyRoom, plateChrome, wrapLines,
} from './overlayFit.js';
import { LAYOUT } from './lobbyFrame.js';
import {
  BOARD_ANONYMOUS, BOARD_EMPTY, BOARD_HIDDEN, BOARD_NAMES, BOARD_STALE, PICKUP_PHASES,
} from './checkoutBoard.js';
import { PHASES } from './schedule.js';

const css = readFileSync(resolve(__dirname, '../styles/app.css'), 'utf8');

// A fixed, readable measure: every character 0.6em, a space 0.3em. The fits
// are pure in their measure, so the numbers below are exact.
const mono = (text) => [...text].reduce((w, ch) => w + (ch === ' ' ? 0.3 : 0.6), 0);
const measure = (text) => mono(text);

describe('the overlay bands', () => {
  it('keep the top band above the highest the slide copy can rise', () => {
    expect(OVERLAY.band.bottom).toBeLessThan(LAYOUT.safeTop);
    // With the flag tab hanging, the band starts under it and still has room.
    const flagged = OVERLAY.flags.height + OVERLAY.flags.gap;
    expect(flagged).toBeLessThan(OVERLAY.band.bottom);
  });

  it('keep the band between the corner tab (24u) and the top-right stack (~78u)', () => {
    const left = 50 - OVERLAY.band.width / 2;
    const right = 50 + OVERLAY.band.width / 2;
    expect(left).toBeGreaterThanOrEqual(24);
    expect(right).toBeLessThanOrEqual(78);
  });

  it('keep the takeover region inside the copy box, above the house waves', () => {
    expect(OVERLAY.centre.top).toBeGreaterThan(OVERLAY.band.bottom);
    expect(OVERLAY.centre.bottom).toBeLessThanOrEqual(46.5);
  });

  it('start the band where app.css starts it, under the flag strip while one hangs', () => {
    expect(bandTop(false)).toBe(OVERLAY.band.top);
    expect(bandTop(true)).toBeCloseTo(OVERLAY.flags.height + OVERLAY.flags.gap, 9);
    const top = (rule) => Number(new RegExp(`${rule}\\s*\\{[^}]*--band-top:\\s*calc\\(([\\d.]+) \\* var\\(--u\\)\\)`).exec(css)?.[1]);
    expect(top('\\.stage')).toBeCloseTo(bandTop(false), 9);
    expect(top('\\.stage\\.has-flags')).toBeCloseTo(bandTop(true), 9);
    expect(bandRoom(true)).toBeLessThan(bandRoom(false));
  });

  it('keep the flag strip between the corner tab and the top-right stack', () => {
    expect(OVERLAY.flags.width).toBeLessThanOrEqual(78 - 24);
    expect(css).toMatch(new RegExp(`\\.top-flags \\{[^}]*max-width: calc\\(${OVERLAY.flags.width} \\* var\\(--u\\)\\)`));
  });

  it('keep the foot between the copy\'s lowest line and the ticker', () => {
    // 16:9: the stage is 56.25u tall; the card is at most ~5u tall.
    expect(56.25 - OVERLAY.foot.bottom - 5).toBeGreaterThanOrEqual(LAYOUT.safeBottom);
    expect(OVERLAY.foot.width).toBeLessThanOrEqual(80 - 20);
  });

  it('let the status sticker stand only as tall as keeps the chip under it above a raised row', () => {
    // stack top ~1.4u + sticker + 0.9u gap + the ~6.4u weather chip, by 14u.
    expect(1.41 + OVERLAY.stack.stickerMax + 0.9 + 6.42).toBeLessThanOrEqual(14);
  });

  it('measure the plate the way app.css draws it', () => {
    expect(plateChrome(1)).toBeCloseTo(2.05 * (1 - 0.087), 9);
    expect(css).toMatch(/--plate-pill: calc\(2\.05 \* var\(--plate-label, 1rem\)\)/);
  });
});

describe('the step-plate label size', () => {
  it('is never declared on the plate itself, so each overlay\'s own size reaches its label', () => {
    // A declaration on .step-plate beats the one it inherits from the notice,
    // the toast or the sticker, and every label renders at 1rem.
    const plate = /\.step-plate \{([^}]*)\}/g;
    let m;
    const bodies = [];
    while ((m = plate.exec(css))) bodies.push(m[1]);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) expect(body).not.toMatch(/--plate-label\s*:/);
    for (const owner of ['.status-dot', '.milestone-toast', '.notice-banner--critical']) {
      const esc = owner.replace(/[.-]/g, (c) => `\\${c}`);
      expect(css).toMatch(new RegExp(`${esc} \\{[^}]*--plate-label:`));
    }
  });
});

describe('who holds which part of the room', () => {
  const live = [BOARD_NAMES, BOARD_ANONYMOUS];
  it('the board takes the middle only for a live list at pickup time', () => {
    for (const phase of PHASES) {
      for (const state of live) {
        expect(boardPlacement(state, phase)).toBe(PICKUP_TIME.has(phase) ? 'centre' : 'foot');
      }
      // A stale or empty board is never the room's focus: it has nothing live to list.
      expect(boardPlacement(BOARD_STALE, phase)).toBe('foot');
      expect(boardPlacement(BOARD_EMPTY, phase)).toBe('foot');
      expect(boardPlacement(BOARD_HIDDEN, phase)).toBeNull();
    }
    // The program and the arrivals before it are never pickup time; the
    // schedule's own after-program phase is, and so is decideBoard's window.
    for (const phase of ['countdown', 'ceremony', 'game-time']) expect(PICKUP_TIME.has(phase)).toBe(false);
    expect(PICKUP_TIME.has('shutdown')).toBe(true);
    for (const phase of PICKUP_PHASES) expect(PICKUP_TIME.has(phase)).toBe(true);
  });

  it('a stale board on a non-club day sits at the foot and leaves the slides alone', () => {
    const room = lobbyRoom({ boardState: BOARD_STALE, phase: 'off' });
    expect(room).toMatchObject({ board: 'foot', copyAside: false, critical: null });
  });

  it('a critical notice takes the middle, unless the pickup board holds it', () => {
    expect(lobbyRoom({ criticalLive: true, boardState: BOARD_HIDDEN, phase: 'game-time' }))
      .toEqual({ board: null, critical: 'centre', copyAside: true, holdCelebrations: false, toastBelow: false });
    // Beside a board at the foot, the middle is still the notice's.
    expect(lobbyRoom({ criticalLive: true, boardState: BOARD_STALE, phase: 'off' }))
      .toMatchObject({ board: 'foot', critical: 'centre', copyAside: true, holdCelebrations: false });
    // Over the pickup list it keeps to the band, both stay whole, and the
    // celebrations wait: the band is taken and the board is right below it.
    expect(lobbyRoom({ criticalLive: true, boardState: BOARD_NAMES, phase: 'shutdown' }))
      .toEqual({ board: 'centre', critical: 'band', copyAside: true, holdCelebrations: true, toastBelow: false });
  });

  it('on an OBS feed there is no board and the alert keeps to the band, with a toast below it', () => {
    expect(lobbyRoom({ overlay: true, criticalLive: true, boardState: BOARD_NAMES, phase: 'shutdown' }))
      .toEqual({ board: null, critical: 'band', copyAside: false, holdCelebrations: false, toastBelow: true });
    expect(lobbyRoom({ overlay: true, boardState: BOARD_NAMES, phase: 'shutdown' }).critical).toBeNull();
  });

  it('a name at the door outranks the pickup list', () => {
    expect(lobbyRoom({ checkInUp: true, boardState: BOARD_NAMES, phase: 'shutdown' }))
      .toMatchObject({ board: null, copyAside: false });
  });
});

describe('fitShout', () => {
  it('sets a short line on one line at the largest size', () => {
    const f = fitShout('10 kids strong!', { width: 40, max: 3, min: 2 }, measure);
    expect(f).toEqual({ size: 3, lines: ['10 kids strong!'], fits: true });
  });

  it('steps a longer line down, on the step, until it fits', () => {
    // PRETEND PAL IS FIRST: 17 letters and 3 spaces, 11.1em; 30u / 11.1 = 2.70.
    const f = fitShout('Pretend Pal is first', { width: 30, max: 3, min: 2 }, measure);
    expect(f.lines).toHaveLength(1);
    expect(f.size).toBeCloseTo(2.7, 5);
    expect(measure(f.lines[0].toUpperCase()) * f.size).toBeLessThanOrEqual(30 + 1e-9);
  });

  it('picks the most balanced split even when several reach the two-line cap', () => {
    // Every split of these lines reaches the 2.2u cap at 40u; the balanced one
    // keeps the name whole on the first line and the plate narrowest.
    const f = fitShout('Anna-Sophia Kristensen is first in tonight!', { width: 40, max: 3, min: 2, twoLineMax: 2.2 }, measure);
    expect(f).toEqual({ size: 2.2, lines: ['Anna-Sophia Kristensen', 'is first in tonight!'], fits: true });
  });

  it('goes down to twoLineMin for two lines, and says when even that is too wide', () => {
    const text = 'Maximilian-Alexander Jonathan-Christophe is first in tonight!';
    const small = fitShout(text, { width: 40, max: 3, min: 2, twoLineMax: 2.2, twoLineMin: 1.4 }, measure);
    expect(small.fits).toBe(true);
    expect(small.size).toBeGreaterThanOrEqual(1.4);
    expect(small.size).toBeLessThan(2);
    for (const l of small.lines) expect(measure(l.toUpperCase()) * small.size).toBeLessThanOrEqual(40 + 1e-9);
    const tight = fitShout(text, { width: 20, max: 3, min: 2, twoLineMax: 2.2, twoLineMin: 1.4 }, measure);
    expect(tight).toMatchObject({ size: 1.4, fits: false });
  });

  it('breaks into the two most balanced lines once one line would go below min', () => {
    const text = 'Maximilian-Alexander Jonathan is first in tonight!';
    const f = fitShout(text, { width: 40, max: 3, min: 2, twoLineMax: 2.2 }, measure);
    expect(f.lines).toHaveLength(2);
    expect(f.lines.join(' ')).toBe(text);
    expect(f.size).toBeLessThanOrEqual(2.2);
    expect(f.size).toBeGreaterThanOrEqual(2);
    for (const l of f.lines) expect(measure(l.toUpperCase()) * f.size).toBeLessThanOrEqual(40 + 1e-9);
  });

  it('never goes below min, and says when it could not fit', () => {
    const f = fitShout('Supercalifragilisticexpialidocious', { width: 10, max: 3, min: 2 }, measure);
    expect(f.size).toBe(2);
    expect(f.fits).toBe(false);
  });
});

describe('wrapLines / balanceLines', () => {
  const text = 'Bring your Bible next week for double shares and a friend too';

  it('wraps greedily inside the width', () => {
    const lines = wrapLines(text, 1, 20, 'body', measure);
    expect(lines.join(' ')).toBe(text);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(20);
  });

  it('balances into the same number of lines with a shorter longest line', () => {
    const greedy = wrapLines(text, 1, 20, 'body', measure);
    const balanced = balanceLines(text, greedy.length, 1, 'body', measure);
    expect(balanced).toHaveLength(greedy.length);
    expect(balanced.join(' ')).toBe(text);
    const longest = (ls) => Math.max(...ls.map((l) => measure(l)));
    expect(longest(balanced)).toBeLessThanOrEqual(longest(greedy));
  });

  it('moves words down off a greedy first line, so no line is longer than it must be', () => {
    // Greedy fills the first line and strands one short word on the second.
    const t = 'xxxxxxxxxx yyyyyyyyyy z';
    const greedy = wrapLines(t, 1, 13, 'body', measure);
    expect(greedy).toEqual(['xxxxxxxxxx yyyyyyyyyy', 'z']);
    const balanced = balanceLines(t, 2, 1, 'body', measure);
    expect(balanced).toEqual(['xxxxxxxxxx', 'yyyyyyyyyy z']);
    const longest = (ls) => Math.max(...ls.map((l) => measure(l)));
    expect(longest(balanced)).toBeLessThan(longest(greedy));
    for (const l of balanced) expect(measure(l)).toBeLessThanOrEqual(13);
  });

  it('never balances a line wider than the greedy wrap allowed', () => {
    const t = 'Supercalifragilistic expialidocious a b c d';
    const f = fitParagraph(t, { width: 20, max: 1, min: 1, maxLines: 3 }, measure);
    expect(f.hug).toBe(true);
    for (const l of f.text) expect(measure(l)).toBeLessThanOrEqual(20 + 1e-9);
    expect(f.text.join(' ')).toBe(t);
  });

  it('copes with empty text and one line', () => {
    expect(wrapLines('', 1, 10, 'body', measure)).toEqual([]);
    expect(balanceLines('', 2, 1, 'body', measure)).toEqual([]);
    expect(balanceLines('one two', 1, 1, 'body', measure)).toEqual(['one two']);
  });
});

describe('fitParagraph', () => {
  it('keeps the largest size that fits the line budget', () => {
    const f = fitParagraph('Doors close at 6:15 tonight.', { width: 46, max: 2.1, min: 1.3, maxLines: 2 }, measure);
    expect(f).toMatchObject({ size: 2.1, lines: 1, fits: true, hug: true });
    expect(f.text).toEqual(['Doors close at 6:15 tonight.']);
  });

  it('steps a 200-character message down, and says so when even min needs more lines', () => {
    const long = 'Parents: pick-up tonight moves to the gym doors on the north side because of the parking lot work. Please drive around the back and wait in the loop — volunteers in orange will walk each child out.';
    const f = fitParagraph(long, { width: 46, max: 2.1, min: 1.3, maxLines: 2 }, measure);
    expect(f.size).toBe(1.3);
    expect(f.fits).toBe(false);
    expect(f.lines).toBeGreaterThan(2);
    expect(f.text.join(' ')).toBe(long);
  });

  it('with a height, stacks its lines inside it', () => {
    const long = 'Parents: pick-up tonight moves to the gym doors on the north side because of the parking lot work. Please drive around the back and wait in the loop — volunteers in orange will walk each child out.';
    for (const height of [3.6, 5.2]) {
      const f = fitParagraph(long, { width: 46, max: 2.1, min: 0.8, maxLines: 3, height, lineHeight: 1.2 }, measure);
      expect(f.fits).toBe(true);
      expect(f.lines * f.size * 1.2).toBeLessThanOrEqual(height + 1e-9);
    }
    const roomy = fitParagraph(long, { width: 46, max: 2.1, min: 0.8, maxLines: 3, height: 5.2, lineHeight: 1.2 }, measure);
    const tight = fitParagraph(long, { width: 46, max: 2.1, min: 0.8, maxLines: 3, height: 3.6, lineHeight: 1.2 }, measure);
    expect(tight.size).toBeLessThan(roomy.size);
  });

  it('hands the wrapping back to the browser for a word wider than the line', () => {
    const f = fitParagraph('see https://example.org/a/very/long/path/that/will/not/fit', { width: 10, max: 2, min: 1.3, maxLines: 2 }, measure);
    expect(f.hug).toBe(false);
  });
});

describe('the pickup board fit', () => {
  const groups = [
    { club: 'Sparks', names: ['Ava', 'Liam', 'Maximilian', 'Sophia'] },
    { club: 'T&T', names: ['Noah', 'Mia'] },
  ];

  it('grows with the name size and with more names', () => {
    expect(boardRowsHeight(groups, 2, 60, measure)).toBeGreaterThan(boardRowsHeight(groups, 1, 60, measure));
    const more = [{ club: 'Sparks', names: Array(40).fill('Charlotte') }];
    expect(boardRowsHeight(more, 1.5, 60, measure)).toBeGreaterThan(boardRowsHeight(groups, 1.5, 60, measure));
  });

  it('picks the largest size that fits, and the floor when nothing does', () => {
    const f = fitBoard(groups, { width: 60, height: 20, max: 2.1, min: 1 }, measure);
    expect(f).toEqual({ size: 2.1, fits: true });
    const sixty = [{ club: 'Sparks', names: Array(60).fill('Isabella-Rose') }];
    const g = fitBoard(sixty, { width: 60, height: 20, max: 2.1, min: 1 }, measure);
    expect(g.size).toBeLessThan(2.1);
    expect(boardRowsHeight(sixty, g.size, 60, measure) <= 20 || g.fits === false).toBe(true);
    const h = fitBoard(sixty, { width: 20, height: 5, max: 2.1, min: 1 }, measure);
    expect(h).toEqual({ size: 1, fits: false });
  });
});
