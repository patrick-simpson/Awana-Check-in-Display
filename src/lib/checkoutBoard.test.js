import { describe, it, expect } from 'vitest';
import {
  BOARD_ANONYMOUS,
  BOARD_EMPTY,
  BOARD_HIDDEN,
  BOARD_NAMES,
  BOARD_STALE,
  decideBoard,
  groupByClub,
} from './checkoutBoard.js';

// These are safeguarding assertions, not UI polish.
//
// The board lists children who are not yet with a parent. Three of the tests
// below exist because a reviewer found a specific way this feature could be
// actively harmful, and each one is the guard against it:
//
//   - off by default, so it never appears because someone updated the app
//   - names suppressed once the list is short, because two names at 8:15pm is a
//     statement about two specific unattended children rather than a roster
//   - a missing payload renders NOTHING, never an empty board, because "I have
//     no data" and "everyone has been picked up" are opposite facts

const NOW = Date.UTC(2026, 8, 16, 23, 45);
const base = {
  mode: 'always',
  namesAbove: 3,
  staleMin: 8,
  phase: 'pickup',
  now: NOW,
};
const payload = (n, atOffsetMin = 0, printed = 43) => ({
  entries: Array.from({ length: n }, (_, i) => ({ firstName: `Kid${i}`, club: 'Sparks' })),
  at: NOW - atOffsetMin * 60000,
  printed,
});

describe('the board is off unless the operator turned it on', () => {
  it('is hidden in every mode but pickup and always', () => {
    for (const mode of ['off', '', undefined, null, 'on', 'true', 'yes']) {
      const d = decideBoard({ ...base, mode, checkout: payload(10) });
      expect(d.state, `mode=${String(mode)}`).toBe(BOARD_HIDDEN);
    }
  });

  it('shows in always mode with fresh data', () => {
    expect(decideBoard({ ...base, mode: 'always', checkout: payload(10) }).state).toBe(BOARD_NAMES);
  });
});

describe('no data is never an empty board', () => {
  it('hides rather than claiming everyone has gone home', () => {
    for (const checkout of [null, undefined, {}, { entries: [] }, { entries: [], at: NaN }]) {
      const d = decideBoard({ ...base, checkout });
      expect(d.state, JSON.stringify(checkout)).toBe(BOARD_HIDDEN);
    }
  });

  it('but a REAL empty board is shown, because that is good news', () => {
    const d = decideBoard({ ...base, checkout: payload(0) });
    expect(d.state).toBe(BOARD_EMPTY);
  });
});

describe('names are suppressed once the list identifies individuals', () => {
  it('names a long list', () => {
    expect(decideBoard({ ...base, checkout: payload(12) }).state).toBe(BOARD_NAMES);
  });

  it('stops naming at or below the threshold', () => {
    for (const n of [1, 2, 3]) {
      const d = decideBoard({ ...base, namesAbove: 3, checkout: payload(n) });
      expect(d.state, `${n} children`).toBe(BOARD_ANONYMOUS);
    }
    expect(decideBoard({ ...base, namesAbove: 3, checkout: payload(4) }).state).toBe(BOARD_NAMES);
  });

  it('honours a raised threshold', () => {
    expect(decideBoard({ ...base, namesAbove: 10, checkout: payload(9) }).state).toBe(BOARD_ANONYMOUS);
    expect(decideBoard({ ...base, namesAbove: 10, checkout: payload(11) }).state).toBe(BOARD_NAMES);
  });

  it('allows the guard to be switched off entirely, explicitly', () => {
    // Not recommended, but it must be the operator's decision rather than
    // something the code quietly overrides.
    expect(decideBoard({ ...base, namesAbove: 0, checkout: payload(1) }).state).toBe(BOARD_NAMES);
  });

  it('says WHY it went anonymous, so the operator does not think it broke', () => {
    const d = decideBoard({ ...base, checkout: payload(2) });
    expect(d.reason).toMatch(/unattended/i);
  });
});

describe('going quiet shows as age, not as a frozen list', () => {
  it('is stale past the budget', () => {
    const d = decideBoard({ ...base, staleMin: 8, checkout: payload(10, 20) });
    expect(d.state).toBe(BOARD_STALE);
    expect(d.ageMin).toBe(20);
  });

  it('is fresh inside the budget', () => {
    expect(decideBoard({ ...base, staleMin: 8, checkout: payload(10, 5) }).state).toBe(BOARD_NAMES);
  });

  it('treats a FUTURE timestamp as age zero, not as fresh forever', () => {
    // Two unsynchronized clocks. A producer running fast must not be able to pin
    // the board open indefinitely — which is what a naive `now - at < budget`
    // comparison does with a negative age.
    const d = decideBoard({ ...base, checkout: payload(10, -600) });
    expect(d.state).toBe(BOARD_NAMES);
    expect(d.ageMin).toBe(0);
  });

  it('staleness wins over name suppression', () => {
    // A stale short list must not render as the anonymous message, which would
    // imply live knowledge that almost everyone had gone.
    expect(decideBoard({ ...base, checkout: payload(2, 30) }).state).toBe(BOARD_STALE);
  });
});

describe('pickup mode restricts it to the part of the evening it is for', () => {
  it('is hidden during arrival and the lesson', () => {
    for (const phase of ['arrival', 'opening', 'handbook', 'gametime', 'lesson']) {
      const d = decideBoard({ ...base, mode: 'pickup', phase, checkout: payload(10) });
      expect(d.state, phase).toBe(BOARD_HIDDEN);
    }
  });

  it('is shown through closing, pickup and after the program ends', () => {
    // Generous at the tail on purpose: pickup runs past the schedule's end, and a
    // board that vanished at "off" would disappear exactly when the last few
    // children are still waiting.
    for (const phase of ['closing', 'pickup', 'dismissal', 'after', 'off']) {
      const d = decideBoard({ ...base, mode: 'pickup', phase, checkout: payload(10) });
      expect(d.state, phase).toBe(BOARD_NAMES);
    }
  });

  it('always mode ignores the phase', () => {
    expect(decideBoard({ ...base, mode: 'always', phase: 'handbook', checkout: payload(10) }).state)
      .toBe(BOARD_NAMES);
  });
});

describe('grouping is deterministic', () => {
  const entries = [
    { firstName: 'Zoe', club: 'Sparks' },
    { firstName: 'Amy', club: 'Sparks' },
    { firstName: 'Ben', club: 'T&T' },
    { firstName: 'Cal', club: '' },
  ];

  it('groups by club, largest first, names sorted', () => {
    expect(groupByClub(entries)).toEqual([
      { club: 'Sparks', names: ['Amy', 'Zoe'] },
      { club: 'Other', names: ['Cal'] },
      { club: 'T&T', names: ['Ben'] },
    ]);
  });

  it('produces the same order every time — the wall must not reshuffle', () => {
    const a = JSON.stringify(groupByClub(entries));
    const b = JSON.stringify(groupByClub([...entries].reverse()));
    expect(a).toBe(b);
  });

  it('survives junk', () => {
    expect(groupByClub([])).toEqual([]);
    expect(groupByClub(null)).toEqual([]);
    expect(groupByClub(undefined)).toEqual([]);
  });
});
