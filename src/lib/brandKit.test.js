import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// The brand kit (shared/brand/) is mirrored byte-for-byte into the Journey
// kiosk and the label printer, and read three ways here (tokens.json by
// code, tokens.css by plain CSS, theme.json by both screens). These tests
// are what keeps the three spellings of one palette from drifting apart.

const SHARED = resolve(__dirname, '../../shared');
const KIT = resolve(SHARED, 'brand');
const tokens = JSON.parse(readFileSync(resolve(KIT, 'tokens.json'), 'utf8'));
const css = readFileSync(resolve(KIT, 'tokens.css'), 'utf8');
const fontsCss = readFileSync(resolve(KIT, 'fonts.css'), 'utf8');
const theme = JSON.parse(readFileSync(resolve(SHARED, 'theme.json'), 'utf8'));
const CLUBS = ['puggles', 'cubbies', 'sparks', 'tnt', 'trek', 'journey'];

const cssVar = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};
const camelToKebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// ---------------------------------------------------------------------------
// Fonts. Paytone One is the shout (owner decision 2026-09-29, replacing
// Galindo). Its license reserves the name "Paytone One", so the kit ships the
// FULL, UNMODIFIED font: the upstream TTF, and a WOFF2 that is only a
// lossless compression of that TTF (OFL FAQ 2.2.1: "the original font data
// remains unchanged except for WOFF compression"). These tests are the
// guard on that claim; README.md ("Paytone One and the OFL") is the why.
// ---------------------------------------------------------------------------

const FONTS = resolve(KIT, 'fonts');
const readFont = (name) => readFileSync(resolve(FONTS, name));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const PAYTONE_TTF = 'PaytoneOne-Regular.ttf';
const PAYTONE_WOFF2 = 'paytone-one-full-400-normal.woff2';
// google/fonts ofl/paytoneone/PaytoneOne-Regular.ttf, Version 1.002.
const PAYTONE_TTF_SHA256 = '1c07073b0b578199b54c7866d55e2b631d285e8aa4bb4fbc08809d980cd49b14';
const PAYTONE_TTF_BYTES = 114648;

// sfnt (TTF) table directory -> { tag: Buffer }
function sfntTables(buf) {
  const n = buf.readUInt16BE(4);
  const out = {};
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    const offset = buf.readUInt32BE(o + 8);
    out[buf.toString('latin1', o, o + 4)] = buf.subarray(offset, offset + buf.readUInt32BE(o + 12));
  }
  return out;
}

// The WOFF2 spec's known-table-tag list (section 4.1), by 6-bit index.
const WOFF2_KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

// Parses a WOFF2 file and decodes it, recording which tables went through a
// real transform: anything but the null transform is not "the original font
// data unchanged".
function readWoff2(buf) {
  const head = {
    signature: buf.toString('latin1', 0, 4),
    flavor: buf.readUInt32BE(4),
    length: buf.readUInt32BE(8),
    numTables: buf.readUInt16BE(12),
    totalSfntSize: buf.readUInt32BE(16),
    totalCompressedSize: buf.readUInt32BE(20),
    metaOffset: buf.readUInt32BE(28),
    metaLength: buf.readUInt32BE(32),
    metaOrigLength: buf.readUInt32BE(36),
    privOffset: buf.readUInt32BE(40),
    privLength: buf.readUInt32BE(44),
  };
  let p = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const c = buf[p++];
      v = v * 128 + (c & 0x7f);
      if (!(c & 0x80)) return v;
    }
    throw new Error('bad UIntBase128');
  };
  const entries = [];
  for (let i = 0; i < head.numTables; i++) {
    const flags = buf[p++];
    let tag = WOFF2_KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 0x3f) {
      tag = buf.toString('latin1', p, p + 4);
      p += 4;
    }
    const version = flags >> 6;
    const origLength = base128();
    const nullTransform = tag === 'glyf' || tag === 'loca' ? version === 3 : version === 0;
    if (!nullTransform) base128(); // transformLength: present only for a real transform
    entries.push({ tag, origLength, nullTransform });
  }
  const stream = brotliDecompressSync(buf.subarray(p, p + head.totalCompressedSize));
  const tables = {};
  let at = 0;
  for (const e of entries) {
    tables[e.tag] = stream.subarray(at, at + e.origLength);
    at += e.origLength;
  }
  return { head, entries, tables, streamLength: stream.length };
}

describe('shared/brand fonts', () => {
  it('the three voices are the same in tokens.json, tokens.css and fonts.css', () => {
    expect(tokens.fonts).toEqual({ display: 'Paytone One', label: 'Londrina Solid', body: 'Figtree' });
    for (const [voice, family] of Object.entries(tokens.fonts)) {
      // The first family of each --brand-font-* stack is the token's family.
      expect(cssVar(`brand-font-${voice}`)?.split(',')[0].trim(), voice).toBe(`'${family}'`);
      expect(fontsCss, voice).toContain(`font-family: '${family}';`);
    }
  });

  it('every stack ends in a generic family, so a missing font never falls to the browser default serif', () => {
    for (const voice of ['display', 'label', 'body']) {
      expect(cssVar(`brand-font-${voice}`), voice).toMatch(/,\s*(sans-serif|system-ui)$/);
    }
  });

  it('Galindo is gone from the kit: no files, no @font-face, no token', () => {
    expect(readdirSync(FONTS).filter((f) => /galindo/i.test(f))).toEqual([]);
    expect(fontsCss).not.toMatch(/galindo/i);
    expect(css).not.toMatch(/galindo/i);
    expect(JSON.stringify(tokens)).not.toMatch(/galindo/i);
  });

  it('the Paytone One TTF is the upstream file, byte for byte', () => {
    const ttf = readFont(PAYTONE_TTF);
    expect(ttf.length).toBe(PAYTONE_TTF_BYTES);
    expect(sha256(ttf)).toBe(PAYTONE_TTF_SHA256);
  });

  it('OFL-PaytoneOne.txt is the OFL 1.1 with its Reserved Font Names', () => {
    const ofl = readFont('OFL-PaytoneOne.txt').toString('utf8');
    expect(ofl).toContain('Copyright 2011 The Paytone Project Authors');
    expect(ofl).toContain('Reserved Font Names "Paytone" and "Paytone One"');
    expect(ofl).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(ofl).toContain('No Modified Version of the Font Software may use the Reserved Font');
  });

  it('fonts.css serves Paytone One from the two full-font files, WOFF2 first, TTF as the fallback', () => {
    const block = fontsCss.match(/@font-face\s*\{[^}]*font-family:\s*'Paytone One'[^}]*\}/)?.[0];
    expect(block).toBeDefined();
    const urls = [...block.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(urls).toEqual([`fonts/${PAYTONE_WOFF2}`, `fonts/${PAYTONE_TTF}`]);
    expect(block).toMatch(/font-weight:\s*400;/);
    // One @font-face for the family: a second (a subset) would be a Modified Version.
    expect(fontsCss.match(/font-family:\s*'Paytone One'/g)).toHaveLength(1);
  });

  it('the Paytone One WOFF2 is the whole TTF, losslessly compressed (OFL FAQ 2.2.1)', () => {
    const woff = readFont(PAYTONE_WOFF2);
    const ttf = readFont(PAYTONE_TTF);
    const w = readWoff2(woff);

    expect(w.head.signature).toBe('wOF2');
    expect(w.head.flavor).toBe(0x00010000); // TrueType outlines
    expect(w.head.length).toBe(woff.length);
    expect(w.head.totalSfntSize).toBe(ttf.length);
    // No WOFF-specific metadata block and no private data: nothing to lose or alter.
    expect([w.head.metaOffset, w.head.metaLength, w.head.metaOrigLength]).toEqual([0, 0, 0]);
    expect([w.head.privOffset, w.head.privLength]).toEqual([0, 0]);
    // Every table travels through the null transform: glyf and loca are NOT
    // re-encoded (the default transform rewrites them, so they would no
    // longer be the original data).
    expect(w.entries.filter((e) => !e.nullTransform).map((e) => e.tag)).toEqual([]);
    expect(w.streamLength).toBe(w.entries.reduce((n, e) => n + e.origLength, 0));

    // All tables present (no subsetting, no dropped smart-font tables)...
    const orig = sfntTables(ttf);
    expect(Object.keys(w.tables).sort()).toEqual(Object.keys(orig).sort());
    // ...and every one byte-identical to the TTF's...
    for (const tag of Object.keys(orig).filter((t) => t !== 'head')) {
      expect(w.tables[tag].equals(orig[tag]), tag).toBe(true);
    }
    // ...except head, which may differ in exactly the two places the WOFF2
    // spec makes an encoder change: bit 11 of flags, and checkSumAdjustment.
    const a = Buffer.from(orig.head);
    const b = Buffer.from(w.tables.head);
    expect(b.length).toBe(a.length);
    expect(b.readUInt16BE(16) & 0x0800, 'head.flags bit 11 is set by a WOFF2 encoder').toBe(0x0800);
    b.writeUInt16BE(b.readUInt16BE(16) & ~0x0800, 16);
    b.fill(0, 8, 12);
    a.writeUInt16BE(a.readUInt16BE(16) & ~0x0800, 16);
    a.fill(0, 8, 12);
    expect(b.equals(a), 'head, apart from flags bit 11 and checkSumAdjustment').toBe(true);
  });
});

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
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(existsSync(resolve(KIT, u)), u).toBe(true);
    const files = readdirSync(resolve(KIT, 'fonts'));
    for (const lic of ['OFL-PaytoneOne.txt', 'OFL-LondrinaSolid.txt', 'OFL-Figtree.txt']) {
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
