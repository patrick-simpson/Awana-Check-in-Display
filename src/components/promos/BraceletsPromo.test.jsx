import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ZeroAnimationContext } from '../../lib/motion.jsx';
import PromoSlide, { detailsFor } from '../PromoSlide.jsx';
import BraceletsPromo, { BEADS, BRACELET_SHAKE, DETAILS, floodRadius, posterDate } from './BraceletsPromo.jsx';

// No global test setup file in this repo, so RTL's automatic cleanup
// doesn't run: do it explicitly. Fake timers can't drive framer-motion
// (its frame loop captured the real requestAnimationFrame at import), so
// these pin what is IN the DOM, not how it moves.
afterEach(cleanup);

const promo = (extra = {}) => ({
  id: 'promo_bracelets',
  kind: 'bracelets',
  eventDate: '2026-09-30',
  tonight: false,
  countdown: 'Next club night',
  afterContest: false,
  durationSec: 15,
  ...extra,
});

const mount = (p, still = false) => render(
  <ZeroAnimationContext.Provider value={still}>
    <PromoSlide promo={p} />
  </ZeroAnimationContext.Provider>,
);

const headline = (c) => c.querySelector('.promo-brc-headline').getAttribute('aria-label');

describe('BraceletsPromo', () => {
  it('keeps its detail copy exactly, ending on the poster’s own subline', () => {
    expect(DETAILS).toEqual({
      default: ['Salvation bracelets for Ugandan school kids'],
      tonight: ['Made at club tonight', 'Salvation bracelets for Ugandan school kids'],
    });
    for (const lines of Object.values(DETAILS)) expect(Object.isFrozen(lines)).toBe(true);
    expect(Object.isFrozen(DETAILS)).toBe(true);
  });

  it('tells the six truths in gospel order, in the kit’s own words', () => {
    expect(BEADS.map((b) => b.word)).toEqual(['SIN', 'BLOOD', 'PURITY', 'BAPTISM', 'GROWTH', 'HEAVEN']);
    const { container } = mount(promo());
    expect([...container.querySelectorAll('.promo-brc-word')].map((w) => w.textContent))
      .toEqual(['SIN', 'BLOOD', 'PURITY', 'BAPTISM', 'GROWTH', 'HEAVEN']);
    // One bead per truth on the cord, and the two clear sliders at the knot.
    expect(container.querySelectorAll('.promo-brc-bead')).toHaveLength(6);
    expect(container.querySelectorAll('.promo-brc-slider')).toHaveLength(2);
  });

  it('says only the poster’s subline on an ordinary night, from its first frame', () => {
    const { container } = mount(promo());
    expect(container.querySelector('.promo-detail').textContent).toBe('Salvation bracelets for Ugandan school kids');
    expect(container.textContent).not.toContain('Six beads');
  });

  it('ends on the printed poster: headline, subline and date', () => {
    const { container } = mount(promo(), true);
    expect(container.querySelector('.promo-slide.promo-slide--bracelets')).not.toBeNull();
    expect(headline(container)).toBe('We’re making BRACELETS for kids in Uganda');
    expect(container.querySelector('.promo-brc-for').textContent).toBe('FOR KIDS IN UGANDA');
    expect(container.querySelector('.promo-brc-date-text').textContent).toBe('WED, SEPT 30');
    expect(container.querySelector('.promo-chip').textContent).toBe('This week');
    // The frozen frame is already on the last line: the poster's subline.
    expect(container.querySelector('.promo-detail').textContent).toBe('Salvation bracelets for Ugandan school kids');
  });

  it('says Tonight! on the night and keeps every other fact', () => {
    const { container } = mount(promo({ tonight: true, countdown: 'Tonight!' }), true);
    expect(container.querySelector('.promo-chip').textContent).toBe('Tonight!');
    expect(container.querySelector('.promo-brc-date-text').textContent).toBe('WED, SEPT 30');
    expect(headline(container)).toBe('We’re making BRACELETS for kids in Uganda');
    expect(detailsFor(promo({ tonight: true }))).toBe(DETAILS.tonight);
    expect(detailsFor(promo())).toBe(DETAILS.default);
  });

  // framer-motion places an SVG element only after measuring it on the next
  // frame, so the frozen card sets the bracelet's resting pose as a plain
  // attribute: its very first frame is already the finished bracelet.
  it('sits every bead and slider at rest from the first frame under zero animation', () => {
    const { container } = mount(promo(), true);
    const beads = [...container.querySelectorAll('g.promo-brc-bead')];
    expect(beads).toHaveLength(6);
    for (const g of beads) expect(g.getAttribute('transform')).toMatch(/^translate\(\d+(\.\d)? \d+(\.\d)?\) rotate\(-?\d+(\.\d)?\) scale\(0\.52\)$/);
    const xs = beads.map((g) => Number(/translate\(([\d.]+)/.exec(g.getAttribute('transform'))[1]));
    // Left to right along the loop, in gospel order.
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const sliders = [...container.querySelectorAll('.promo-brc-slider')].map((r) => r.parentElement.getAttribute('transform'));
    expect(sliders).toEqual(['translate(1198 492) rotate(14) scale(0.46)', 'translate(1252 492) rotate(-14) scale(0.46)']);
  });

  it('draws the journey: Waterville, Maine, the flight line and Uganda', () => {
    const { container } = mount(promo());
    const labels = [...container.querySelectorAll('.promo-brc-map-label')].map((t) => t.textContent);
    expect(labels).toEqual(['WATERVILLE, ME', 'UGANDA']);
    const outlines = [...container.querySelectorAll('.promo-brc-country-line')].map((p) => p.getAttribute('d'));
    // Maine, then Uganda.
    expect(outlines).toHaveLength(2);
    for (const d of outlines) {
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith('z')).toBe(true);
      expect(d).not.toContain('NaN');
    }
  });

  it('renders exactly one detail slot and one chip, on the shared depth layers', () => {
    const { container } = mount(promo());
    expect(container.querySelectorAll('.promo-detail-slot')).toHaveLength(1);
    expect(container.querySelectorAll('.promo-chip')).toHaveLength(1);
    expect(container.querySelector('.promo-texture')).not.toBeNull();
    expect(container.querySelector('.promo-vignette')).not.toBeNull();
  });

  it('prints the white knockout of the Awana Clubs mark, as the poster does', () => {
    const { container } = mount(promo());
    expect(container.querySelector('.promo-wordmark').getAttribute('src'))
      .toMatch(/shared\/brand\/logos\/awana-clubs-white\.svg$/);
  });

  // A fast wipe to 150% swept the whole frame in about 0.1 s: a full-screen
  // flash every bead (reported as strobing). Each circle now grows only to
  // just past the farthest corner, on 16:9 and 4:3 alike.
  it('sizes each colour wipe to just cover the screen, never far past it', () => {
    for (const [x, y] of [[0.28, 0.7], [0.5, 0.7], [0.72, 0.7], [0.75, 0.54]]) {
      const r = floodRadius(x, y) / 100;
      for (const ratio of [16 / 9, 4 / 3]) {
        const ref = Math.sqrt((ratio * ratio + 1) / 2);
        for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          expect(r * ref).toBeGreaterThanOrEqual(Math.hypot((cx - x) * ratio, cy - y));
        }
      }
      expect(r).toBeLessThan(1.3);
    }
    const { container } = mount(promo());
    for (const el of container.querySelectorAll('.promo-brc-flood')) {
      expect(el.style.clipPath || '').not.toContain('150%');
    }
  });

  it('shakes the frame only for the SIN thud and the knot, not every bead', () => {
    // Two beats of buildShake: five offsets each, plus the start and the end.
    expect(BRACELET_SHAKE.times).toHaveLength(2 * 5 + 2);
  });

  it('formats the poster date the way the poster prints it', () => {
    expect(posterDate('2026-09-30')).toBe('WED, SEPT 30');
    expect(posterDate('2026-10-14')).toBe('WED, OCT 14');
    expect(posterDate('')).toBe('');
    expect(posterDate('tomorrow')).toBe('');
    expect(posterDate(undefined)).toBe('');
  });

  it('never uses an em dash or a straight apostrophe', () => {
    for (const extra of [{}, { tonight: true }]) {
      const p = promo(extra);
      const { container } = render(<BraceletsPromo promo={p} lines={detailsFor(p)} />);
      const all = `${container.textContent} ${headline(container)} ${detailsFor(p).join(' ')}`;
      expect(all).not.toContain('—');
      expect(all).not.toContain("'");
      cleanup();
    }
  });
});
