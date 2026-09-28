import { describe, expect, it } from 'vitest';
import { chipGeometry, measureEm, widestDigits } from './chip.js';
// Test-only reach into the lobby's copy: the projector may not import it at
// run time (the isolation rule), so this is what keeps the two stepped chips
// the same shape.
import { chipGeometry as lobbyChipGeometry } from '../../lib/brand.js';

describe('the projector\'s stepped chip', () => {
  it('has exactly the lobby chip\'s geometry', () => {
    for (const [l, v] of [[0, 0], [1.2, 2.5], [5.1, 1.1], [3.3, 9.8], [8, 4]]) {
      expect(chipGeometry(l, v)).toEqual(lobbyChipGeometry(l, v));
    }
  });

  it('widens with its value and always steps the value block out past the label', () => {
    const narrow = chipGeometry(3, 1);
    const wide = chipGeometry(3, 8);
    expect(wide.width).toBeGreaterThan(narrow.width);
    const pillEnd = Math.max(3 * 0.56 + 0.84, 2.2);
    expect(narrow.width - 0.2).toBeGreaterThanOrEqual(pillEnd + 0.5 - 1e-9);
  });

  it('measures without a canvas (tests) by a per-character estimate', () => {
    expect(measureEm('GAME ENDS')).toBeGreaterThan(measureEm('GAME'));
    expect(measureEm('6:30')).toBeCloseTo(0.64 * 3 + 0.3);
  });

  it('sizes a ticking value for its widest digits', () => {
    expect(widestDigits('41s')).toBe('00s');
    expect(widestDigits('6:30 PM')).toBe('0:00 PM');
  });
});
