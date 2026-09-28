import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';

vi.mock('../lib/confetti.js', () => ({
  fireStandard: vi.fn(),
  fireBirthday: vi.fn(),
  fireFirstTimer: vi.fn(),
}));
vi.mock('../lib/audio.js', () => ({
  playChime: vi.fn(),
  playBirthdayChime: vi.fn(),
  playFirstTimerChime: vi.fn(),
}));

import { fireBirthday, fireFirstTimer, fireStandard } from '../lib/confetti.js';
import { playChime } from '../lib/audio.js';
import { ZeroAnimationContext } from '../lib/motion.jsx';
import CheckInMoment from './CheckInMoment.jsx';
import Overlay from './Overlay.jsx';

let nextId = 1;
const kid = (extra = {}) => ({
  id: nextId++, firstName: 'Maya', club: 'Sparks', isBirthday: false, isFirstTimer: false,
  welcomeBack: false, milestone: null, presentation: 'live', ...extra,
});

// Zero-animation mode makes every entrance and exit instant, so the DOM
// reflects the resting state straight away (and a flip's old name leaves at
// once) without driving framer-motion's frame loop from a test.
const still = (ui) => <ZeroAnimationContext.Provider value>{ui}</ZeroAnimationContext.Provider>;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('CheckInMoment', () => {
  it('carries the name in the brand voice, upper-cased, as one readable heading', () => {
    const { container } = render(still(<CheckInMoment event={kid({ firstName: 'Maya' })} />));
    const name = container.querySelector('.checkin__name');
    expect(name.getAttribute('aria-label')).toBe('MAYA');
    expect(name.textContent).toBe('MAYA');
    expect(container.querySelectorAll('.checkin__letter')).toHaveLength(4);
  });

  it('keeps the space between words (and animates a long name per word)', () => {
    const { container } = render(still(<CheckInMoment event={kid({ firstName: 'Mary Elizabeth Anne' })} />));
    const name = container.querySelector('.checkin__name');
    expect(name.textContent).toBe('MARY ELIZABETH ANNE');
    // 19 characters is past PER_LETTER_MAX, so three word pieces, not 17 letters.
    expect(container.querySelectorAll('.checkin__letter')).toHaveLength(3);
  });

  it('wears the child\'s club: colours, official mark, and the mode class', () => {
    const { container } = render(still(<CheckInMoment event={kid({ club: 'T&T' })} />));
    const root = container.querySelector('.checkin');
    expect(root.classList.contains('banner')).toBe(true);
    expect(root.classList.contains('welcome')).toBe(true);
    expect(root.dataset.club).toBe('T&T');
    expect(root.style.getPropertyValue('--club-primary')).toMatch(/^#[0-9A-F]{6}$/i);
    expect(container.querySelector('.checkin__mark').getAttribute('alt')).toBe('T&T logo');
  });

  it('an unknown club gets the Awana Clubs mark and the house colours, never a blank', () => {
    const { container } = render(still(<CheckInMoment event={kid({ club: 'Leaders Kids' })} />));
    expect(container.querySelector('.checkin__mark').getAttribute('alt')).toBe('Awana Clubs');
    expect(container.querySelector('.checkin').style.getPropertyValue('--club-primary')).toBe('#FAA41D');
  });

  it.each([
    [{}, 'welcome', 'Welcome', null, null],
    [{ welcomeBack: true }, 'welcome-back', 'Welcome back', /brand-new season/, null],
    [{ isFirstTimer: true }, 'first-timer', 'Welcome to Awana Clubs', /very first time/, 'NEW!'],
    [{ isBirthday: true }, 'birthday', 'Happy birthday', /special day/, 'HAPPYBIRTHDAY!'],
  ])('%o reads as a %s moment', (flags, mode, kicker, line, sticker) => {
    const { container } = render(still(<CheckInMoment event={kid(flags)} />));
    expect(container.querySelector('.checkin').classList.contains(mode)).toBe(true);
    expect(container.querySelector('.checkin__kicker').textContent).toBe(kicker);
    const lineEl = container.querySelector('.checkin__line');
    if (line) expect(lineEl.textContent).toMatch(line);
    else expect(lineEl).toBeNull();
    const st = container.querySelector('.checkin__sticker');
    if (sticker) expect(st.textContent.toUpperCase()).toBe(sticker);
    else expect(st).toBeNull();
  });

  it('a birthday-week ribbon replaces the day-claiming tagline', () => {
    const { container } = render(still(<CheckInMoment event={kid({ isBirthday: true })} ribbon="Birthday this Friday!" />));
    const line = container.querySelector('.checkin__line').textContent;
    expect(line).toBe('Birthday this Friday!');
    expect(container.textContent).not.toMatch(/special day/i);
  });

  it('a plain welcome carries the ribbon and the club phrase', () => {
    const { container } = render(still(
      <CheckInMoment event={kid()} ribbon="Birthday this Friday!" clubPhrases={{ sparks: 'Ready, set, Sparks!' }} />
    ));
    expect(container.querySelector('.checkin__line').textContent).toBe('Birthday this Friday! · Ready, set, Sparks!');
  });

  it('a recap replay says so and is quiet', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(still(<CheckInMoment event={kid({ presentation: 'replay' })} audioEnabled />));
      expect(container.querySelector('.checkin__kicker').textContent).toBe('Also joined us tonight');
      expect(container.querySelector('.checkin').classList.contains('calm')).toBe(true);
      act(() => vi.advanceTimersByTime(2000));
      expect(fireStandard).not.toHaveBeenCalled();
      expect(playChime).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('celebrates once per child, in club colours, landing with the name', () => {
    vi.useFakeTimers();
    try {
      const event = kid({ club: 'Sparks' });
      const { rerender } = render(still(<CheckInMoment event={event} audioEnabled />));
      expect(playChime).toHaveBeenCalledTimes(1);
      expect(fireStandard).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(500));
      expect(fireStandard).toHaveBeenCalledTimes(1);
      const colors = fireStandard.mock.calls[0][0];
      expect(colors).toContain('#FFFFFF');
      expect(colors[0]).toMatch(/^#[0-9A-F]{6}$/i);
      // A re-render for the same child (a font load, a sound toggle) never re-fires.
      rerender(still(<CheckInMoment event={event} audioEnabled={false} />));
      act(() => vi.advanceTimersByTime(2000));
      expect(fireStandard).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('birthdays and first-timers burst with the sticker', () => {
    vi.useFakeTimers();
    try {
      render(still(<CheckInMoment event={kid({ isBirthday: true })} />));
      render(still(<CheckInMoment event={kid({ isFirstTimer: true })} />));
      act(() => vi.advanceTimersByTime(899));
      expect(fireBirthday).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(fireBirthday).toHaveBeenCalledTimes(1);
      expect(fireFirstTimer).toHaveBeenCalledTimes(1);
      expect(fireStandard).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('never claims an age: no number anywhere on a birthday moment', () => {
    const { container } = render(still(<CheckInMoment event={kid({ isBirthday: true })} />));
    expect(container.textContent).not.toMatch(/\d/);
  });
});

describe('Overlay (one moment per run)', () => {
  it('flips the next child in without remounting the moment, then lets the run go', async () => {
    const a = kid({ firstName: 'Maya', club: 'Sparks' });
    const b = kid({ firstName: 'Owen', club: 'Cubbies' });
    const { container, rerender } = render(still(<Overlay currentEvent={a} run={1} step={0} />));
    const moment = container.querySelector('.checkin');
    expect(container.querySelector('.checkin__name').getAttribute('aria-label')).toBe('MAYA');

    rerender(still(<Overlay currentEvent={b} run={1} step={1} />));
    // Same run: the same moment element, now carrying the next child.
    expect(container.querySelector('.checkin')).toBe(moment);
    expect(moment.dataset.club).toBe('Cubbies');
    await waitFor(() => {
      const names = [...container.querySelectorAll('.checkin__name')].map((n) => n.getAttribute('aria-label'));
      expect(names).toEqual(['OWEN']);
    });

    rerender(still(<Overlay currentEvent={null} run={1} step={1} />));
    await waitFor(() => expect(container.querySelector('.checkin')).toBeNull());
  });

  it('a new run is a new moment', async () => {
    const { container, rerender } = render(still(<Overlay currentEvent={kid()} run={1} />));
    const first = container.querySelector('.checkin');
    rerender(still(<Overlay currentEvent={null} run={1} />));
    await waitFor(() => expect(container.querySelector('.checkin')).toBeNull());
    rerender(still(<Overlay currentEvent={kid({ firstName: 'Noah' })} run={2} />));
    await waitFor(() => expect(container.querySelector('.checkin')).not.toBeNull());
    expect(container.querySelector('.checkin')).not.toBe(first);
  });
});
