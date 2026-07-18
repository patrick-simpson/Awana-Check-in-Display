import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Second lock on the privacy invariant (the first is the eslint
// no-restricted-imports rule): the ONLY file allowed to touch pusher-js
// is src/hooks/useSocket.js, where every event is bound through its
// strict allowlist sanitizer. Any other import would open a path for
// unsanitized payloads to reach the screen.

const SRC_ROOT = join(__dirname, '..');
const ALLOWED = ['hooks/useSocket.js'];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('privacy guard: pusher-js import surface', () => {
  it('only useSocket.js imports pusher-js', () => {
    const offenders = walk(SRC_ROOT)
      .filter((file) => /['"]pusher-js['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC_ROOT, file))
      .filter((rel) => !ALLOWED.includes(rel));
    expect(offenders).toEqual([]);
  });
});
