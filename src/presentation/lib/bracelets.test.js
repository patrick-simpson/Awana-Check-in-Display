import { describe, it, expect } from 'vitest';
import {
  BRACELET_NIGHTS, BRACELET_STEPS, EPIC_EVERY_SEC, EPIC_LEAD_SEC, EPIC_SEC, LOOP_SEC, STEP_SLOTS,
  braceletFrame, epicStarts, isBraceletNight, isBraceletWindow, stepSlotSec, windowSpan,
} from './bracelets.js';

const at = (hhmmss) => Date.parse(`2026-09-30T${hhmmss}-04:00`);
const TNT = [at('18:05:00'), at('18:30:00')];
const SPARKS = [at('18:30:00'), at('19:00:00')];

describe('the steps', () => {
  it('are the handout\'s 7 bead steps then its 6 knot steps, in order', () => {
    expect(BRACELET_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(BRACELET_STEPS.filter((s) => s.kind === 'bead').map((s) => s.color)).toEqual(['black', 'red', 'white', 'blue', 'green', 'yellow']);
    expect(BRACELET_STEPS[6]).toMatchObject({ title: 'Clear beads, then knots', words: 'Add a clear bead on each side of your colors. Tie a knot next to each one.' });
    // The X is a check after the wraps, not a new move (a child could undo the wraps making one).
    expect(BRACELET_STEPS[9]).toMatchObject({ title: 'See the X?', words: 'Your two strings should cross in an X on your finger.' });
    // The one way to fail: the bottom string must lie ALONG the finger, inside the wraps.
    expect(BRACELET_STEPS[8].title).toBe('Wrap 3 times');
    expect(BRACELET_STEPS[8].words).toMatch(/^Lay the bottom string along your pointer finger\./);
    expect(BRACELET_STEPS.filter((s) => s.kind === 'knot')).toHaveLength(6);
    expect(BRACELET_STEPS.at(-1).title).toMatch(/pull tight/i);
  });

  it('says what the art shows: the bead each one goes next to, the 3 loops, a push', () => {
    const words = BRACELET_STEPS.map((s) => s.words);
    expect(words.slice(1, 6)).toEqual([
      'Slide a red bead on, next to the black one.',
      'Slide a white bead on, next to the red one.',
      'Slide a blue bead on, next to the white one.',
      'Slide a green bead on, next to the blue one.',
      'Slide a yellow bead on, next to the green one.',
    ]);
    expect(BRACELET_STEPS[7].words).toBe('Cross the two ends. Left over right.');
    expect(BRACELET_STEPS[10].words).toBe('Pinch the 3 loops. Slide your finger out.');
    expect(BRACELET_STEPS[11]).toMatchObject({ title: 'Push the end through', words: 'Push the end of the top string through the 3 loops.' });
    expect(BRACELET_STEPS[12].words).toBe('Pull both ends tight. You made a bracelet!');
  });

  it('pins the cadence the owner asked for', () => {
    expect([EPIC_SEC, EPIC_EVERY_SEC, EPIC_LEAD_SEC]).toEqual([90, 300, 10]);
  });

  it('gives each step the time it needs: quick bead steps, longer knot steps', () => {
    expect(STEP_SLOTS).toHaveLength(BRACELET_STEPS.length);
    BRACELET_STEPS.forEach((s, i) => {
      if (s.kind === 'bead') expect(stepSlotSec(i), s.title).toBe(9);
      else expect(stepSlotSec(i), s.title).toBeGreaterThanOrEqual(12);
      expect(stepSlotSec(i), s.title).toBeLessThanOrEqual(16);
    });
    expect(stepSlotSec(6)).toBe(14);
    expect(LOOP_SEC).toBe(157);
  });
});

describe('which windows are Bracelet Time', () => {
  const tnt = { kind: 'game', clubs: ['tnt'], startMin: 18 * 60 + 5, endMin: 18 * 60 + 30 };
  const sparks = { kind: 'game', clubs: ['sparks'], startMin: 18 * 60 + 30, endMin: 19 * 60 };
  const pc = { kind: 'game', clubs: ['cubbies', 'puggles'], startMin: 19 * 60, endMin: 19 * 60 + 30 };
  const night = new Date(2026, 8, 30, 18, 10);
  it('T&T and Sparks game time on the two bracelet nights only', () => {
    expect(BRACELET_NIGHTS).toEqual(['2026-09-30', '2026-10-07']);
    expect(isBraceletWindow(tnt, night)).toBe(true);
    expect(isBraceletWindow(sparks, night)).toBe(true);
    expect(isBraceletWindow(sparks, new Date(2026, 9, 7, 18, 40))).toBe(true);
    expect(isBraceletWindow(pc, night)).toBe(false);
    expect(isBraceletWindow(tnt, new Date(2026, 8, 23, 18, 10))).toBe(false);
    expect(isBraceletWindow(tnt, new Date(2026, 9, 14, 18, 10))).toBe(false);
    expect(isBraceletWindow({ kind: 'slideshow', deck: 'opening' }, night)).toBe(false);
    expect(isBraceletWindow(null, night)).toBe(false);
  });
  it('anchors a window to the night it is on', () => {
    const { startMs, endMs } = windowSpan(tnt, night);
    expect(new Date(startMs)).toEqual(new Date(2026, 8, 30, 18, 5));
    expect(new Date(endMs)).toEqual(new Date(2026, 8, 30, 18, 30));
  });
});

describe('epicStarts', () => {
  it('plays 10 s after the window opens, then every 5 minutes, only if it ends before the TWO MINUTES warning', () => {
    // T&T 18:05-18:30: the 18:25:10 showing ends 18:26:40, before the 18:28 TWO MINUTES warning.
    expect(epicStarts(...TNT).map((t) => new Date(t).toISOString().slice(11, 19))).toEqual(['22:05:10', '22:10:10', '22:15:10', '22:20:10', '22:25:10']);
    expect(epicStarts(...SPARKS)).toHaveLength(6);
    // A showing that would still be up at the warning is dropped: in a 25:30
    // window the 5th (at 20:10 in) would end at 21:40, past the 23:30 warning.
    expect(epicStarts(at('18:00:00'), at('18:23:30'))).toHaveLength(4);
    // A window too short for one showing gets none.
    expect(epicStarts(at('18:00:00'), at('18:01:30'))).toEqual([]);
  });
});

describe('braceletFrame', () => {
  it('opens on step 1 with the chime lead (never a full-screen title card), then the epic', () => {
    expect(braceletFrame(at('18:05:00'), ...TNT)).toMatchObject({ mode: 'steps', stepIndex: 0, chime: true });
    // (step 1's slot is 9 s, but no step starts a moment before a showing)
    expect(braceletFrame(at('18:05:09'), ...TNT)).toMatchObject({ mode: 'steps', stepIndex: 0, chime: true });
    expect(braceletFrame(at('18:05:10'), ...TNT)).toMatchObject({ mode: 'epic', chime: false, epicElapsedSec: 0 });
    expect(braceletFrame(at('18:06:39'), ...TNT)).toMatchObject({ mode: 'epic', epicElapsedSec: 89 });
  });

  it('after an epic, loops one step at a time from step 1, each for its own slot', () => {
    expect(braceletFrame(at('18:06:40'), ...TNT)).toMatchObject({ mode: 'steps', stepIndex: 0 });
    expect(braceletFrame(at('18:06:48'), ...TNT)).toMatchObject({ mode: 'steps', stepIndex: 0 });
    expect(braceletFrame(at('18:06:50'), ...TNT)).toMatchObject({ mode: 'steps', stepIndex: 1 });
    // Six 9 s bead steps, then step 7 (14 s), then the knot steps.
    expect(braceletFrame(at('18:07:34'), ...TNT)).toMatchObject({ stepIndex: 6 });
    expect(braceletFrame(at('18:07:48'), ...TNT)).toMatchObject({ stepIndex: 7 });
    expect(braceletFrame(at('18:08:03'), ...TNT)).toMatchObject({ stepIndex: 8 });
    // One pass is 157 s: then it is back at step 1, still from the epic's end.
    expect(braceletFrame(at('18:09:16'), ...TNT)).toMatchObject({ stepIndex: 12 });
    expect(braceletFrame(at('18:09:17'), ...TNT)).toMatchObject({ stepIndex: 0, cycle: `steps:${at('18:06:40')}` });
  });

  it('chimes in the 10 s before each showing, never during one', () => {
    expect(braceletFrame(at('18:09:59'), ...TNT).chime).toBe(false);
    expect(braceletFrame(at('18:10:00'), ...TNT)).toMatchObject({ mode: 'steps', chime: true });
    expect(braceletFrame(at('18:10:10'), ...TNT)).toMatchObject({ mode: 'epic', chime: false });
  });

  it('never starts an epic that would run into the end-of-window warnings', () => {
    const f = braceletFrame(at('18:27:00'), ...TNT);
    expect(f.mode).toBe('steps');
    expect(f.nextEpicMs).toBeNull();
    expect(braceletFrame(at('18:29:55'), ...TNT).chime).toBe(false);
  });

  it('with the epic reel off there is no showing and no chime, but play-now still plays', () => {
    expect(braceletFrame(at('18:05:00'), ...TNT, { epics: false })).toMatchObject({ mode: 'steps', chime: false, stepIndex: 0 });
    expect(braceletFrame(at('18:10:05'), ...TNT, { epics: false })).toMatchObject({ mode: 'steps', chime: false });
    expect(braceletFrame(at('18:12:05'), ...TNT, { epics: false, manualEpicAt: at('18:12:00') }).mode).toBe('epic');
  });

  it('a page reopened long before the window starts (an early QuickNav pick) shows steps, not a stuck title card', () => {
    expect(braceletFrame(at('18:00:00'), ...TNT).mode).toBe('steps');
  });

  it('reports when the current step began, for the art\'s own clock', () => {
    const f = braceletFrame(at('18:06:55'), ...TNT);
    expect(f.stepIndex).toBe(1);
    expect(new Date(f.stepStartMs)).toEqual(new Date(at('18:06:49')));
    expect(f.stepElapsedSec).toBe(6);
    const knot2 = braceletFrame(at('18:08:10'), ...TNT);
    expect(knot2.stepIndex).toBe(8);
    expect(new Date(knot2.stepStartMs)).toEqual(new Date(at('18:08:03')));
  });

  it('a leader can step the loop and play the epic now', () => {
    expect(braceletFrame(at('18:06:40'), ...TNT, { stepOffset: 1 }).stepIndex).toBe(1);
    expect(braceletFrame(at('18:06:40'), ...TNT, { stepOffset: -1 }).stepIndex).toBe(12);
    expect(braceletFrame(at('18:07:05'), ...TNT, { manualEpicAt: at('18:07:00') })).toMatchObject({ mode: 'epic', epicElapsedSec: 5 });
  });

  it('"play it now" shortly before a scheduled epic is never cut off and restarted by it', () => {
    const manualEpicAt = at('18:14:30'); // the scheduled one is at 18:15:10
    for (const t of ['18:14:31', '18:15:10', '18:15:30', '18:15:59']) {
      expect(braceletFrame(at(t), ...TNT, { manualEpicAt })).toMatchObject({ mode: 'epic', epicStartMs: manualEpicAt });
    }
    // Then the steps from step 1, and the next scheduled showing is the one after.
    const after = braceletFrame(at('18:16:00'), ...TNT, { manualEpicAt });
    expect(after).toMatchObject({ mode: 'steps', stepIndex: 0 });
    expect(new Date(after.nextEpicMs)).toEqual(new Date(at('18:20:10')));
  });

  it('"play it now" during a scheduled epic starts it over, once', () => {
    const manualEpicAt = at('18:10:40');
    expect(braceletFrame(at('18:11:00'), ...TNT, { manualEpicAt })).toMatchObject({ mode: 'epic', epicElapsedSec: 20 });
    expect(braceletFrame(at('18:12:05'), ...TNT, { manualEpicAt })).toMatchObject({ mode: 'epic', epicStartMs: manualEpicAt });
    expect(braceletFrame(at('18:12:15'), ...TNT, { manualEpicAt })).toMatchObject({ mode: 'steps', stepIndex: 0 });
  });

  it('"play it now" still plays on a wall kept up past its end, and never carries into a later window', () => {
    expect(braceletFrame(at('19:02:05'), ...SPARKS, { manualEpicAt: at('19:02:00') }).mode).toBe('epic');
    expect(braceletFrame(at('18:30:05'), ...SPARKS, { manualEpicAt: at('18:20:00') }).mode).not.toBe('epic');
  });
});

describe('isBraceletNight', () => {
  it('is the two bracelet nights only, by the local date', () => {
    expect(isBraceletNight(new Date(2026, 8, 30, 12))).toBe(true);
    expect(isBraceletNight(new Date(2026, 9, 7, 23, 59))).toBe(true);
    expect(isBraceletNight(new Date(2026, 8, 23, 18, 10))).toBe(false);
    expect(isBraceletNight(new Date(2026, 9, 14, 18, 10))).toBe(false);
  });
});
