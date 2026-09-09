import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import CatalogScene from './CatalogScene.jsx';

const scene = (container) => container.querySelector('.catalog-scene');
const tint = (container) => container.querySelector('.scene-club-tint');

describe('CatalogScene club tint (#349)', () => {
  afterEach(cleanup);

  it('renders no tint by default, so an untouched install looks unchanged', () => {
    const { container } = render(<CatalogScene theme="sky" still />);
    expect(scene(container).classList.contains('catalog-scene--club-tinted')).toBe(false);
    expect(scene(container).style.getPropertyValue('--club-tint')).toBe('');
    // The layer is still MOUNTED — it is what the fade animates, so it cannot
    // appear and disappear with the tint itself.
    expect(tint(container)).not.toBeNull();
  });

  it('sets the club colour as a custom property while the banner is up', () => {
    const { container } = render(<CatalogScene theme="sky" still clubTint="#AEC4F2" />);
    expect(scene(container).classList.contains('catalog-scene--club-tinted')).toBe(true);
    expect(scene(container).style.getPropertyValue('--club-tint')).toBe('#AEC4F2');
  });

  it('clears the tint when the banner leaves but KEEPS the colour to fade out to', () => {
    const { container, rerender } = render(<CatalogScene theme="sky" still clubTint="#AEC4F2" />);
    rerender(<CatalogScene theme="sky" still clubTint={null} />);
    // The class is what carries the opacity, so dropping it is what fades out…
    expect(scene(container).classList.contains('catalog-scene--club-tinted')).toBe(false);
    // …and the colour has to outlive it, or the layer would snap to
    // transparent and there would be nothing to fade.
    expect(scene(container).style.getPropertyValue('--club-tint')).toBe('#AEC4F2');
  });

  it('swaps to the next club\'s colour on a back-to-back arrival', () => {
    const { container, rerender } = render(<CatalogScene theme="sky" still clubTint="#AEC4F2" />);
    rerender(<CatalogScene theme="sky" still clubTint="#FFC9C4" />);
    expect(scene(container).style.getPropertyValue('--club-tint')).toBe('#FFC9C4');
    expect(scene(container).classList.contains('catalog-scene--club-tinted')).toBe(true);
  });

  it('leaves the scene\'s own theme and dimming alone', () => {
    const { container } = render(<CatalogScene theme="night" still cozy dim={0.8} clubTint="#AEC4F2" />);
    const el = scene(container);
    expect(el.classList.contains('catalog-scene--night')).toBe(true);
    expect(el.classList.contains('catalog-scene--cozy')).toBe(true);
    expect(el.style.getPropertyValue('--scene-dim')).toBe('0.8');
  });

  it('paints the wash under the scene\'s children, so slide copy stays crisp', () => {
    const { container } = render(
      <CatalogScene theme="sky" still clubTint="#AEC4F2">
        <p className="manual-slide-text">Welcome!</p>
      </CatalogScene>
    );
    const kids = [...scene(container).children];
    expect(kids.indexOf(tint(container)))
      .toBeLessThan(kids.findIndex((n) => n.querySelector?.('.manual-slide-text') || n.classList.contains('manual-slide-text')));
  });
});
