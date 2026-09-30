import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { StepArt, smoothPath } from './StepArt.jsx';
import { sceneFor } from '../../lib/braceletArt.js';

afterEach(cleanup);

const svgOf = (container) => container.querySelector('svg');

describe('StepArt', () => {
  it('renders every step as one decorative svg on the 1460x560 stage', () => {
    for (let step = 0; step < 13; step += 1) {
      for (const p of [0, 0.5, 1]) {
        const { container, unmount } = render(<StepArt step={step} p={p} />);
        const svg = svgOf(container);
        expect(svg, `step ${step + 1}`).not.toBeNull();
        expect(svg.getAttribute('viewBox')).toBe('0 0 1460 560');
        expect(svg.getAttribute('role')).toBe('img');
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.querySelectorAll('path, rect, circle, ellipse').length).toBeGreaterThan(10);
        expect(container.innerHTML).not.toMatch(/NaN|undefined/);
        unmount();
      }
    }
  });

  it('renders the intro and the finale too', () => {
    const intro = render(<StepArt step="intro" p={1} />);
    expect(intro.container.textContent).toContain('BRACELET TIME!');
    intro.unmount();
    const finale = render(<StepArt step="finale" p={1} />);
    expect(finale.container.textContent).toContain('YOUR');
    expect(finale.container.textContent).toContain('TURN!');
  });

  it('moves the whole picture by the camera, and by nothing without one', () => {
    const plain = render(<StepArt step={3} p={1} />);
    expect(svgOf(plain.container).querySelector(':scope > g').getAttribute('transform')).toBe('translate(0 0) scale(1)');
    plain.unmount();
    const { container } = render(<StepArt step={3} p={1} camera={{ x: -120, y: -40, scale: 1.2 }} className="pj-bracelet-art" />);
    const svg = svgOf(container);
    expect(svg.querySelector(':scope > g').getAttribute('transform')).toBe('translate(-120 -40) scale(1.2)');
    expect(svg.getAttribute('class')).toBe('pj-bracelet-art');
  });

  it('draws one element group per display-list item', () => {
    const items = sceneFor(6, 1);
    const { container } = render(<StepArt step={6} p={1} />);
    expect(svgOf(container).querySelector(':scope > g').children).toHaveLength(items.length);
  });

  it('gives each picture its own gradient ids, so two on one page never share', () => {
    const { container } = render(<><StepArt step={0} p={1} /><StepArt step={1} p={1} /></>);
    const [a, b] = container.querySelectorAll('svg');
    const idA = a.querySelector('linearGradient').id;
    const idB = b.querySelector('linearGradient').id;
    expect(idA).not.toBe(idB);
    expect(a.innerHTML).toContain(`url(#${idA})`.replace(/-[a-z]+\)$/, ''));
    expect(b.innerHTML).not.toContain(`url(#${idA}`);
  });

  it('never uses filters, masks or clip paths (modest projector laptops)', () => {
    for (const step of [0, 6, 8, 12, 'intro', 'finale']) {
      const { container, unmount } = render(<StepArt step={step} p={0.7} />);
      expect(container.querySelector('filter, mask, clipPath, [filter], [mask], [clip-path]')).toBeNull();
      unmount();
    }
  });
});

describe('smoothPath', () => {
  it('draws a straight segment for two points and curves through more', () => {
    expect(smoothPath([[0, 0], [10, 0]])).toBe('M0 0 L10 0');
    const d = smoothPath([[0, 0], [10, 10], [20, 0]]);
    expect(d.startsWith('M0 0 C')).toBe(true);
    expect(d.endsWith('20 0')).toBe(true);
    expect(smoothPath([])).toBe('');
  });
});
