import { describe, it, expect } from 'vitest';
import { BRACELET_STEPS, EPIC_EVERY_SEC, EPIC_LEAD_SEC, EPIC_SEC, STEP_SEC, braceletFrame, epicStarts } from './bracelets.js';

const at = (hhmmss) => Date.parse(`2026-09-30T${hhmmss}-04:00`);
const TNT = [at('18:05:00'), at('18:30:00')];
const SPARKS = [at('18:30:00'), at('19:00:00')];

describe('the steps', () => {
  it('are the handout\'s 7 bead steps then its 6 knot steps, in order', () => {
    expect(BRACELET_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(BRACELET_STEPS.filter((s) => s.kind === 'bead').map((s) => s.color)).toEqual(['black', 'red', 'white', 'blue', 'green', 'yellow']);
    expect(BRACELET_STEPS[6].words).toMatch(/clear bead to each side/i);
    expect(BRACELET_STEPS.filter((s) => s.kind === 'knot')).toHaveLength(6);
    expect(BRACELET_STEPS.at(-1).title).toMatch(/pull tight/i);
  });

  it('pins the cadence the owner asked for', () => {
    expect([STEP_SEC, EPIC_SEC, EPIC_EVERY_SEC, EPIC_LEAD_SEC]).toEqual([10, 90, 300, 10]);
  });
});

describe('epicStarts', () => {
  it('plays 10 s after the window opens, then every 5 minutes, only if it can finish', () => {
    expect(epicStarts(...TNT).map((t) => new Date(t).toISOString().slice(11, 19))).toEqual(['22:05:10', '22:10:10', '22:15:10', '22:20:10', '22:25:10']);
    expect(epicStarts(...SPARKS)).toHaveLength(6);
    // A window too short for one showing gets none.
    expect(epicStarts(at('18:00:00'), at('18:01:30'))).toEqual([]);
  });
});

describe('braceletFrame', () => {
  it('opens on the title card with the chime, then the epic', () => {
    expect(braceletFrame(at('18:05:00'), ...TNT)).toMatchObject({ mode: 'intro', chime: true });
    expect(braceletFrame(at('18:05:09'), ...TNT)).toMatchObject({ mode: 'intro', chime: true });
    expect(braceletFrame(at('18:05:10'), ...TNT)).toMatchObject({ mode: 'epic', chime: false, epicElapsedSec: 0 });
    expect(braceletFrame(at('18:06:39'), ...TNT)).toMatchObject({ mode: 'epic', epicElapsedSec: 89 });
  });

  it('after an epic, loops one step at a time from step 1', () => {
    expect(braceletFrame(at('18:06:40'), ...TNT)).toMatchObject({ mode: 'steps', stepIndex: 0 });
    expect(braceletFrame(at('18:06:50'), ...TNT)).toMatchObject({ mode: 'steps', stepIndex: 1 });
    // 13 steps x 10 s = 130 s later it is back at step 1.
    expect(braceletFrame(at('18:08:50'), ...TNT)).toMatchObject({ mode: 'steps', stepIndex: 0 });
  });

  it('chimes in the 10 s before each showing, never during one', () => {
    expect(braceletFrame(at('18:09:59'), ...TNT).chime).toBe(false);
    expect(braceletFrame(at('18:10:00'), ...TNT)).toMatchObject({ mode: 'steps', chime: true });
    expect(braceletFrame(at('18:10:10'), ...TNT)).toMatchObject({ mode: 'epic', chime: false });
  });

  it('never starts an epic that would outlast the window', () => {
    const f = braceletFrame(at('18:27:00'), ...TNT);
    expect(f.mode).toBe('steps');
    expect(f.nextEpicMs).toBeNull();
    expect(braceletFrame(at('18:29:55'), ...TNT).chime).toBe(false);
  });

  it('a leader can step the loop and play the epic now', () => {
    expect(braceletFrame(at('18:06:40'), ...TNT, { stepOffset: 1 }).stepIndex).toBe(1);
    expect(braceletFrame(at('18:06:40'), ...TNT, { stepOffset: -1 }).stepIndex).toBe(12);
    expect(braceletFrame(at('18:07:05'), ...TNT, { manualEpicAt: at('18:07:00') })).toMatchObject({ mode: 'epic', epicElapsedSec: 5 });
  });
});
