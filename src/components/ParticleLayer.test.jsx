import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import ParticleLayer from './ParticleLayer.jsx';

describe('ParticleLayer', () => {
  afterEach(() => cleanup());

  it.each(['snow', 'rain', 'sparkle'])('renders a %s field of particles', (effect) => {
    const { container } = render(<ParticleLayer effect={effect} />);
    const layer = container.querySelector(`.particle-layer.particle-${effect}`);
    expect(layer).toBeTruthy();
    expect(layer.querySelectorAll('.particle').length).toBeGreaterThan(20);
    // Decoration only: hidden from the accessibility tree.
    expect(layer.getAttribute('aria-hidden')).not.toBeNull();
  });

  it('renders nothing for off or unknown effects', () => {
    expect(render(<ParticleLayer effect="off" />).container.innerHTML).toBe('');
    cleanup();
    expect(render(<ParticleLayer effect="lava" />).container.innerHTML).toBe('');
  });

  it('is deterministic: two renders produce identical particles', () => {
    const a = render(<ParticleLayer effect="snow" />).container.innerHTML;
    cleanup();
    const b = render(<ParticleLayer effect="snow" />).container.innerHTML;
    expect(a).toBe(b);
  });

  it('only sparkles carry a glyph; snow and rain are pure shapes', () => {
    const sparkle = render(<ParticleLayer effect="sparkle" />).container;
    expect(sparkle.querySelector('.particle').textContent).toBe('✦');
    cleanup();
    const snow = render(<ParticleLayer effect="snow" />).container;
    expect(snow.querySelector('.particle').textContent).toBe('');
  });
});
