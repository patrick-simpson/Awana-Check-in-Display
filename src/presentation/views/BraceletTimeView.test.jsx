import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

// The view's own decisions (which body, which corner chip, when the chime
// fires) with the art stubbed out: the art has its own tests, and the wall's
// choices must not depend on how a bead is drawn.
vi.mock('../lib/stingers.js', () => ({ playStinger: vi.fn() }));
vi.mock('../lib/chime.js', () => ({ chimeOnce: vi.fn() }));
vi.mock('../components/bracelet/StepArt.jsx', () => ({
  StepArt: ({ step }) => <div data-testid="step-art" data-step={step} />,
}));
vi.mock('../components/bracelet/BraceletStage.jsx', () => ({
  BraceletStage: ({ step, still }) => <div data-testid="stage" data-step={step} data-still={String(still)} />,
  EpicStage: ({ still }) => <div data-testid="epic" data-still={String(still)} />,
  currentEpicStep: (sec) => (sec < 4 || sec >= 84 ? null : Math.min(12, Math.floor((sec - 4) / 6.15))),
}));

import { BraceletTimeView } from './BraceletTimeView.jsx';
import { chimeOnce } from '../lib/chime.js';
import { playStinger } from '../lib/stingers.js';
import { resetBraceletSettings, setBraceletSettings, playEpicNow } from '../lib/braceletSettings.js';

const TNT = { kind: 'game', clubs: ['tnt'], title: 'T&T Game Time', startMin: 18 * 60 + 5, endMin: 18 * 60 + 30 };
const ENDS_AT = new Date('2026-09-30T18:30:00');
const at = (hms) => new Date(`2026-09-30T${hms}`);

const wall = (now, extra = {}) =>
  render(<BraceletTimeView now={now} window={TNT} endsAt={ENDS_AT} tally={null} {...extra} />).container;
const phase = (c) => c.querySelector('[data-bracelet-phase]').getAttribute('data-bracelet-phase');
const step = (c) => c.querySelector('[data-bracelet-step]')?.getAttribute('data-bracelet-step') ?? null;
const corner = (c) => c.querySelector('.pj-bracelet__corner').textContent;

describe('BraceletTimeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetBraceletSettings();
  });
  afterEach(cleanup);

  it('opens on the title card with the countdown to the first how-to, and chimes once', () => {
    const c = wall(at('18:05:02'));
    expect(phase(c)).toBe('intro');
    expect(c.textContent).toMatch(/Bracelet time!/i);
    expect(corner(c)).toMatch(/BIG HOW-TO IN/i);
    expect(corner(c)).toMatch(/0:08/);
    expect(chimeOnce).toHaveBeenCalledTimes(1);
  });

  it('plays the epic how-to 10 seconds in, with a caption that follows it', () => {
    const c = wall(at('18:05:25'));
    expect(phase(c)).toBe('epic');
    expect(c.querySelector('[data-testid="epic"]')).not.toBeNull();
    expect(c.textContent).toMatch(/Watch how!/i);
  });

  it('leaves the finale\'s shout to the art: the caption only says how', () => {
    const c = wall(at('18:06:36')); // 86 s into the epic that started at 18:05:10
    expect(phase(c)).toBe('epic');
    const caption = c.querySelector('.pj-bracelet__caption');
    expect(caption.querySelector('h1')).toBeNull();
    expect(caption.textContent).toMatch(/Now make yours/);
  });

  it('then goes one step at a time from step 1, with the end time in the corner', () => {
    const c = wall(at('18:06:45'));
    expect(phase(c)).toBe('steps');
    expect(step(c)).toBe('1');
    expect(c.textContent).toMatch(/Add a black bead/i);
    expect(corner(c)).toMatch(/T&T craft time/i);
    expect(corner(c)).toMatch(/ENDS 6:30 PM/i);
  });

  it('calls the knot steps KNOT 1-6, like the handout', () => {
    const c = wall(at('18:07:55')); // 75 s into the steps: the 8th step
    expect(step(c)).toBe('8');
    expect(c.textContent).toMatch(/Cross the ends/i);
    expect(c.querySelector('[role="img"][aria-label^="KNOT"]')).not.toBeNull();
  });

  it('keeps the window\'s warnings, and plays the stinger once per warning', () => {
    const c = wall(at('18:28:30'));
    expect(c.querySelector('[data-warning="two-minute"]')).not.toBeNull();
    expect(corner(c)).toMatch(/TWO MINUTES/);
    expect(playStinger).toHaveBeenCalledTimes(1);
  });

  it('holds one step when the controls say so, and never plays the epic over it', () => {
    setBraceletSettings({ hold: 4 });
    const c = wall(at('18:05:25'));
    expect(phase(c)).toBe('hold');
    expect(step(c)).toBe('5');
    expect(c.querySelector('[data-testid="epic"]')).toBeNull();
    expect(chimeOnce).not.toHaveBeenCalled();
  });

  it('shows stills and no epic with animations off', () => {
    setBraceletSettings({ still: true });
    const c = wall(at('18:05:25'));
    expect(phase(c)).toBe('steps');
    expect(c.querySelector('[data-testid="stage"]').getAttribute('data-still')).toBe('true');
    expect(chimeOnce).not.toHaveBeenCalled();
  });

  it('never chimes with the chime off, but still counts down on the wall', () => {
    setBraceletSettings({ chime: false });
    const c = wall(at('18:05:02'));
    expect(corner(c)).toMatch(/BIG HOW-TO IN/i);
    expect(chimeOnce).not.toHaveBeenCalled();
  });

  it('shows the full instructions and the original handout pages on request', () => {
    setBraceletSettings({ display: 'overview' });
    let c = wall(at('18:10:00'));
    expect(phase(c)).toBe('overview');
    expect(c.querySelectorAll('[data-testid="step-art"]').length).toBeGreaterThan(0);
    cleanup();
    setBraceletSettings({ display: 'handout2' });
    c = wall(at('18:10:00'));
    expect(phase(c)).toBe('handout2');
    expect(c.querySelector('img[alt*="page 2"]')).not.toBeNull();
  });

  it('plays the epic now when asked, from the steps', () => {
    const c = wall(at('18:08:00'));
    expect(phase(c)).toBe('steps');
    act(() => playEpicNow(at('18:08:00').getTime()));
    expect(phase(c)).toBe('epic');
  });
});
