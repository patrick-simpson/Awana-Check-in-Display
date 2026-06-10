import { describe, it, expect } from 'vitest';
import { resolveTarget, formatRemaining } from './CountdownTimer.jsx';

describe('resolveTarget', () => {
  // A fixed reference point: today at 12:00 local time.
  const noon = new Date(2026, 5, 10, 12, 0, 0, 0).getTime();

  it('targets later today when the time has not passed yet', () => {
    const result = resolveTarget('18:30', noon);
    expect(result.isTomorrow).toBe(false);
    expect(new Date(result.ms).getHours()).toBe(18);
    expect(result.ms).toBeGreaterThan(noon);
  });

  it('rolls over to tomorrow when the time already passed', () => {
    const result = resolveTarget('08:00', noon);
    expect(result.isTomorrow).toBe(true);
    expect(result.ms).toBeGreaterThan(noon);
    expect(new Date(result.ms).getHours()).toBe(8);
  });

  it('rejects invalid input', () => {
    expect(resolveTarget('', noon)).toBeNull();
    expect(resolveTarget(null, noon)).toBeNull();
    expect(resolveTarget('25:00', noon)).toBeNull();
    expect(resolveTarget('12:75', noon)).toBeNull();
    expect(resolveTarget('soon', noon)).toBeNull();
  });
});

describe('formatRemaining', () => {
  it('formats minutes and seconds', () => {
    expect(formatRemaining(90_000)).toBe('01:30');
    expect(formatRemaining(0)).toBe('00:00');
  });

  it('includes hours when needed', () => {
    expect(formatRemaining(3_661_000)).toBe('1:01:01');
  });

  it('never goes negative', () => {
    expect(formatRemaining(-5000)).toBe('00:00');
  });
});
