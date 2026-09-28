import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ZeroAnimationContext } from '../lib/motion.jsx';
import SlideCopy from './SlideCopy.jsx';

afterEach(cleanup);

const FRAME = { kicker: 'Next club night', headline: 'Making Bracelets', sub: 'Bring a friend', chip: { label: 'WED', value: 'SEP 30' }, textSize: 'auto' };
const pieces = (c) => [...c.querySelectorAll('.lobby-kicker, .lobby-word, .lobby-sub, .lobby-chip')];
const atRest = (el) => (el.style.opacity === '' || el.style.opacity === '1') && (el.style.transform === '' || el.style.transform === 'none');

describe('SlideCopy', () => {
  it('sets the kicker, the headline word by word, the supporting line and the chip', () => {
    const { container } = render(<SlideCopy frame={FRAME} still />);
    expect(container.querySelector('.lobby-kicker').textContent).toBe('Next club night');
    expect([...container.querySelectorAll('.lobby-word')].map((w) => w.textContent)).toEqual(['Making', 'Bracelets']);
    // The line break is a <br>, and the words still read as one sentence.
    expect(container.querySelector('.lobby-headline').textContent).toBe('Making Bracelets');
    expect(container.querySelector('.lobby-headline br')).not.toBeNull();
    expect(container.querySelector('.lobby-sub').textContent).toBe('Bring a friend');
    expect(container.querySelector('.lobby-chip [role="img"]').getAttribute('aria-label')).toBe('WED SEP 30');
  });

  it('only a slide carries the typed-slide class names', () => {
    const { container, rerender } = render(<SlideCopy frame={FRAME} still />);
    expect(container.querySelector('.manual-slide-text')).toBeNull();
    rerender(<SlideCopy frame={FRAME} still slide sizeClass="slide-size-lg" />);
    expect(container.querySelector('.manual-slide-text.slide-size-lg')).not.toBeNull();
    expect(container.querySelector('.manual-slide-eyebrow')).not.toBeNull();
    expect(container.querySelector('.manual-slide-subtext')).not.toBeNull();
  });

  it('a still copy (the editor\'s thumbnails) is plain elements at rest', () => {
    const { container } = render(<SlideCopy frame={FRAME} still />);
    for (const el of pieces(container)) expect(atRest(el)).toBe(true);
  });

  it('carries its own theme\'s colours, so it never repaints mid-exit', () => {
    const { container } = render(<SlideCopy frame={FRAME} theme="night" still />);
    const copy = container.querySelector('.lobby-copy');
    expect(copy.style.getPropertyValue('--lobby-shadow')).toBe('#1B2D5C');
    expect(copy.style.getPropertyValue('--lobby-kicker')).toBe('var(--brand-sun)');
  });

  it('a live copy mounts with every piece hidden, waiting for its beat', () => {
    const { container } = render(<SlideCopy frame={FRAME} via="handoff" />);
    const all = pieces(container);
    expect(all).toHaveLength(5);
    for (const el of all) expect(el.style.opacity).toBe('0');
  });

  it('under zero animation every piece is already landed', async () => {
    const { container } = render(
      <ZeroAnimationContext.Provider value>
        <SlideCopy frame={FRAME} via="wipe" />
      </ZeroAnimationContext.Provider>,
    );
    await waitFor(() => { for (const el of pieces(container)) expect(atRest(el)).toBe(true); }, { timeout: 150 });
  });

  it('a long announcement reads instead of shouting, one element per word, rows split by <br>', () => {
    const text = 'Parents, please remember that pick-up is at the gym doors this week while the lobby floor is refinished.';
    const { container } = render(<SlideCopy frame={{ ...FRAME, headline: text, chip: null, sub: '' }} still />);
    const headline = container.querySelector('.lobby-headline--read');
    expect(headline).not.toBeNull();
    expect(headline.textContent).toBe(text);
    expect(headline.querySelectorAll('.lobby-word')).toHaveLength(text.split(' ').length);
    expect(headline.querySelectorAll('br').length).toBeGreaterThan(0);
  });

  it('sets its own direction from its text, so a Hebrew headline\'s words run right to left', () => {
    const { container } = render(<SlideCopy frame={{ ...FRAME, kicker: 'השבוע', headline: 'ברוכים הבאים לאוואנה' }} still />);
    for (const sel of ['.lobby-kicker', '.lobby-headline', '.lobby-sub']) expect(container.querySelector(sel).getAttribute('dir')).toBe('auto');
  });

  it('joins the words of a sentence with no spaces with nothing', () => {
    const text = '欢迎来到今晚的俱乐部活动请带上你的手册和圣经';
    const { container } = render(<SlideCopy frame={{ ...FRAME, headline: text, sub: '', chip: null }} still />);
    const headline = container.querySelector('.lobby-headline');
    expect(headline.textContent).toBe(text);
    expect(headline.querySelectorAll('.lobby-word').length).toBeGreaterThan(3);
  });

  it('a word too wide for any line wraps inside the read layout\'s width, on rows of its own', () => {
    const url = 'https://kvbc.example.org/awana/registration/2026-27/fall-family-sign-up-form?ref=lobby-tv&utm_source=signage&utm_campaign=fall-welcome-26';
    const { container } = render(<SlideCopy frame={{ ...FRAME, kicker: '', headline: `Register at ${url} tonight`, sub: '', chip: null }} still />);
    const wide = container.querySelector('.lobby-word--wide');
    expect(wide.textContent).toBe(url);
    expect(wide.style.maxWidth).toBe('calc(76 * var(--u))');
    // It is a block of its own, so no <br> sits beside it to add an empty row.
    expect(wide.previousElementSibling?.tagName).not.toBe('BR');
    expect(wide.nextElementSibling?.tagName).not.toBe('BR');
    expect(container.querySelector('.lobby-headline').textContent).toBe(`Register at ${url} tonight`);
  });

  it('a long kicker wraps to two lines instead of running off the screen', () => {
    const { container } = render(<SlideCopy frame={{ ...FRAME, kicker: '通'.repeat(60) }} still />);
    const kicker = container.querySelector('.lobby-kicker');
    expect(kicker.querySelectorAll('br')).toHaveLength(1);
    expect(kicker.textContent).toBe('通'.repeat(60));
  });
});
