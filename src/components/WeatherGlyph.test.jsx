import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { ZeroAnimationContext } from '../lib/motion.jsx';
import WeatherGlyph, { WEATHER_GLYPHS } from './WeatherGlyph.jsx';
import CornerChip from './CornerChip.jsx';
import { weatherPresentation } from '../lib/weather.js';

afterEach(cleanup);
const zero = (ui) => render(<ZeroAnimationContext.Provider value>{ui}</ZeroAnimationContext.Provider>);

describe('WeatherGlyph', () => {
  it('draws every icon weatherPresentation can name', () => {
    const icons = new Set();
    for (let code = 0; code <= 99; code++) {
      icons.add(weatherPresentation(code, true).icon);
      icons.add(weatherPresentation(code, false).icon);
    }
    for (const icon of icons) expect(WEATHER_GLYPHS).toContain(icon);
  });

  it('is decorative, and falls back to the plain cloud', () => {
    const { container } = render(<WeatherGlyph kind="rain" />);
    const svg = container.querySelector('svg.weather-glyph');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.dataset.glyph).toBe('rain');
    cleanup();
    const other = render(<WeatherGlyph kind="volcano" />).container;
    expect(other.querySelector('svg').dataset.glyph).toBe('cloud');
  });

  it.each(WEATHER_GLYPHS)('under zero animation, the %s glyph rests whole at once', async (kind) => {
    const { container } = zero(<WeatherGlyph kind={kind} />);
    // Every loop's last keyframe is the finished glyph: fully drawn, in place.
    await waitFor(() => {
      for (const el of container.querySelectorAll('g, path')) {
        const opacity = el.style.opacity === '' ? 1 : Number(el.style.opacity);
        expect(opacity).toBe(1);
      }
    }, { timeout: 150 });
  });

  it('rides the weather chip, and only the weather chip', () => {
    const weather = { id: 'weather', label: 'Rain', value: '50°', spoken: '50 degrees, Rain', corner: 'top', glyph: 'rain' };
    const { container } = zero(<CornerChip item={weather} corner="top" loads={1} />);
    expect(container.querySelector('.step-chip__icon .weather-glyph[data-glyph="rain"]')).not.toBeNull();
    // The chip's name stays the words; the doodle is decoration.
    expect(container.querySelector('.step-chip').getAttribute('aria-label')).toBe('RAIN 50°');
    cleanup();
    const clock = { id: 'clock', label: 'Right now', value: '7:56', spoken: 'The time is 7:56 PM', corner: 'bottom' };
    expect(zero(<CornerChip item={clock} corner="bottom" loads={1} />).container.querySelector('.weather-glyph')).toBeNull();
  });
});
