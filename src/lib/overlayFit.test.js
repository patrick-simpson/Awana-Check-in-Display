import { describe, it, expect } from 'vitest';
import {
  OVERLAY, balanceLines, boardRowsHeight, fitBoard, fitParagraph, fitShout, wrapLines,
} from './overlayFit.js';
import { LAYOUT } from './lobbyFrame.js';

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
