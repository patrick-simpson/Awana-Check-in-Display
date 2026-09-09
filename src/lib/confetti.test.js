import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// canvas-confetti is imported at module scope and the real library wants a
// 2d canvas context, which jsdom returns null for — so it is mocked. The
// module has a DEFAULT export, hence the `default` key.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import confetti from 'canvas-confetti';
import { fireMilestone, setConfettiLevel, setConfettiLoad } from './confetti.js';

// Asserted as literals rather than imported: a silent palette edit should
// fail this file, not quietly agree with it.
const HOUSE = ['#F7A41C', '#FFD257', '#FFFFFF', '#4CAF50', '#2979FF', '#E53935'];
const SPARKS = ['#E14B4B', '#FFB300', '#FFFFFF'];

describe('fireMilestone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // levelFactor / loadFactor are module state and persist across cases in
    // one file, so reset both or the 'off' case poisons everything after it.
    setConfettiLevel('full');
    setConfettiLoad(false);
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const paletteOf = (call) => call[0].colors;

  it('keeps the house palette when no colors are passed', () => {
    fireMilestone();
    expect(confetti).toHaveBeenCalled();
    expect(paletteOf(confetti.mock.calls[0])).toEqual(HOUSE);
  });

  it('keeps the house palette on every wave of a big room-wide milestone', () => {
    fireMilestone({ big: true });
    vi.runAllTimers();
    expect(confetti.mock.calls.length).toBe(4);
    for (const call of confetti.mock.calls) expect(paletteOf(call)).toEqual(HOUSE);
  });

  it("sends a club's colors to EVERY wave, not just the first", () => {
    fireMilestone({ colors: SPARKS });
    vi.runAllTimers();
    // Opening pop plus the two delayed side cannons.
    expect(confetti.mock.calls.length).toBe(3);
    expect(confetti.mock.calls.every((c) => paletteOf(c) === SPARKS)).toBe(true);
  });

  it('carries the colors through the big milestone second wave too', () => {
    fireMilestone({ big: true, colors: SPARKS });
    vi.runAllTimers();
    expect(confetti.mock.calls.length).toBe(4);
    expect(confetti.mock.calls.every((c) => paletteOf(c) === SPARKS)).toBe(true);
  });

  it("fires nothing at level 'off', colors or not", () => {
    setConfettiLevel('off');
    fireMilestone({ colors: SPARKS });
    vi.runAllTimers();
    expect(confetti).not.toHaveBeenCalled();
  });

  it("still thins a club burst for 'reduced' and for a rush", () => {
    setConfettiLevel('reduced');
    setConfettiLoad(true);
    fireMilestone({ colors: SPARKS });
    // 160 * 0.5 (level) * 0.5 (rush) — colors must not bypass scaled().
    expect(confetti.mock.calls[0][0].particleCount).toBe(40);
  });

  it('keeps the reduced-motion opt-out on every wave', () => {
    fireMilestone({ big: true, colors: SPARKS });
    vi.runAllTimers();
    expect(confetti.mock.calls.every((c) => c[0].disableForReducedMotion === true)).toBe(true);
  });

  it('falls back to the house palette for empty or non-array colors', () => {
    fireMilestone({ colors: [] });
    expect(paletteOf(confetti.mock.calls[0])).toEqual(HOUSE);
    vi.clearAllMocks();
    // A malformed shared-theme override must not strip the burst's color.
    fireMilestone({ colors: 'red' });
    expect(paletteOf(confetti.mock.calls[0])).toEqual(HOUSE);
  });
});
