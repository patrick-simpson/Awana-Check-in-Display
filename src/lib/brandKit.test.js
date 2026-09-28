import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The brand kit (shared/brand/) is mirrored byte-for-byte into the Journey
// kiosk and the label printer, and read three ways here (tokens.json by
// code, tokens.css by plain CSS, theme.json by both screens). These tests
// are what keeps the three spellings of one palette from drifting apart.

const SHARED = resolve(__dirname, '../../shared');
const KIT = resolve(SHARED, 'brand');
const tokens = JSON.parse(readFileSync(resolve(KIT, 'tokens.json'), 'utf8'));
const css = readFileSync(resolve(KIT, 'tokens.css'), 'utf8');
const theme = JSON.parse(readFileSync(resolve(SHARED, 'theme.json'), 'utf8'));
const CLUBS = ['puggles', 'cubbies', 'sparks', 'tnt', 'trek', 'journey'];

const cssVar = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};
const camelToKebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe('shared/brand kit', () => {
  it('tokens.css carries every club color in tokens.json', () => {
    for (const id of CLUBS) {
      const c = tokens.clubs[id];
      expect(cssVar(`brand-${id}`)?.toUpperCase(), id).toBe(c.primary.toUpperCase());
      expect(cssVar(`brand-${id}-deep`)?.toUpperCase(), `${id} deep`).toBe(c.deep.toUpperCase());
      expect(cssVar(`brand-${id}-tint`)?.toUpperCase(), `${id} tint`).toBe(c.tint.toUpperCase());
    }
  });

  it('tokens.css carries every house color in tokens.json', () => {
    for (const [k, v] of Object.entries(tokens.house)) {
      if (k === 'chip' || k === 'chipOpacity') continue;
      expect(cssVar(`brand-${camelToKebab(k)}`)?.toUpperCase(), k).toBe(v.toUpperCase());
    }
  });

  it('tokens.css carries the motion table in tokens.json', () => {
    expect(cssVar('brand-beat')).toBe(`${tokens.motion.beatMs}ms`);
    for (const [k, ms] of Object.entries(tokens.motion.durationsMs)) {
      expect(cssVar(`brand-dur-${k}`), k).toBe(`${ms}ms`);
    }
    for (const [k, pts] of Object.entries(tokens.motion.curves)) {
      expect(cssVar(`brand-ease-${k}`), k).toBe(`cubic-bezier(${pts.join(', ')})`);
    }
  });

  it('theme.json uses the kit colors for every club', () => {
    for (const id of CLUBS) {
      const c = theme.clubs[id];
      expect(c, id).toBeDefined();
      expect(c.color.toUpperCase(), id).toBe(tokens.clubs[id].primary.toUpperCase());
      expect(c.deep.toUpperCase(), `${id} deep`).toBe(tokens.clubs[id].deep.toUpperCase());
      expect(c.tint.toUpperCase(), `${id} tint`).toBe(tokens.clubs[id].tint.toUpperCase());
    }
  });

  it('Puggles is blue, by the owner\'s decision, not its catalog page orange', () => {
    expect(tokens.clubs.puggles.primary).toBe('#1DB6D9');
  });

  it('ships white, color and one-color marks for every club, plus the Awana Clubs mark', () => {
    for (const id of CLUBS) {
      for (const v of ['white', 'color', 'black']) {
        expect(existsSync(resolve(KIT, 'logos', `${id}-${v}.svg`)), `${id}-${v}`).toBe(true);
      }
      expect(existsSync(resolve(KIT, 'shapes', `wave-${id}.svg`)), `wave-${id}`).toBe(true);
    }
    expect(existsSync(resolve(KIT, 'logos', 'awana-clubs-white.svg'))).toBe(true);
    expect(existsSync(resolve(KIT, 'logos', 'awana-clubs-black.svg'))).toBe(true);
  });

  it('every file fonts.css points at exists, with its license', () => {
    const fontsCss = readFileSync(resolve(KIT, 'fonts.css'), 'utf8');
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(existsSync(resolve(KIT, u)), u).toBe(true);
    const files = readdirSync(resolve(KIT, 'fonts'));
    for (const lic of ['OFL-Galindo.txt', 'OFL-LondrinaSolid.txt', 'OFL-Figtree.txt']) {
      expect(files, lic).toContain(lic);
    }
  });

  it('every SVG in the kit is a plain vector file with no script or external reference', () => {
    for (const dir of ['logos', 'shapes', 'doodles']) {
      for (const f of readdirSync(resolve(KIT, dir))) {
        const svg = readFileSync(resolve(KIT, dir, f), 'utf8');
        expect(svg, f).toMatch(/<svg[\s>]/);
        expect(svg, f).not.toMatch(/<script|on[a-z]+="|href="(?!#|data:)/i);
      }
    }
  });
});
