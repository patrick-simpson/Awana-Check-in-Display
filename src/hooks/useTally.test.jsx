import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTally } from './useTally.js';

// Same harness idiom as useCelebrationQueue.test.jsx: a callback rather than
// a ref-mutating prop, so re-render timing stays honest.
function Harness({ onReady }) {
  const tally = useTally();
  onReady(tally);
  return <div data-testid="count">{tally.count}</div>;
}

function setup() {
  const api = { current: null };
  const view = render(<Harness onReady={(t) => { api.current = t; }} />);
  return { api, view };
}

const TEN_MIN_MS = 10 * 60 * 1000;

describe('useTally', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.clear(); });

  it('starts at zero with nothing stored', () => {
    const { api } = setup();
    expect(api.current.count).toBe(0);
  });

  it('bump() increments by one and persists', () => {
    const { api } = setup();
    act(() => { api.current.bump(); });
    act(() => { api.current.bump(); });
    expect(api.current.count).toBe(2);
    expect(JSON.parse(localStorage.getItem('awanaTally.v1')).count).toBe(2);
  });

  it('sync() adopts a lower total — the undo path', () => {
    const { api } = setup();
    act(() => { for (let i = 0; i < 5; i++) api.current.bump(); });
    expect(api.current.count).toBe(5);

    const now = Date.now();
    act(() => { api.current.sync(2, now); });
    expect(api.current.count).toBe(2);
    expect(JSON.parse(localStorage.getItem('awanaTally.v1')).count).toBe(2);
  });

  it('sync() adopts a higher total — the catch-up path', () => {
    const { api } = setup();
    act(() => { api.current.bump(); });
    expect(api.current.count).toBe(1);

    const now = Date.now();
    act(() => { api.current.sync(30, now); });
    expect(api.current.count).toBe(30);
  });

  // The counter is ordered against the PRINTER's clock, never this
  // device's — a signage TV whose clock has drifted must still reconcile.
  it('adopts a broadcast the local clock thinks is hours old (clock skew)', () => {
    const { api } = setup();
    act(() => { for (let i = 0; i < 5; i++) api.current.bump(); });

    // This screen's clock runs hours ahead of the check-in laptop's, so
    // every broadcast looks ancient locally. It is still the truth.
    const skewedAt = Date.now() - 6 * 60 * 60 * 1000;
    let delta;
    act(() => { delta = api.current.sync(3, skewedAt); });
    expect(delta).toBe(-2);
    expect(api.current.count).toBe(3);
  });

  it('ignores a broadcast delivered out of order', () => {
    const { api } = setup();
    const t = Date.now();
    act(() => { api.current.sync(20, t); });

    let delta;
    act(() => { delta = api.current.sync(19, t - 5000); });
    expect(delta).toBe(0);
    expect(api.current.count).toBe(20); // the newer broadcast still stands
  });

  it('re-baselines when the printer\'s own clock moves backwards', () => {
    const { api } = setup();
    const t = Date.now();
    act(() => { api.current.sync(20, t); });

    // Further back than out-of-order delivery can explain: the printer
    // restarted or NTP corrected it. Ignoring it forever would strand the
    // counter, so the next broadcast becomes the new baseline.
    let delta;
    act(() => { delta = api.current.sync(12, t - TEN_MIN_MS); });
    expect(delta).toBe(-8);
    expect(api.current.count).toBe(12);

    // ...and ordering continues from the new baseline. This one moved by
    // exactly one, which the corner note (#351) stays silent about.
    act(() => { delta = api.current.sync(13, t - TEN_MIN_MS + 1000); });
    expect(delta).toBe(1);
    expect(api.current.count).toBe(13);
  });

  it('is a no-op when the broadcast total already matches', () => {
    const { api } = setup();
    act(() => { for (let i = 0; i < 4; i++) api.current.bump(); });

    const now = Date.now();
    let delta;
    act(() => { delta = api.current.sync(4, now); });
    expect(delta).toBe(0);
    expect(api.current.count).toBe(4);
  });

  it('rejects malformed totals defensively (negative, non-integer, non-finite)', () => {
    const { api } = setup();
    act(() => { api.current.bump(); }); // count === 1
    const now = Date.now();

    for (const bad of [-1, 1.5, NaN, Infinity, '5', null, undefined]) {
      let delta;
      act(() => { delta = api.current.sync(bad, now); });
      expect(delta).toBe(0);
    }
    expect(api.current.count).toBe(1);
  });

  it('rejects a broadcast with a missing/invalid timestamp', () => {
    const { api } = setup();
    let delta;
    act(() => { delta = api.current.sync(9, undefined); });
    expect(delta).toBe(0);
    expect(api.current.count).toBe(0);
  });

  it('reset() zeroes the counter, and a later fresh tally re-adopts', () => {
    const { api } = setup();
    act(() => { for (let i = 0; i < 6; i++) api.current.bump(); });
    expect(api.current.count).toBe(6);

    act(() => { api.current.reset(); });
    expect(api.current.count).toBe(0);

    const now = Date.now();
    act(() => { api.current.sync(11, now); });
    expect(api.current.count).toBe(11);
  });

  it('a stale (previous-day) localStorage entry is overwritten under today\'s key', () => {
    const { api } = setup();
    // Load() already treats yesterday's entry as day-rolled-over (count 0);
    // sync() must still write TODAY's key when it adopts a fresh total,
    // never resurrecting the old date.
    localStorage.setItem('awanaTally.v1', JSON.stringify({ date: '2000-01-01', count: 3 }));
    expect(api.current.count).toBe(0); // mounted before the stale entry existed

    const now = Date.now();
    let delta;
    act(() => { delta = api.current.sync(5, now); });
    expect(delta).toBe(5);
    expect(api.current.count).toBe(5);
    const stored = JSON.parse(localStorage.getItem('awanaTally.v1'));
    expect(stored.count).toBe(5);
    expect(stored.date).not.toBe('2000-01-01');
  });

  // ── The delta sync() reports (#351) ──────────────────────────────────────
  // App.jsx reads it twice: any non-zero delta suppresses the every-Nth
  // milestone (a reconciliation is not an arrival), and a delta bigger than
  // one puts "synced with the check-in desk" under the corner counter.
  describe('sync() reports the signed delta it applied', () => {
    it('reports a positive delta on a catch-up jump', () => {
      const { api } = setup();
      act(() => { for (let i = 0; i < 38; i++) api.current.bump(); });

      let delta;
      act(() => { delta = api.current.sync(45, Date.now()); });
      // The jump the note exists for: 38 → 45 looks like a bug on a wall.
      expect(delta).toBe(7);
      expect(api.current.count).toBe(45);
    });

    it('reports a NEGATIVE delta when an operator undo drops the total', () => {
      const { api } = setup();
      act(() => { for (let i = 0; i < 12; i++) api.current.bump(); });

      let delta;
      act(() => { delta = api.current.sync(9, Date.now()); });
      expect(delta).toBe(-3);
      expect(api.current.count).toBe(9);
    });

    it('reports exactly ±1 for the ordinary one-step difference', () => {
      // These happen constantly — our bump() and the printer's total crossing
      // paths — and are precisely the case the note must stay quiet about.
      const { api } = setup();
      const t = Date.now();
      act(() => { for (let i = 0; i < 5; i++) api.current.bump(); });

      let delta;
      act(() => { delta = api.current.sync(6, t); });
      expect(delta).toBe(1);
      act(() => { delta = api.current.sync(5, t + 1000); });
      expect(delta).toBe(-1);
    });

    it('keeps the old truthiness contract: 0 means nothing changed', () => {
      // App.jsx guards with `if (delta)`, so a changed count must never
      // report a falsy value and an unchanged one must never report truthy.
      const { api } = setup();
      const t = Date.now();
      let delta;
      act(() => { delta = api.current.sync(7, t); });
      expect(Boolean(delta)).toBe(true);
      act(() => { delta = api.current.sync(7, t + 1000); });
      expect(Boolean(delta)).toBe(false);
    });

    it('reports 0 — not a stale delta — for a broadcast rejected as out of order', () => {
      const { api } = setup();
      const t = Date.now();
      act(() => { api.current.sync(30, t); });

      let delta;
      act(() => { delta = api.current.sync(20, t - 5000); });
      expect(delta).toBe(0);
      expect(api.current.count).toBe(30);
    });

    it('reports the delta against the RE-BASELINED count when the printer clock moves', () => {
      // The TALLY_REORDER_MS path: far enough back that it is the printer's
      // clock, not delivery order. The counter adopts it, and the note must
      // describe the move that actually happened (20 → 4), not the rejection.
      const { api } = setup();
      const t = Date.now();
      act(() => { api.current.sync(20, t); });

      let delta;
      act(() => { delta = api.current.sync(4, t - TEN_MIN_MS); });
      expect(delta).toBe(-16);
      expect(api.current.count).toBe(4);
    });
  });
});
