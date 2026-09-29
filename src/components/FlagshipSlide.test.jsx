import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ZeroAnimationContext } from '../lib/motion.jsx';
import FlagshipSlide from './FlagshipSlide.jsx';
import { FLAGSHIP_CLUBS } from '../lib/flagship.js';

afterEach(cleanup);

function still(ui) {
  return render(<ZeroAnimationContext.Provider value>{ui}</ZeroAnimationContext.Provider>);
}

describe('FlagshipSlide', () => {
  it('reads as one image, "Tonight, welcome to Awana!", not as forty loose letters', () => {
    const { container } = still(<FlagshipSlide />);
    const root = container.querySelector('.flagship');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toMatch(/tonight, welcome to awana!/i);
    // Every letter is hidden from assistive tech; only the label speaks.
    for (const row of container.querySelectorAll('.flagship-row')) expect(row.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets both rows, letter by letter, in order', () => {
    const { container } = still(<FlagshipSlide />);
    const rows = [...container.querySelectorAll('.flagship-row')].map((r) => [...r.querySelectorAll('.flagship-letter')].map((l) => l.textContent).join(''));
    expect(rows).toEqual(['Welcome', 'toAwana!']);
  });

  it('parades one plate per club, each with its own colour and mark', () => {
    const { container } = still(<FlagshipSlide />);
    const plates = [...container.querySelectorAll('.flagship-plate')];
    expect(plates).toHaveLength(FLAGSHIP_CLUBS.length);
    const colours = plates.map((p) => p.style.getPropertyValue('--plate'));
    expect(new Set(colours).size).toBe(FLAGSHIP_CLUBS.length);
    for (const p of plates) expect(p.querySelector('img')).not.toBeNull();
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
