import { describe, expect, it } from 'vitest';
import {
  crossedMilestones, isBigMilestone, nightMilestoneCopy, NIGHT_MILESTONES,
} from './milestones.js';

describe('crossedMilestones', () => {
  it('reports a threshold crossed by a single increment', () => {
    expect(crossedMilestones(99, 100)).toEqual([100]);
  });

  it('reports nothing when the threshold is not reached', () => {
    expect(crossedMilestones(97, 99)).toEqual([]);
  });

  it('reports nothing when the count is unchanged', () => {
    // A reconnect re-delivers the current total; that must not re-celebrate.
    expect(crossedMilestones(100, 100)).toEqual([]);
  });

  it('reports nothing when the count goes DOWN', () => {
    // An older snapshot arriving late (or a corrected count) is not a crossing.
    expect(crossedMilestones(120, 100)).toEqual([]);
  });

  it('catches a threshold jumped clean over', () => {
    // The real reason this is transition-based: a batch reconcile can take the
    // count 98 → 103, and `next % 50 === 0` would miss 100 entirely.
    expect(crossedMilestones(98, 103)).toEqual([100]);
  });

  it('reports every threshold in a big jump, ascending', () => {
    expect(crossedMilestones(40, 160)).toEqual([50, 100, 150]);
  });

  it('does not re-report a threshold already below prev', () => {
    expect(crossedMilestones(100, 120)).toEqual([]);
    expect(crossedMilestones(100, 150)).toEqual([150]);
  });

  it('tolerates junk input', () => {
    expect(crossedMilestones(NaN, 100)).toEqual([]);
    expect(crossedMilestones(0, NaN)).toEqual([]);
    expect(crossedMilestones(undefined, 100)).toEqual([]);
    expect(crossedMilestones(null, null)).toEqual([]);
  });

  it('accepts custom thresholds', () => {
    expect(crossedMilestones(9, 11, [10, 20])).toEqual([10]);
  });

  it('has ascending built-in thresholds', () => {
    const sorted = [...NIGHT_MILESTONES].sort((a, b) => a - b);
    expect([...NIGHT_MILESTONES]).toEqual(sorted);
  });
});

describe('nightMilestoneCopy', () => {
  it('names the triple-digit moment distinctly', () => {
    const copy = nightMilestoneCopy(100);
    expect(copy.label).toMatch(/triple/i);
    expect(copy.headline).toContain('100');
  });

  it('escalates copy for very large nights', () => {
    expect(nightMilestoneCopy(200).label).toMatch(/huge/i);
  });

  it('always includes the number in the headline', () => {
    for (const n of NIGHT_MILESTONES) {
      expect(nightMilestoneCopy(n).headline).toContain(String(n));
    }
  });

  it('differs from the generic every-Nth wording', () => {
    // The point of a named threshold is that it does not read as another
    // routine toast.
    expect(nightMilestoneCopy(100).label).not.toBe('Checked in tonight');
  });
});

describe('isBigMilestone', () => {
  it('treats 100 and above as big', () => {
    expect(isBigMilestone(100)).toBe(true);
    expect(isBigMilestone(250)).toBe(true);
  });
  it('treats 50 as ordinary', () => {
    expect(isBigMilestone(50)).toBe(false);
  });
});
