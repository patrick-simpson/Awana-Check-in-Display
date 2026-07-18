import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { DUR, EASE } from './motion-tokens.js';

// Drift guard in the same spirit as the club-color check in
// shared-config.test.js: the CSS custom properties in index.css and
// their JS mirror in motion-tokens.js must stay byte-for-value equal.
// Editing one side without the other fails here.

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

/** All --dur-* DECLARATIONS (name: value) — var(--dur-*) usages don't match. */
function cssDurations() {
  const out = new Map();
  for (const m of css.matchAll(/--dur-([a-z0-9-]+)\s*:\s*([0-9.]+)\s*(ms|s)\b/g)) {
    const seconds = m[3] === 'ms' ? Number(m[2]) / 1000 : Number(m[2]);
    out.set(m[1], seconds);
  }
  return out;
}

/** All --ease-* declarations as cubic-bezier control-point arrays. */
function cssEasings() {
  const out = new Map();
  for (const m of css.matchAll(/--ease-([a-z0-9-]+)\s*:\s*cubic-bezier\(([^)]*)\)/g)) {
    out.set(m[1], m[2].split(',').map((n) => Number(n.trim())));
  }
  return out;
}

describe('motion token parity (index.css ↔ motion-tokens.js)', () => {
  it('found the CSS declarations at all (regex canary)', () => {
    expect(cssDurations().size).toBeGreaterThan(0);
    expect(cssEasings().size).toBeGreaterThan(0);
  });

  it('declares exactly the same --dur-* names as DUR exports', () => {
    expect([...cssDurations().keys()].sort()).toEqual(Object.keys(DUR).sort());
  });

  it('every --dur-* value equals its DUR mirror (seconds)', () => {
    for (const [name, seconds] of cssDurations()) {
      expect(DUR[name], `--dur-${name} vs DUR.${name}`).toBeCloseTo(seconds, 10);
    }
  });

  it('declares exactly the same --ease-* names as EASE exports', () => {
    expect([...cssEasings().keys()].sort()).toEqual(Object.keys(EASE).sort());
  });

  it('every --ease-* cubic-bezier matches its EASE mirror', () => {
    for (const [name, points] of cssEasings()) {
      expect(points, `--ease-${name} malformed in CSS`).toHaveLength(4);
      expect(EASE[name], `--ease-${name} vs EASE.${name}`).toEqual(points);
    }
  });
});
