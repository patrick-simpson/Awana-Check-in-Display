import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ZeroAnimationContext } from '../lib/motion.jsx';
import FlagshipSlide from './FlagshipSlide.jsx';

afterEach(cleanup);

function still(ui) {
  return render(<ZeroAnimationContext.Provider value>{ui}</ZeroAnimationContext.Provider>);
}

describe('FlagshipSlide', () => {
  it('reads as one image, "Welcome to Awana!", not as forty loose letters', () => {
    const { container } = still(<FlagshipSlide />);
    const root = container.querySelector('.flagship');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toMatch(/^welcome to awana!$/i);
    // Every letter is hidden from assistive tech; only the label speaks.
    for (const row of container.querySelectorAll('.flagship-row')) expect(row.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets both rows, letter by letter, in order', () => {
    const { container } = still(<FlagshipSlide />);
    const rows = [...container.querySelectorAll('.flagship-row')].map((r) => [...r.querySelectorAll('.flagship-letter')].map((l) => l.textContent).join(''));
    expect(rows).toEqual(['Welcome', 'toAwana!']);
  });

  it('has no club plates and no TONIGHT kicker', () => {
    const { container } = still(<FlagshipSlide />);
    expect(container.querySelector('.flagship-plate')).toBeNull();
    expect(container.querySelector('.flagship-kicker')).toBeNull();
    expect(container.textContent).not.toMatch(/tonight/i);
  });

  it('uses only M elements for motion: nothing here can animate under ?lowPower=1', () => {
    // src/lib/motionImports.test.js pins the import; this pins the rendered
    // result: under zero animation every letter is already at rest.
    const { container } = still(<FlagshipSlide />);
    for (const l of container.querySelectorAll('.flagship-letter')) {
      expect(l.style.opacity === '' || l.style.opacity === '1').toBe(true);
    }
  });
});
