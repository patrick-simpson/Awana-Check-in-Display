import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ZeroAnimationContext } from '../lib/motion.jsx';
import { getClubPalette } from '../lib/clubs.js';
import { bookMilestoneCopy } from '../lib/milestones.js';
import { firstOfNightCopy } from '../lib/firstOfNight.js';
import MilestoneToast, { toastFor } from './MilestoneToast.jsx';

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
    expect(toast.style.getPropertyValue('--club-primary')).toBe(club.primary);
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

  it('a long first name breaks into two lines that still read as one sentence', () => {
    const c = { kind: 'first', firstName: 'Maximilian-Alexander Jonathan', count: 1, ...firstOfNightCopy('Maximilian-Alexander Jonathan') };
    const { container } = still(<MilestoneToast celebration={c} club={null} />);
    const line = container.querySelector('.milestone-count');
    expect(line.classList.contains('milestone-count--two')).toBe(true);
    expect(line.querySelectorAll('.milestone-count__line')).toHaveLength(2);
    expect(line.textContent).toBe('Maximilian-Alexander Jonathan is first in tonight!');
  });
});
