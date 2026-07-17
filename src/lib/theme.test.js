import { describe, expect, it } from 'vitest';
import { sanitizeTheme } from './theme.js';

const BASE = 'https://patrick-simpson.github.io/KVBC-Awana-Countdown/shared/theme.json';

// The real shared/theme.json shape from the countdown repo.
const SHARED = {
  version: 1,
  clubs: {
    tnt: {
      name: 'T&T',
      color: '#00A651',
      aliases: ['t&t', 'truth and training'],
      art: { logo: 'art/tnt-logo.png' },
    },
    sparks: { name: 'Sparks', color: '#E8192C', aliases: ['spark'], art: {} },
  },
};

describe('sanitizeTheme', () => {
  it('parses the shared theme into per-club overrides', () => {
    const t = sanitizeTheme(SHARED, BASE);
    expect(t.tnt.primary).toBe('#00A651');
    expect(t.tnt.logoUrl).toBe('https://patrick-simpson.github.io/KVBC-Awana-Countdown/shared/art/tnt-logo.png');
    expect(t.tnt.aliases).toContain('t&t');
    expect(t.tnt.deep).toMatch(/^#[0-9a-f]{6}$/);
    expect(t.tnt.confetti).toHaveLength(3);
    expect(t.sparks.logoUrl).toBeUndefined();
  });

  it('drops clubs with bad colors and rejects junk payloads', () => {
    expect(sanitizeTheme(null, BASE)).toBeNull();
    expect(sanitizeTheme({ clubs: 'nope' }, BASE)).toBeNull();
    const t = sanitizeTheme({ clubs: { sparks: { color: 'red' }, tnt: { color: '#00A651' } } }, BASE);
    expect(t.sparks).toBeUndefined();
    expect(t.tnt).toBeDefined();
  });

  it('refuses path-traversal and non-http art URLs', () => {
    const t = sanitizeTheme({
      clubs: {
        tnt: { color: '#00A651', art: { logo: '../../evil.png' } },
        sparks: { color: '#E8192C', art: { logo: 'javascript:alert(1)' } },
      },
    }, BASE);
    expect(t.tnt.logoUrl).toBeUndefined();
    expect(t.sparks.logoUrl).toBeUndefined();
  });
});
