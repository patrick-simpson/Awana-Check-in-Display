import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ?lowPower=1 means ZERO animation (CLAUDE.md). Plain CSS is stopped by one
// blanket rule on `.zero-animation-mode`, deliberately a blanket rule so a
// future animation is covered with nothing to remember. But `*` matches
// ELEMENTS only, and neither `animation` nor `transition` is inherited, so a
// transition declared on a pseudo-element (the panels' kit checkbox pops its
// check on a ::before) kept playing on the Pi. This pins the blanket rule and
// fails any rule that animates a pseudo-element the blanket rule does not name.

const css = readFileSync(resolve(__dirname, '../styles/app.css'), 'utf8');

/**
 * Flatten a stylesheet into { selector, body } rules, descending into
 * @media / @supports / @container blocks and skipping @keyframes and the
 * like. Comments are stripped first; declarations never contain braces.
 * @param {string} text
 */
function rules(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  /** @type {Array<{ selector: string, body: string }>} */
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
      const close = j - 1;
      if (head.startsWith('@media') || head.startsWith('@supports') || head.startsWith('@container')) {
        i = open + 1;
        walk(close);
      } else if (!head.startsWith('@')) {
        out.push({ selector: head, body: src.slice(open + 1, close) });
      }
      i = close + 1;
    }
  };
  walk(src.length);
  return out;
}

const selectorsOf = (rule) => rule.selector.split(',').map((s) => s.trim().replace(/\s+/g, ' '));

/** Does this declaration block start an animation or a timed transition? */
function animates(body) {
  return body.split(';').some((decl) => {
    const m = decl.match(/^\s*(animation|animation-name|animation-duration|transition|transition-duration)\s*:\s*(.+?)\s*$/i);
    return Boolean(m) && !/^(none|0m?s|initial|unset|inherit)(\s*!important)?$/i.test(m[2]);
  });
}

/** The pseudo-elements a selector ends on, normalised (`:before` → `::before`). */
function pseudoElementsOf(selector) {
  const found = selector.match(/::[a-z-]+(\([^)]*\))?|:(before|after|first-line|first-letter)\b/gi) || [];
  return found.map((p) => (p.startsWith('::') ? p : `:${p}`).toLowerCase());
}

/** The blanket kill switch: the rule whose selector list names `.zero-animation-mode *`. */
function blanketRule(all) {
  return all.find((r) => selectorsOf(r).includes('.zero-animation-mode *'));
}

/**
 * Every pseudo-element some rule animates that the blanket rule does not
 * reach, as `selector (pseudo)` strings.
 * @param {string} text
 */
function uncoveredPseudoAnimations(text) {
  const all = rules(text);
  const blanket = blanketRule(all);
  const named = new Set(blanket ? selectorsOf(blanket) : []);
  const misses = [];
  for (const rule of all) {
    if (rule === blanket || !animates(rule.body)) continue;
    for (const sel of selectorsOf(rule)) {
      for (const pseudo of pseudoElementsOf(sel)) {
        if (!named.has(`.zero-animation-mode *${pseudo}`)) misses.push(`${sel} (${pseudo})`);
      }
    }
  }
  return misses;
}

describe('zero-animation mode reaches pseudo-elements (app.css)', () => {
  it('the blanket rule stops animations and transitions on elements and their ::before / ::after', () => {
    const blanket = blanketRule(rules(css));
    expect(blanket).toBeDefined();
    const sels = selectorsOf(/** @type {{ selector: string, body: string }} */ (blanket));
    expect(sels).toEqual(expect.arrayContaining([
      '.zero-animation-mode',
      '.zero-animation-mode *',
      '.zero-animation-mode *::before',
      '.zero-animation-mode *::after',
    ]));
    expect(blanket?.body).toMatch(/animation:\s*none\s*!important/);
    expect(blanket?.body).toMatch(/transition:\s*none\s*!important/);
  });

  it('no rule animates a pseudo-element the blanket rule does not name', () => {
    expect(uncoveredPseudoAnimations(css)).toEqual([]);
  });

  it('the scan itself catches a pseudo-element transition the blanket rule misses', () => {
    const sheet = `
      .panel input::before { scale: 0; transition: scale 200ms ease; }
      .tip::marker { animation: blink 1s infinite; }
      .calm::after { transition: none; }
      @media (prefers-reduced-motion: reduce) { .panel input::before { transition: none; } }
      .zero-animation-mode, .zero-animation-mode * { animation: none !important; transition: none !important; }
    `;
    expect(uncoveredPseudoAnimations(sheet)).toEqual([
      '.panel input::before (::before)',
      '.tip::marker (::marker)',
    ]);
    const covered = sheet.replace(
      '.zero-animation-mode * {',
      '.zero-animation-mode *, .zero-animation-mode *::before, .zero-animation-mode *::marker {',
    );
    expect(uncoveredPseudoAnimations(covered)).toEqual([]);
  });
});
