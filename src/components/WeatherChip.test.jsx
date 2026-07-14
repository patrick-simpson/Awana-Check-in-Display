import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import WeatherChip from './WeatherChip.jsx';

describe('WeatherChip', () => {
  afterEach(cleanup);

  const reading = { temp: 72, apparent: 74, code: 2, isDay: true, units: 'fahrenheit' };

  it('shows the temperature with an accessible conditions label', () => {
    render(<WeatherChip weather={reading} />);
    const chip = screen.getByRole('status');
    expect(chip.getAttribute('aria-label')).toBe('72 degrees, Partly cloudy');
    expect(chip.textContent).toContain('72°');
    expect(chip.textContent).toContain('F');
  });

  it('uses the celsius unit letter when configured', () => {
    render(<WeatherChip weather={{ ...reading, temp: 22, units: 'celsius' }} />);
    expect(screen.getByRole('status').textContent).toContain('C');
  });

  it('renders nothing without a reading — no empty box on API outage', () => {
    const { container } = render(<WeatherChip weather={null} />);
    expect(container.firstChild).toBeNull();
  });
});
