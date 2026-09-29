import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOST_CONTROL, hostClearancePx, isEmbedded } from './embed.js';

// Embedded in the Journey kiosk's iframe, Journey keeps its two buttons in one
// column in the bottom-right corner, and the signage keeps what it draws
// there out of it (src/lib/embed.js). The geometry is spelled twice, once
// there for the name fit and once in app.css for everything CSS lays out;
// this pins the two to each other and to Journey's buttons, that the
// top-right is left alone, and that none of it can reach a standalone screen.

const css = readFileSync(resolve(__dirname, '../styles/app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every { selector, body } rule in the sheet, @media blocks flattened. */
function rules(src) {
  const out = [];
  let i = 0;
  const walk = (end) => {
    while (i < end) {
      const open = src.indexOf('{', i);
      if (open < 0 || open >= end) return;
      const head = src.slice(i, open).replace(/^[\s\S]*;/, '').trim();
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') depth -= 1;
        j += 1;
      }
      if (head.startsWith('@media') || head.startsWith('@supports')) {
        i = open + 1;
        walk(j - 1);
      } else if (!head.startsWith('@')) {
        out.push({ selector: head.replace(/\s+/g, ' '), body: src.slice(open + 1, j - 1) });
      }
      i = j;
    }
  };
  walk(src.length);
  return out;
}
const ALL = rules(css);
const decl = (body, prop) => body.match(new RegExp(`(?:^|;)\\s*${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+)`))?.[1].replace(/\s+/g, ' ').trim();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isEmbedded', () => {
  it('is false for a page that is its own top window (jsdom, a TV, the projector)', () => {
    expect(isEmbedded()).toBe(false);
  });

  it('is true inside another page\'s frame', () => {
    vi.stubGlobal('top', { name: 'the Journey kiosk' });
    expect(isEmbedded()).toBe(true);
  });

  it('counts a browser that refuses to answer as framed', () => {
    const spy = vi.spyOn(window, 'top', 'get').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(isEmbedded()).toBe(true);
    spy.mockRestore();
  });
});

describe('hostClearancePx: Journey\'s corner column, plus the gap', () => {
  // Journey-Display public/src/style.css: #toggle-btn (and #settings-btn
  // stacked above it while this display shows) are 48px wide, right:
  // max(3vw, 24px).
  it.each([
    [640, 24 + 48 + 8],
    [592, 24 + 48 + 8],
    [1280, 38.4 + 48 + 8],
    [1920, 57.6 + 48 + 8],
  ])('at %i wide the host reaches %fpx in from the right edge', (vw, x) => {
    expect(hostClearancePx(vw)).toBeCloseTo(x, 6);
  });

  it('is Journey\'s geometry: 48px buttons, 3% of the width or 24px in, 8px of air', () => {
    expect(HOST_CONTROL).toEqual({ edgePct: 3, edgeMinPx: 24, sizePx: 48, gapPx: 8 });
  });
});

describe('app.css spells the same geometry, embedded only', () => {
  const root = ALL.find((r) => r.selector === 'html.embedded');
  const { edgePct, edgeMinPx, sizePx, gapPx } = HOST_CONTROL;

  it('defines the clearance from HOST_CONTROL', () => {
    expect(root).toBeTruthy();
    expect(decl(root.body, '--host-clear-x')).toBe(`calc(max(${edgePct}vw, ${edgeMinPx}px) + ${sizePx}px + ${gapPx}px)`);
  });

  // What steps LEFT out of the host's column: the bottom corner chip, the
  // ticker with it, and the check-in's name column.
  it.each([
    ['html.embedded .corner-bottom'],
    ['html.embedded .tonight-ticker'],
    ['html.embedded .checkin__copy'],
  ])('%s moves its right edge by the host\'s clearance', (selector) => {
    const rule = ALL.find((r) => r.selector === selector);
    expect(rule, selector).toBeTruthy();
    expect(decl(rule.body, 'right')).toContain('var(--host-clear-x)');
  });

  it('keeps the standalone insets as the floor, so embedding only ever moves chrome inward', () => {
    const bottom = decl(ALL.find((r) => r.selector === 'html.embedded .corner-bottom').body, 'right');
    expect(bottom).toBe(`max(${decl(ALL.find((r) => r.selector === '.corner-bottom').body, 'right')}, var(--host-clear-x))`);
    const copy = decl(ALL.find((r) => r.selector === 'html.embedded .checkin__copy').body, 'right');
    expect(copy).toBe(`max(${decl(ALL.find((r) => r.selector === '.checkin__copy').body, 'right')}, var(--host-clear-x))`);
  });

  // The top-right is this page's own: the band beside it and a raised
  // headline under it leave its stack no room to move, and Journey keeps
  // its buttons out of it (its test/corner-buttons.test.mjs).
  it('leaves the top-right stack alone', () => {
    const embedded = ALL.filter((r) => /html\.embedded/.test(r.selector));
    for (const r of embedded) expect(r.selector).not.toMatch(/corner-stack|corner-top|status-dot|sticker-chip/);
  });

  it('never reaches a standalone screen: every rule that reads the clearance is scoped to html.embedded', () => {
    const readers = ALL.filter((r) => /--host-clear-/.test(r.body));
    expect(readers.length).toBeGreaterThanOrEqual(4);
    for (const r of readers) {
      for (const sel of r.selector.split(',')) expect(sel.trim(), r.selector).toMatch(/^html\.embedded\b/);
    }
  });
});
