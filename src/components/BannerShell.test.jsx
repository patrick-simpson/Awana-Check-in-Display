import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import BannerShell, { Eyebrow } from './BannerShell.jsx';

describe('BannerShell', () => {
  afterEach(cleanup);

  it('renders the shared band scaffold around the content', () => {
    const { container } = render(
      <BannerShell className="first-timer">
        <h1>Sam!</h1>
      </BannerShell>
    );
    const banner = container.querySelector('.banner');
    expect(banner).not.toBeNull();
    expect(banner.classList.contains('first-timer')).toBe(true);
    // The full decorative scaffold every variant used to copy-paste:
    expect(container.querySelector('.banner-wave')).not.toBeNull();
    expect(container.querySelector('.band-blob')).not.toBeNull();
    expect(container.querySelector('.band-sparkles')).not.toBeNull();
    expect(container.querySelector('.doodle-field')).not.toBeNull();
    expect(container.querySelector('.banner-content').textContent).toBe('Sam!');
  });

  it('applies inline style vars (club palette) to the band', () => {
    const { container } = render(
      <BannerShell style={{ '--club-primary': 'rgb(1, 2, 3)' }}>x</BannerShell>
    );
    expect(container.querySelector('.banner').style.getPropertyValue('--club-primary')).toBe('rgb(1, 2, 3)');
  });

  it('renders decorations against the band, outside the content box', () => {
    const { container } = render(
      <BannerShell decorations={<div className="test-burst" />}>x</BannerShell>
    );
    const burst = container.querySelector('.test-burst');
    expect(burst).not.toBeNull();
    expect(burst.closest('.banner')).not.toBeNull();
    expect(burst.closest('.banner-content')).toBeNull();
  });

  it('Eyebrow renders its text for the condensed line', () => {
    const { container } = render(
      <BannerShell>
        <Eyebrow>Happy Birthday</Eyebrow>
      </BannerShell>
    );
    const eyebrow = container.querySelector('.eyebrow');
    expect(eyebrow.textContent).toBe('Happy Birthday');
  });
});
