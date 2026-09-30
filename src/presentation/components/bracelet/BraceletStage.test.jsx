import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { BraceletStage, EpicStage, currentEpicStep } from './BraceletStage.jsx';
import { StepArt } from './StepArt.jsx';
import { EPIC_BEATS, currentEpicStep as fromLib, stepFrame, stillFrame, stillP } from '../../lib/braceletArt.js';

afterEach(cleanup);

const markup = (el) => {
  const { container, unmount } = render(el);
  const html = container.innerHTML.replace(/brc[A-Za-z0-9_-]*?-bead/g, 'ID-bead').replace(/id="brc[^"]*"/g, 'id="ID"');
  unmount();
  return html;
};

describe('BraceletStage', () => {
  it('shows the finished step when still, whatever the time, framed as the loop frames it', () => {
    const still = markup(<StepArt step={4} p={1} camera={stillFrame(4)} />);
    expect(markup(<BraceletStage step={4} startMs={Date.now()} still />)).toBe(still);
    expect(markup(<BraceletStage step={4} startMs={Date.now() - 2000} still />)).toBe(still);
    // (and the framing is a real close-up, not the whole stage)
    expect(stepFrame(4, 1).scale).toBeGreaterThan(1);
  });

  it('shows a move\'s key frame when still, its guide arrow up (knot 1: the left hand going over)', () => {
    expect(stillP(7)).toBeLessThan(1);
    expect(markup(<BraceletStage step={7} startMs={Date.now()} still />)).toBe(markup(<StepArt step={7} p={stillP(7)} camera={stillFrame(7)} />));
  });

  it('starts a step from its first frame and plays it on the clock', async () => {
    const start = Date.now();
    const first = markup(<StepArt step={0} p={0} />);
    const { container } = render(<BraceletStage step={0} startMs={start} />);
    const clean = () => container.innerHTML.replace(/brc[A-Za-z0-9_-]*?-bead/g, 'ID-bead').replace(/id="brc[^"]*"/g, 'id="ID"');
    await waitFor(() => expect(clean()).not.toBe(first), { timeout: 2000 });
  });

  it('plays straight on into the next step, from its first frame in the same render (never a frame of it finished)', () => {
    const finished = markup(<StepArt step={1} p={1} camera={stepFrame(1, 1)} />);
    const { container, rerender } = render(<BraceletStage step={0} startMs={Date.now() - 9000} />);
    rerender(<BraceletStage step={1} startMs={Date.now()} />);
    const html = container.innerHTML.replace(/brc[A-Za-z0-9_-]*?-bead/g, 'ID-bead').replace(/id="brc[^"]*"/g, 'id="ID"');
    expect(html).not.toBe(finished);
    // It opens on step 2's first frame: framed where step 1 rested (not
    // where step 2 will rest), to within the few ms the render took.
    const [, x, y, sc] = html.match(/transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)"/).map(Number);
    const c = stepFrame(1, 0);
    expect(Math.abs(x - c.x)).toBeLessThan(3);
    expect(Math.abs(y - c.y)).toBeLessThan(3);
    expect(Math.abs(sc - c.scale)).toBeLessThan(0.01);
    expect(Math.abs(x - stepFrame(1, 1).x)).toBeGreaterThan(30);
  });

  it('holds the finished picture once the action is over', () => {
    const html = markup(<BraceletStage step={7} startMs={Date.now() - 9000} />);
    expect(html).toBe(markup(<StepArt step={7} p={1} camera={stepFrame(7, 1)} />));
  });
});

describe('EpicStage', () => {
  it('shows, still, the finished picture of the beat the clock is in, with no camera', () => {
    const beat = EPIC_BEATS[3];
    const at = (beat.start + beat.end) / 2;
    const html = markup(<EpicStage startMs={Date.now() - at * 1000} still />);
    expect(html).toBe(markup(<StepArt step={beat.step} p={stillP(beat.step)} camera={stillFrame(beat.step)} />));
  });

  it('shows the finale\'s rest once the 90 s are up', () => {
    expect(markup(<EpicStage startMs={Date.now() - 200_000} still />)).toBe(markup(<StepArt step="finale" p={1} />));
  });

  it('exports the caption helper', () => {
    expect(currentEpicStep).toBe(fromLib);
  });
});
