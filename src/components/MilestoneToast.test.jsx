import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZeroAnimationContext } from '../lib/motion.jsx';
import { getClubPalette } from '../lib/clubs.js';
import { bookMilestoneCopy } from '../lib/milestones.js';
import { firstOfNightCopy } from '../lib/firstOfNight.js';
import { bandRoom, plateChrome } from '../lib/overlayFit.js';
import MilestoneToast, { LINE, toastFit, toastFor } from './MilestoneToast.jsx';

const css = readFileSync(resolve(__dirname, '../styles/app.css'), 'utf8');

afterEach(cleanup);
const still = (ui) => render(<ZeroAnimationContext.Provider value>{ui}</ZeroAnimationContext.Provider>);

describe('toastFor', () => {
  it('keeps every kind\'s own copy and its e2e class', () => {
    expect(toastFor({ kind: 'club', club: 'Sparks', count: 20 })).toMatchObject({
      label: 'Sparks', line: '20 kids strong!', className: 'milestone-toast club-milestone', tone: 'club',
    });
    expect(toastFor({ kind: 'kid', firstName: 'Ava', club: 'Sparks', count: 10 })).toMatchObject({
      label: 'Ava’s', line: '10th club night!', className: 'milestone-toast kid-milestone', tone: 'club',
    });
    expect(toastFor({ kind: 'tally', count: 25 })).toMatchObject({
      label: 'Checked in tonight', line: '25 kids!', className: 'milestone-toast', tone: 'hot',
    });
    expect(toastFor({ kind: 'night', count: 100, label: 'Triple digits', headline: '100 kids tonight!' })).toMatchObject({
      label: 'Triple digits', line: '100 kids tonight!', className: 'milestone-toast night-milestone', tone: 'hot', big: true,
    });
    expect(toastFor({ kind: 'books', count: 5, ...bookMilestoneCopy(5) })).toMatchObject({
      label: 'Handbooks', className: 'milestone-toast night-milestone handbook-milestone books-milestone', tone: 'handbook',
    });
    expect(toastFor({ kind: 'awards', count: 10, label: 'Awards earned', headline: '10 awards earned tonight!' }).className)
      .toBe('milestone-toast night-milestone handbook-milestone awards-milestone');
    expect(toastFor({ kind: 'first', firstName: 'Ava', count: 1, ...firstOfNightCopy('Ava') })).toMatchObject({
      label: 'Doors are open', line: 'Ava is first in tonight!', className: 'milestone-toast first-milestone', big: true,
    });
  });
});

describe('MilestoneToast', () => {
  it('renders nothing without a celebration', () => {
    const { container } = still(<MilestoneToast celebration={null} club={null} />);
    expect(container.querySelector('.milestone-toast')).toBeNull();
  });

  it('a club milestone wears the club\'s colour and wordmark, never the mascot', () => {
    const club = getClubPalette('Sparks');
    const { container } = still(<MilestoneToast celebration={{ kind: 'club', club: 'Sparks', count: 20 }} club={club} />);
    const toast = container.querySelector('.milestone-toast.club-milestone');
    expect(toast.textContent).toContain('20 kids strong!');
    expect(toast.classList.contains('milestone-toast--club')).toBe(true);
    expect(toast.querySelector('.club-logo')).not.toBeNull();
    // The label is the kit chip's Londrina pill.
    expect(toast.querySelector('.step-plate__label.milestone-label').textContent).toBe('Sparks');
  });

  it('a room-wide one has no wordmark and sits on the hot plate', () => {
    const { container } = still(<MilestoneToast celebration={{ kind: 'tally', count: 25 }} club={null} />);
    const toast = container.querySelector('.milestone-toast');
    expect(toast.classList.contains('milestone-toast--hot')).toBe(true);
    expect(toast.querySelector('.club-logo')).toBeNull();
  });

  it('a 40-character first name takes two lines inside the band, under the flag strip too', () => {
    const name = 'Maximilian-Alexander Jonathan-Christophe';
    expect(name).toHaveLength(40);
    const line = firstOfNightCopy(name).headline;
    const fit = toastFit(line, { compact: true });
    expect(fit.fits).toBe(true);
    expect(fit.lines).toHaveLength(2);
    expect(fit.lines.join(' ')).toBe(line);
  });

  it('a line too long even for two is handed to the browser to wrap, never set unbroken', () => {
    const headline = 'Supercalifragilisticexpialidocious-supercalifragilistic!';
    expect(toastFit(headline).fits).toBe(false);
    const { container } = still(<MilestoneToast celebration={{ kind: 'night', count: 100, label: 'Triple digits', headline }} club={null} />);
    const line = container.querySelector('.milestone-count');
    // Unbroken lines (white-space: nowrap) would run the plate past its 50u.
    expect(line.classList.contains('milestone-count--wrap')).toBe(true);
    expect(line.querySelectorAll('.milestone-count__line')).toHaveLength(0);
    expect(line.textContent).toBe(headline);
  });

  it('fits every line to end where the band ends, under the flag strip too', () => {
    const lines = ['20 kids strong!', '100 kids tonight!', 'Maximilian-Alexander Jonathan is first in tonight!', 'Ava is first in tonight!'];
    for (const compact of [false, true]) {
      for (const text of lines) {
        const f = toastFit(text, { compact });
        if (!f.fits) continue;
        const reach = plateChrome(1.45) + 1.2 + f.lines.length * f.size * LINE.lineHeight;
        expect(reach).toBeLessThanOrEqual(bandRoom(compact));
      }
    }
  });

  it('holds stage 4b-2\'s cap heights in Paytone One: its Galindo sizes times 1.057, its line height over it', () => {
    const galindo = { max: 3, min: 2, twoLineMax: 2.2, twoLineMin: 1.4 };
    for (const [k, v] of Object.entries(galindo)) expect(Math.abs(LINE[k] - v * 1.057), k).toBeLessThanOrEqual(0.05);
    expect(Math.abs(LINE.lineHeight - 1.02 / 1.057)).toBeLessThanOrEqual(0.01);
    // The line box the fit counts is the one app.css draws.
    const rule = css.match(/\.milestone-toast \.milestone-count \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(new RegExp(`line-height: ${LINE.lineHeight};`));
    expect(rule).toMatch(new RegExp(`--toast-line, calc\\(${LINE.max} \\* var\\(--u\\)\\)`));
  });

  it('a long first name breaks into two lines that still read as one sentence', () => {
    const c = { kind: 'first', firstName: 'Maximilian-Alexander Jonathan', count: 1, ...firstOfNightCopy('Maximilian-Alexander Jonathan') };
    const { container } = still(<MilestoneToast celebration={c} club={null} />);
    const line = container.querySelector('.milestone-count');
    expect(line.classList.contains('milestone-count--two')).toBe(true);
    expect(line.querySelectorAll('.milestone-count__line')).toHaveLength(2);
    expect(line.textContent).toBe('Maximilian-Alexander Jonathan is first in tonight!');
  });
});

describe('the toast plate', () => {
  // jsdom has no layout: give the plate's boxes a size so StepPlate draws.
  const sizes = { 'step-plate': [400, 120], 'step-plate__label': [80, 30], 'step-plate__body': [340, 95] };
  const pick = (el, i) => {
    const key = Object.keys(sizes).find((k) => el.classList?.contains(k));
    return key ? sizes[key][i] : 0;
  };
  let saved;
  beforeAll(() => {
    saved = {
      w: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
      h: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return pick(this, 0); } });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return pick(this, 1); } });
  });
  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', saved.w);
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', saved.h);
  });
  const fill = (ui) => still(ui).container.querySelector('.milestone-toast .step-plate__fill').style.fill;
  // The colour as the DOM spells it back (jsdom turns #hex into rgb()).
  const norm = (c) => { const el = document.createElement('i'); el.style.fill = c; return el.style.fill; };

  it('is the club\'s own colour for a club or one child, hot for the room, blue for handbooks', () => {
    const sparks = getClubPalette('Sparks');
    expect(fill(<MilestoneToast celebration={{ kind: 'club', club: 'Sparks', count: 20 }} club={sparks} />)).toBe(norm(sparks.primary));
    cleanup();
    const tnt = getClubPalette('T&T');
    expect(fill(<MilestoneToast celebration={{ kind: 'kid', firstName: 'Ava', club: 'T&T', count: 10 }} club={tnt} />)).toBe(norm(tnt.primary));
    cleanup();
    expect(fill(<MilestoneToast celebration={{ kind: 'tally', count: 25 }} club={null} />)).toBe('var(--brand-hot)');
    cleanup();
    expect(fill(<MilestoneToast celebration={{ kind: 'books', count: 5, ...bookMilestoneCopy(5) }} club={null} />)).toBe('var(--brand-blue)');
  });
});

describe('the toast in the band', () => {
  const opacity = (el) => Number(el.style.opacity === '' ? 1 : el.style.opacity);

  it('with a band notice up, waits out the notice\'s exit before it lands', async () => {
    const c = { kind: 'tally', count: 25 };
    const held = render(<MilestoneToast celebration={c} club={null} afterNotice />);
    const plain = render(<MilestoneToast celebration={{ ...c, count: 26 }} club={null} />);
    const toasts = () => [held, plain].map((r) => r.container.querySelector('.milestone-toast'));
    await new Promise((r) => setTimeout(r, 160));
    const [a, b] = toasts();
    expect(opacity(a)).toBeLessThan(0.05);
    expect(opacity(b)).toBeGreaterThan(0.2);
    await waitFor(() => expect(opacity(toasts()[0])).toBe(1), { timeout: 2000 });
  });

  it('drops below a critical notice that keeps the band, and steps aside when it must wait', async () => {
    const c = { kind: 'tally', count: 25 };
    const { container, rerender } = still(<MilestoneToast celebration={c} club={null} below />);
    expect(container.querySelector('.milestone-toast').classList.contains('milestone-toast--below')).toBe(true);
    rerender(<ZeroAnimationContext.Provider value><MilestoneToast celebration={c} club={null} yielding /></ZeroAnimationContext.Provider>);
    await waitFor(() => expect(opacity(container.querySelector('.milestone-toast'))).toBe(0));
  });
});
