import { describe, it, expect } from 'vitest';
import {
  CHIP, KICKER, LAYOUT, LOBBY_THEMES, READ, SHOUT, SUB,
  balancedBreaks, fitFrame, lobbyTheme, measureText, paragraphs, slideFrame,
} from './lobbyFrame.js';
import { SLIDE_THEMES, MAX_TEXT } from './slides.js';
import { buildCalendarSlides, deriveClubInfo } from './calendarLogic.js';

// A deterministic stand-in for the canvas, close to the real faces: Galindo
// caps run ~0.68em a letter (MAKING BRACELETS measured 10.94em on the real
// build), Figtree ~0.55em, Londrina ~0.42em.
const PER = { shout: 0.68, read: 0.55, label: 0.42, body: 0.52 };
const measure = (text, face) => [...text].reduce((w, ch) => w + (ch === ' ' ? 0.28 : PER[face]), 0);

const frame = (over = {}) => ({ kicker: '', headline: '', sub: '', chip: null, textSize: 'auto', ...over });

/** The width of one fitted line, in u, as the fit measured it. */
function lineWidth(fit, words) {
  const face = fit.headline.mode === 'shout' ? 'shout' : 'read';
  const text = fit.headline.mode === 'shout' ? words.join(' ').toUpperCase() : words.join(' ');
  return measure(text, face) * fit.headline.size;
}

function blockBottom(fit) {
  return fit.top + fit.height;
}

describe('slideFrame', () => {
  it('reads a typed slide as kicker + headline', () => {
    const f = slideFrame({ eyebrow: '  This   week ', text: 'Bring your handbook\n', textSize: 'lg' });
    expect(f).toEqual({ kicker: 'This week', headline: 'Bring your handbook', sub: '', chip: null, textSize: 'lg' });
  });

  it('keeps a calendar slide\'s own frame: the date moves to the chip, sized afresh', () => {
    const f = slideFrame({
      eyebrow: 'Next club night', text: 'Making Bracelets — Wed, Sep 30', textSize: 'lg',
      frame: { headline: 'Making Bracelets', chip: { label: 'WED', value: 'SEP 30' } },
    });
    expect(f).toEqual({ kicker: 'Next club night', headline: 'Making Bracelets', sub: '', chip: { label: 'WED', value: 'SEP 30' }, textSize: 'auto' });
  });

  it('carries the old subtext as the supporting line', () => {
    expect(slideFrame({ text: 'Welcome to Water Night!', subtext: 'Poster Contest kicks off' }).sub).toBe('Poster Contest kicks off');
  });

  it('never throws on a half-empty slide', () => {
    expect(slideFrame(undefined)).toEqual({ kicker: '', headline: '', sub: '', chip: null, textSize: 'auto' });
    expect(slideFrame({ frame: { headline: 'Hi', chip: { label: 'WED' } } }).chip).toBeNull();
  });
});

describe('paragraphs and balanced breaks', () => {
  it('keeps the operator\'s own line breaks and drops blank lines', () => {
    expect(paragraphs('Welcome to\n\nAwana!')).toEqual([['Welcome', 'to'], ['Awana!']]);
    expect(paragraphs('  ')).toEqual([]);
  });

  it('splits the way the mockup sets its headlines', () => {
    const split = (text, k) => {
      const words = text.split(' ');
      const { breaks } = balancedBreaks(words.map((w) => measure(w, 'shout')), 0.28, k);
      return breaks.map((b, i) => words.slice(b, breaks[i + 1]).join(' '));
    };
    expect(split('MAKING BRACELETS', 2)).toEqual(['MAKING', 'BRACELETS']);
    expect(split('BRING YOUR HANDBOOK', 2)).toEqual(['BRING YOUR', 'HANDBOOK']);
    expect(split('PICK-UP IS AT THE GYM DOORS', 2)).toEqual(['PICK-UP IS AT', 'THE GYM DOORS']);
  });

  it('never asks for more lines than there are words', () => {
    expect(balancedBreaks([1, 2], 0.3, 5).breaks).toEqual([0, 1]);
  });
});

describe('fitFrame: the shouted headline', () => {
  it('sets the mockup\'s calendar slide exactly: two lines at 7.2u, chip under, all above the waves', () => {
    const fit = fitFrame(frame({ kicker: 'Next club night', headline: 'Making Bracelets', chip: { label: 'WED', value: 'SEP 30' } }), measure);
    expect(fit.headline).toMatchObject({ mode: 'shout', size: SHOUT.max, lines: [['Making'], ['Bracelets']] });
    expect(fit.top).toBe(LAYOUT.top);
    expect(fit.kicker).toEqual({ text: 'Next club night', size: KICKER.size });
    expect(fit.chip).toMatchObject({ label: 'WED', value: 'SEP 30', size: CHIP.size });
    expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom);
  });

  it('a short line stays one line at full size', () => {
    const fit = fitFrame(frame({ headline: 'Hi!' }), measure);
    expect(fit.headline).toMatchObject({ mode: 'shout', size: SHOUT.max, lines: [['Hi!']] });
  });

  it('prefers the mockup\'s measure, stepping down a little before running edge to edge', () => {
    const fit = fitFrame(frame({ kicker: 'Mark your calendar', headline: 'Next week: Making Bracelets', chip: { label: 'WED', value: 'SEP 30' } }), measure);
    expect(fit.headline.mode).toBe('shout');
    for (const line of fit.headline.lines) expect(lineWidth(fit, line)).toBeLessThanOrEqual(LAYOUT.measure);
    expect(fit.headline.size).toBeGreaterThanOrEqual(SHOUT.measured);
  });

  it('a single long word shrinks rather than breaking', () => {
    const fit = fitFrame(frame({ headline: 'Supercalifragilistic' }), measure);
    expect(fit.headline.lines).toEqual([['Supercalifragilistic']]);
    expect(lineWidth(fit, fit.headline.lines[0])).toBeLessThanOrEqual(LAYOUT.width);
  });

  it('keeps the operator\'s line breaks', () => {
    expect(fitFrame(frame({ headline: 'Welcome to\nAwana!' }), measure).headline.lines).toEqual([['Welcome', 'to'], ['Awana!']]);
  });

  it('honours an explicit size: lg caps the shout, md reads', () => {
    expect(fitFrame(frame({ headline: 'Hi!', textSize: 'lg' }), measure).headline.size).toBe(SHOUT.ceiling.lg);
    expect(fitFrame(frame({ headline: 'Hi!', textSize: 'md' }), measure).headline.mode).toBe('read');
  });
});

describe('fitFrame: text too long to shout', () => {
  it('reads instead of building a wall of caps', () => {
    const fit = fitFrame(frame({ headline: 'Don\'t forget: bring your Bible and your handbook every single week!' }), measure);
    expect(fit.headline.mode).toBe('read');
    expect(fit.headline.size).toBeLessThanOrEqual(READ.max);
  });

  it('a max-length slide still fits the box', () => {
    const text = 'Parents, please remember that pick-up is at the gym doors this week. '.repeat(10).slice(0, MAX_TEXT);
    const fit = fitFrame(frame({ kicker: 'Important', headline: text }), measure);
    expect(fit.headline.mode).toBe('read');
    expect(fit.headline.overflow).toBe(false);
    for (const line of fit.headline.lines) expect(lineWidth(fit, line)).toBeLessThanOrEqual(READ.width + 1e-6);
    expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
    expect(fit.top).toBeGreaterThanOrEqual(LAYOUT.safeTop);
  });

  it('a word wider than the whole box is the one thing allowed to break', () => {
    const fit = fitFrame(frame({ headline: 'x'.repeat(400) }), measure);
    expect(fit.headline).toMatchObject({ mode: 'read', overflow: true, size: READ.floor });
  });
});

describe('fitFrame: the invariants, over many texts', () => {
  // A cheap deterministic generator: every length from a word to a full slide.
  const WORDS = ['Awana', 'club', 'night', 'is', 'at', 'the', 'gym', 'doors', 'bring', 'a', 'friend', 'handbook', 'Pick-up', 'tonight!', 'Wednesday,', 'September', '30'];
  const texts = [];
  let seed = 7;
  for (let n = 1; n < 90; n += 1) {
    const words = [];
    for (let i = 0; i < n; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      words.push(WORDS[seed % WORDS.length]);
    }
    texts.push(words.join(' ').slice(0, MAX_TEXT));
  }

  it('never breaks inside a word, never leaves the box, never collides with the chrome', () => {
    for (const text of texts) {
      for (const extra of [{}, { kicker: 'This week' }, { kicker: 'Heads up', chip: { label: 'BACK WED', value: 'DEC 2' }, sub: 'Christmas Break' }]) {
        const fit = fitFrame(frame({ headline: text, ...extra }), measure);
        expect(fit.headline.lines.flat()).toEqual(text.split(/\s+/).filter(Boolean));
        const limit = fit.headline.mode === 'shout' ? LAYOUT.width : READ.width;
        for (const line of fit.headline.lines) expect(lineWidth(fit, line)).toBeLessThanOrEqual(limit + 1e-6);
        if (fit.headline.mode === 'shout') expect(fit.headline.lines.length).toBeLessThanOrEqual(SHOUT.maxLines);
        expect(fit.top).toBeGreaterThanOrEqual(LAYOUT.safeTop);
        expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
      }
    }
  });

  it('every calendar slide fits', () => {
    const club = (date, title = 'Awana', over = {}) => ({ date, kind: 'club', title, isCancelled: false, isSpecial: title !== 'Awana', ...over });
    const info = deriveClubInfo([club('2026-09-23'), club('2026-09-30', 'Making Bracelets'), club('2026-10-07', 'Awana', { isCancelled: true }), club('2026-10-14')], '2026-09-28');
    for (const s of buildCalendarSlides(info, {})) {
      const fit = fitFrame(slideFrame(s), measure);
      expect(fit.headline.mode).toBe('shout');
      expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
    }
  });
});

describe('fitFrame: the supporting line', () => {
  it('wraps a long note to a few lines and steps down if it must', () => {
    const fit = fitFrame(frame({ headline: 'Water night', sub: 'Poster contest kicks off tonight, so bring your best drawing and your markers and your friends' }), measure);
    expect(fit.sub.lines.length).toBeLessThanOrEqual(SUB.maxLines);
    expect(fit.sub.size).toBeLessThanOrEqual(SUB.size);
  });
});

describe('themes and measuring', () => {
  it('every operator theme is expressed in the kit', () => {
    expect(Object.keys(LOBBY_THEMES).sort()).toEqual([...SLIDE_THEMES].sort());
    for (const t of Object.values(LOBBY_THEMES)) {
      expect(Object.keys(t).sort()).toEqual(['cloud', 'doodle', 'face', 'field', 'kicker', 'shadow', 'sub']);
    }
    expect(lobbyTheme('nope')).toBe('sky');
    expect(lobbyTheme('night')).toBe('night');
  });

  it('the night sky gets its own shadow: Awana blue would vanish into it', () => {
    expect(LOBBY_THEMES.night.shadow).not.toBe(LOBBY_THEMES.sky.shadow);
  });

  it('estimates when there is no canvas, a little wide on purpose', () => {
    expect(measureText('MAKING', 'shout')).toBeGreaterThan(6 * 0.68);
    expect(measureText('a b', 'read')).toBeGreaterThan(0);
  });
});
