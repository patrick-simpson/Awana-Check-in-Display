import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ZeroAnimationContext } from '../../lib/motion.jsx';
import PromoSlide, { detailsFor } from '../PromoSlide.jsx';
import { DETAILS } from './SnowAlertsPromo.jsx';
import { alertsQrPath } from '../../lib/alertsQr.js';

// No global test setup file in this repo, so RTL's automatic cleanup doesn't
// run: do it explicitly. Fake timers can't drive framer-motion, so these pin
// what is IN the DOM, not how it moves.
afterEach(cleanup);

const promo = (snow = null) => ({
  id: 'promo_snow_alerts', kind: 'snowAlerts', eventDate: snow ? snow.date : '',
  tonight: snow?.when === 'tonight', countdown: null, afterContest: true, durationSec: 20, snow,
});
const storm = (when = 'later') => promo({ date: '2026-12-02', when, weekday: 'Wednesday', inches: 3 });

const mount = (p, still = false) => render(
  <ZeroAnimationContext.Provider value={still}>
    <PromoSlide promo={p} />
  </ZeroAnimationContext.Provider>,
);
const text = (c, sel) => c.querySelector(sel)?.textContent;

describe('SnowAlertsPromo', () => {
  it('is the snow slide in the promo slot, in the lobby’s kit', () => {
    const { container } = mount(promo());
    const slide = container.querySelector('.promo-slide.promo-slide--snow.snow-alerts');
    expect(slide).not.toBeNull();
    expect(slide.classList.contains('snow-alerts--storm')).toBe(false);
  });

  it('says the ordinary-week pitch, with the address under the code', () => {
    const { container } = mount(promo());
    expect(text(container, '.snow-alerts__kicker')).toBe('Snow day?');
    expect(container.querySelector('.snow-alerts__headline').getAttribute('aria-label')).toBe('Know before you go.');
    expect([...container.querySelectorAll('.snow-alerts__word')].map((w) => w.textContent)).toEqual(['Know', 'before', 'you', 'go.']);
    expect(text(container, '.snow-alerts__body')).toBe('When snow cancels club, we send a text. Sign up once and it finds you.');
    expect(text(container, '.snow-alerts__scan-label')).toBe('Scan for the text');
    expect(text(container, '.snow-alerts__url')).toBe('kvbchurch.org/alerts');
  });

  it('names the night, in the storm colours, when snow is coming', () => {
    const { container } = mount(storm());
    expect(container.querySelector('.snow-alerts--storm')).not.toBeNull();
    expect(text(container, '.snow-alerts__kicker')).toBe('Snow in the forecast for Wednesday');
    expect(text(container, '.snow-alerts__body')).toBe('If snow cancels club, we’ll text you. Not signed up yet? Scan now. It takes a minute.');
    cleanup();
    expect(text(mount(storm('tonight')).container, '.snow-alerts__kicker')).toBe('Snow in the forecast tonight');
  });

  it('draws the real QR code for the sign-up', () => {
    const { container } = mount(promo());
    const qr = container.querySelector('svg.snow-alerts__qr');
    expect(qr.getAttribute('aria-label')).toBe('QR code for kvbchurch.org/alerts');
    expect(qr.querySelector('path').getAttribute('d')).toBe(alertsQrPath().d);
    // A quiet zone round the code, on white, so a phone can find its edges.
    expect(qr.getAttribute('viewBox')).toBe(`-2 -2 ${alertsQrPath().size + 4} ${alertsQrPath().size + 4}`);
  });

  it('marks the text on the phone as an example, so a snow week never reads it as news', () => {
    for (const p of [promo(), storm('tonight')]) {
      const { container } = mount(p);
      expect(text(container, '.snow-alerts__tag')).toBe('Example text');
      expect(text(container, '.snow-alerts__note-title')).toBe('Snow day: no Awana tonight');
      // The lock screen names a weekday, never a real date.
      expect(text(container, '.snow-alerts__day')).toBe('Wednesday');
      cleanup();
    }
  });

  it('reads as one image to a screen reader, with every fact in its label', () => {
    const { container } = mount(storm());
    const label = container.querySelector('.snow-alerts').getAttribute('aria-label');
    expect(label).toContain('Snow in the forecast for Wednesday');
    expect(label).toContain('Know before you go.');
    expect(label).toContain('kvbchurch.org/alerts');
  });

  it('renders the same finished card under zero animation', () => {
    const { container } = mount(promo(), true);
    expect(text(container, '.snow-alerts__kicker')).toBe('Snow day?');
    expect(container.querySelector('svg.snow-alerts__qr')).not.toBeNull();
    expect(text(container, '.snow-alerts__url')).toBe('kvbchurch.org/alerts');
    expect(container.querySelectorAll('.snow-alerts__snow')).toHaveLength(3);
  });

  it('gives PromoSlide its detail table', () => {
    expect(detailsFor(promo())).toBe(DETAILS.default);
    expect(DETAILS.default).toEqual(['When snow cancels club, we send a text. Sign up once and it finds you.']);
  });

  it('never uses an em dash or a straight apostrophe on screen', () => {
    for (const p of [promo(), storm(), storm('tomorrow'), storm('tonight')]) {
      const { container } = mount(p);
      const all = `${container.textContent} ${container.querySelector('.snow-alerts').getAttribute('aria-label')}`;
      expect(all).not.toContain('—');
      expect(all).not.toContain("'");
      cleanup();
    }
  });
});
