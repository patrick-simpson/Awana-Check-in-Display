import { describe, expect, it } from 'vitest';
import { autoSkin, resolveSkin } from './skins.js';

describe('autoSkin', () => {
  it('maps each season to its skin', () => {
    expect(autoSkin(new Date(2026, 0, 14))).toBe('snowday');
    expect(autoSkin(new Date(2026, 3, 14))).toBe('spring');
    expect(autoSkin(new Date(2026, 6, 14))).toBe('summer');
    expect(autoSkin(new Date(2026, 8, 14))).toBe('autumn');
    expect(autoSkin(new Date(2026, 10, 14))).toBe('harvest');
    expect(autoSkin(new Date(2026, 11, 14))).toBe('christmas');
  });
});

describe('resolveSkin', () => {
  it('passes explicit skins through', () => {
    expect(resolveSkin('christmas')).toBe('christmas');
    expect(resolveSkin('none')).toBe('none');
  });

  it('resolves auto by date', () => {
    expect(resolveSkin('auto', new Date(2026, 11, 25))).toBe('christmas');
    expect(resolveSkin('auto', new Date(2026, 4, 1))).toBe('spring');
  });

  it('falls back to none on garbage', () => {
    expect(resolveSkin('neon')).toBe('none');
    expect(resolveSkin(undefined)).toBe('none');
  });
});
