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
});
