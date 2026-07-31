import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import BirthdayBanner from './BirthdayBanner.jsx';

// The banner fires real confetti + audio on mount; stub both so jsdom
// (no canvas, no Audio) stays quiet.
vi.mock('../lib/confetti.js', () => ({ fireBirthday: vi.fn() }));
vi.mock('../lib/audio.js', () => ({ playBirthdayChime: vi.fn() }));

describe('BirthdayBanner', () => {
  afterEach(cleanup);

  const event = { id: 3, firstName: 'Mia', club: 'Sparks', isBirthday: true, isFirstTimer: false };

  it('greets the birthday kid by name on the birthday band', () => {
    const { container } = render(<BirthdayBanner event={event} audioEnabled={false} />);
    expect(container.querySelector('.banner.birthday')).not.toBeNull();
    expect(container.textContent).toContain('Happy Birthday');
    expect(container.textContent).toContain('M');   // name renders per-letter
  });

  it('renders SVG art instead of OS emoji so every TV looks the same', () => {
    const { container } = render(<BirthdayBanner event={event} audioEnabled={false} />);
    // Cake and falling pieces are inline SVG…
    expect(container.querySelector('.cake svg')).not.toBeNull();
    expect(container.querySelectorAll('.gift-rain .gift svg').length).toBeGreaterThan(0);
    // …and no emoji sneaks into the text (surrogate-pair range).
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(container.textContent)).toBe(false);
  });

  it('lays the gift rain out deterministically per event id', () => {
    const a = render(<BirthdayBanner event={event} audioEnabled={false} />);
    const leftsA = [...a.container.querySelectorAll('.gift-rain .gift')].map((el) => el.style.left);
    cleanup();
    const b = render(<BirthdayBanner event={{ ...event }} audioEnabled={false} />);
    const leftsB = [...b.container.querySelectorAll('.gift-rain .gift')].map((el) => el.style.left);
    expect(leftsA).toEqual(leftsB);
  });
  it('hangs the garland and lights the candles on a live arrival', () => {
    const { container } = render(<BirthdayBanner event={event} audioEnabled={false} />);
    expect(container.querySelector('.birthday-garland svg')).not.toBeNull();
    expect(container.querySelectorAll('.cake-flame').length).toBe(2);
  });

  it.each(['late', 'replay'])('stays calm for a %s arrival', (presentation) => {
    // Calm mode is the invariant most at risk from richer animation. A late
    // arrival must not trigger the full show mid-lesson, and a reconnect must
    // not replay a room-filling celebration for each kid it missed — so the
    // gift rain and the candle flicker both stay off.
    const { container } = render(
      <BirthdayBanner event={{ ...event, presentation }} audioEnabled={false} />,
    );
    expect(container.querySelector('.banner.birthday.calm')).not.toBeNull();
    expect(container.querySelector('.gift-rain')).toBeNull();
    expect(container.querySelectorAll('.cake-flame').length).toBe(0);
    // The cake and garland remain: a quiet banner should still look like a
    // birthday, just not like a party.
    expect(container.querySelector('.cake svg')).not.toBeNull();
    expect(container.querySelector('.birthday-garland svg')).not.toBeNull();
  });

  it('still shows a variety of falling pieces after the art expansion', () => {
    const { container } = render(<BirthdayBanner event={event} audioEnabled={false} />);
    const pieces = container.querySelectorAll('.gift-rain .gift svg');
    expect(pieces.length).toBe(18);
    // Distinct viewBoxes prove more than one kind of art is in the mix.
    const shapes = new Set([...pieces].map((el) => el.getAttribute('viewBox')));
    expect(shapes.size).toBeGreaterThan(2);
  });
});
