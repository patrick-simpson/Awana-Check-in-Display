import { describe, it, expect } from 'vitest';
import {
  CHIP, KICKER, LAYOUT, LOBBY_THEMES, READ, SHOUT, SUB,
  balancedBreaks, fitFrame, joinTokens, lobbyTheme, measureText, paragraphs, slideFrame, splitRun, tokenize,
} from './lobbyFrame.js';
import { SLIDE_THEMES, MAX_TEXT } from './slides.js';
import { buildCalendarSlides, deriveClubInfo } from './calendarLogic.js';

// A deterministic stand-in for the canvas, close to the real faces: Galindo
// caps run ~0.68em a letter (MAKING BRACELETS measured 10.94em on the real
// build), Figtree ~0.55em, Londrina ~0.42em; an ideograph is a full em in
// any face.
const PER = { shout: 0.68, read: 0.55, label: 0.42, body: 0.52 };
const IDEO = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303F\uFF01-\uFF60]/u;
const measure = (text, face) => [...text].reduce((w, ch) => w + (ch === ' ' ? 0.28 : IDEO.test(ch) ? 1 : PER[face]), 0);

const frame = (over = {}) => ({ kicker: '', headline: '', sub: '', chip: null, textSize: 'auto', ...over });

/** The width of one fitted row, in u, as the fit measured it. */
function rowWidth(fit, text) {
  const shout = fit.headline.mode === 'shout';
  return measure(shout ? text.toUpperCase() : text, shout ? 'shout' : 'read') * fit.headline.size;
}

function kickerWidth(fit, line) {
  return (measure(line.toUpperCase(), 'label') + KICKER.tracking * [...line].length) * fit.kicker.size;
}

function blockBottom(fit) {
  return fit.top + fit.height;
}

/** Every row of the block, top down: [top, width]. */
function rowsOf(fit) {
  const out = [];
  let y = fit.top;
  if (fit.kicker) {
    fit.kicker.lines.forEach((line) => {
      out.push([y, kickerWidth(fit, line)]);
      y += fit.kicker.size * fit.kicker.lineHeight;
    });
    y += KICKER.gap;
  }
  for (const line of fit.headline.lines) {
    out.push([y, rowWidth(fit, line)]);
    y += fit.headline.size * fit.headline.lineHeight;
  }
  return out;
}

const URL130 = 'https://kvbc.example.org/awana/registration/2026-27/fall-family-sign-up-form?ref=lobby-tv&utm_source=signage&utm_campaign=fall-welcome-26';

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

describe('paragraphs, tokens and balanced breaks', () => {
  it('keeps the operator\'s own line breaks and drops blank lines', () => {
    expect(paragraphs('Welcome to\n\nAwana!')).toEqual([['Welcome', 'to'], ['Awana!']]);
    expect(paragraphs('  ')).toEqual([]);
  });

  it('never breaks inside a Latin word, hyphen, apostrophe or URL', () => {
    expect(paragraphs('Pick-up is at the gym doors tonight! Don\'t forget')).toEqual([['Pick-up', 'is', 'at', 'the', 'gym', 'doors', 'tonight!', 'Don\'t', 'forget']]);
    expect(paragraphs(URL130)).toEqual([[URL130]]);
  });

  it('finds the words of a sentence with no spaces (Chinese, Japanese, Thai), and joins them with nothing', () => {
    for (const text of ['欢迎来到今晚的俱乐部活动，请带上你的手册！', '今夜のクラブへようこそ。ハンドブックを持ってきてね', 'ยินดีต้อนรับสู่ชมรมคืนนี้']) {
      const [tokens] = tokenize(text);
      expect(tokens.length).toBeGreaterThan(2);
      expect(tokens.slice(1).every((t) => t.space === false)).toBe(true);
      expect(joinTokens(tokens)).toBe(text);
    }
  });

  it('punctuation rides with its word: no row starts with a comma or ends with an opening bracket', () => {
    const parts = splitRun('你好，世界。「俱乐部」见');
    expect(parts.join('')).toBe('你好，世界。「俱乐部」见');
    for (const part of parts) {
      expect(part).not.toMatch(/^[，。」]/u);
      expect(part).not.toMatch(/「$/u);
    }
  });

  it('a mixed run breaks only where it touches an unspaced script', () => {
    expect(splitRun('Awana俱乐部')).toEqual(expect.arrayContaining(['Awana']));
    expect(splitRun('Pick-up')).toEqual(['Pick-up']);
  });

  it('without Intl.Segmenter, Han still breaks between characters and Thai stays whole', () => {
    expect(splitRun('你好世界', null)).toEqual(['你', '好', '世', '界']);
    expect(splitRun('ยินดีต้อนรับ', null)).toEqual(['ยินดีต้อนรับ']);
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

  it('never asks for more lines than there are words, and counts no gap where tokens join', () => {
    expect(balancedBreaks([1, 2], 0.3, 5).breaks).toEqual([0, 1]);
    expect(balancedBreaks([1, 1, 1], [0, 0, 0], 1).max).toBe(3);
    expect(balancedBreaks([1, 1, 1], [0, 0.5, 0.5], 1).max).toBe(4);
  });
});

describe('fitFrame: the shouted headline', () => {
  it('sets the mockup\'s calendar slide exactly: two lines at 7.2u, chip under, all above the waves', () => {
    const fit = fitFrame(frame({ kicker: 'Next club night', headline: 'Making Bracelets', chip: { label: 'WED', value: 'SEP 30' } }), measure);
    expect(fit.headline).toMatchObject({ mode: 'shout', size: SHOUT.max, lines: ['Making', 'Bracelets'], starts: [0, 1] });
    expect(fit.top).toBe(LAYOUT.top);
    expect(fit.kicker).toEqual({ text: 'Next club night', size: KICKER.size, lines: ['Next club night'], lineHeight: KICKER.lineHeight });
    expect(fit.chip).toMatchObject({ label: 'WED', value: 'SEP 30', size: CHIP.size });
    expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom);
  });

  it('a short line stays one line at full size', () => {
    const fit = fitFrame(frame({ headline: 'Hi!' }), measure);
    expect(fit.headline).toMatchObject({ mode: 'shout', size: SHOUT.max, lines: ['Hi!'] });
  });

  it('prefers the mockup\'s measure, stepping down a little before running edge to edge', () => {
    const fit = fitFrame(frame({ kicker: 'Mark your calendar', headline: 'Next week: Making Bracelets', chip: { label: 'WED', value: 'SEP 30' } }), measure);
    expect(fit.headline.mode).toBe('shout');
    for (const line of fit.headline.lines) expect(rowWidth(fit, line)).toBeLessThanOrEqual(LAYOUT.measure);
    expect(fit.headline.size).toBeGreaterThanOrEqual(SHOUT.measured);
  });

  it('a single long word shrinks rather than breaking, and still shouts', () => {
    const fit = fitFrame(frame({ headline: 'Supercalifragilistic' }), measure);
    expect(fit.headline).toMatchObject({ mode: 'shout', lines: ['Supercalifragilistic'] });
    expect(rowWidth(fit, fit.headline.lines[0])).toBeLessThanOrEqual(LAYOUT.width);
  });

  it('a headline that only fits the full width still shouts, between 5u and 6u', () => {
    const fit = fitFrame(frame({ headline: 'Supercalifragilisticexp' }), measure);
    expect(fit.headline.mode).toBe('shout');
    expect(fit.headline.size).toBeLessThan(SHOUT.measured);
    expect(fit.headline.size).toBeGreaterThanOrEqual(SHOUT.min);
  });

  it('keeps the operator\'s line breaks', () => {
    expect(fitFrame(frame({ headline: 'Welcome to\nAwana!' }), measure).headline.lines).toEqual(['Welcome to', 'Awana!']);
  });

  it('honours an explicit size: lg shouts smaller than auto, xl as big, md reads', () => {
    const auto = fitFrame(frame({ headline: 'Hi!' }), measure).headline;
    const lg = fitFrame(frame({ headline: 'Hi!', textSize: 'lg' }), measure).headline;
    const xl = fitFrame(frame({ headline: 'Hi!', textSize: 'xl' }), measure).headline;
    expect(lg.mode).toBe('shout');
    expect(lg.size).toBeLessThan(auto.size);
    expect(lg.size).toBe(5.8);
    expect(xl.size).toBe(auto.size);
    expect(fitFrame(frame({ headline: 'Hi!', textSize: 'md' }), measure).headline).toMatchObject({ mode: 'read', size: READ.max });
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
    expect(fit.headline.wide).toEqual([]);
    for (const line of fit.headline.lines) expect(rowWidth(fit, line)).toBeLessThanOrEqual(READ.width + 1e-6);
    expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
    expect(fit.top).toBeGreaterThanOrEqual(LAYOUT.safeTop);
  });

  it('a word wider than any line keeps a readable size and is cut across rows of its own, inside the line\'s width', () => {
    for (const headline of [URL130, 'x'.repeat(400), `Register at ${URL130} tonight`]) {
      const fit = fitFrame(frame({ headline }), measure);
      expect(fit.headline.mode).toBe('read');
      expect(fit.headline.wide.length).toBe(1);
      expect(fit.headline.size).toBeGreaterThanOrEqual(READ.wordFloor);
      for (const line of fit.headline.lines) expect(rowWidth(fit, line)).toBeLessThanOrEqual(READ.width + 1e-6);
      // The cut word's rows hold nothing else.
      const w = fit.headline.wide[0];
      fit.headline.starts.forEach((start, r) => {
        if (start === w) expect(URL130 + 'x'.repeat(400)).toContain(fit.headline.lines[r]);
      });
      expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
    }
  });

  it('a long word that fits whole at a readable size is never cut', () => {
    const fit = fitFrame(frame({ headline: 'x'.repeat(45) }), measure);
    expect(fit.headline).toMatchObject({ mode: 'read', wide: [] });
    expect(fit.headline.lines).toEqual(['x'.repeat(45)]);
  });

  it('many typed line breaks never run past the box: the lines run on, a dot between each', () => {
    const names = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lu', 'Max', 'Ned', 'Oli', 'Pia', 'Quin', 'Ruth', 'Sam', 'Tess'];
    for (const kicker of ['', 'Congratulations']) {
      for (const n of [20, 30]) {
        const list = Array.from({ length: n }, (_, i) => names[i % names.length]);
        const text = ['Book finishers!', ...list].join('\n');
        const fit = fitFrame(frame({ kicker, headline: text }), measure);
        expect(fit.top + fit.height).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
        expect(fit.headline).toMatchObject({ mode: 'read', joined: true });
        expect(fit.headline.size).toBeGreaterThanOrEqual(READ.floor);
        expect(fit.headline.tokens.map((t) => t.text.replace(READ.joiner, ''))).toEqual(['Book', 'finishers!', ...list]);
        expect(fit.headline.lines.join(' ')).toContain('finishers! · Ava · Ben');
      }
    }
  });

  it('a list that still fits at the floor keeps its breaks, inside the box', () => {
    const text = ['Book finishers!', ...Array.from({ length: 16 }, (_, i) => `Name ${i + 1}`)].join('\n');
    const fit = fitFrame(frame({ headline: text }), measure);
    expect(fit.headline).toMatchObject({ mode: 'read', joined: false });
    expect(fit.headline.lines).toHaveLength(17);
    expect(fit.headline.size).toBeGreaterThanOrEqual(READ.floor);
    expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
  });

  it('a short list keeps its breaks', () => {
    const fit = fitFrame(frame({ kicker: 'Tonight', headline: '6:30 Opening\n6:45 Small groups\n7:15 Game time\n7:45 Pick-up' }), measure);
    expect(fit.headline.joined).toBe(false);
    expect(fit.headline.lines).toEqual(['6:30 Opening', '6:45 Small groups', '7:15 Game time', '7:45 Pick-up']);
  });

  it('a sentence with no spaces wraps between its words at a readable size', () => {
    const text = '欢迎来到今晚的俱乐部活动请带上你的手册和圣经我们一起学习一起玩游戏欢迎你';
    const fit = fitFrame(frame({ headline: text }), measure);
    expect(fit.headline.lines.length).toBeGreaterThan(1);
    expect(fit.headline.size).toBeGreaterThanOrEqual(4);
    expect(fit.headline.lines.join('')).toBe(text);
    for (const line of fit.headline.lines) expect(rowWidth(fit, line)).toBeLessThanOrEqual(READ.width + 1e-6);
  });
});

describe('fitFrame: the kicker', () => {
  it('a long kicker wraps to two balanced lines rather than running off the screen', () => {
    for (const kicker of ['通'.repeat(60), '重要通知：今晚所有家长请在体育馆门口接孩子，谢谢大家的配合与支持！感谢各位家长和志愿者今晚的辛勤付出与热情帮助！', 'W'.repeat(60)]) {
      const fit = fitFrame(frame({ kicker, headline: 'Hi' }), measure);
      for (const line of fit.kicker.lines) expect(kickerWidth(fit, line)).toBeLessThanOrEqual(LAYOUT.width + 1e-6);
      expect(fit.kicker.lines.join('')).toBe(kicker);
      expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
    }
    const cjk = fitFrame(frame({ kicker: '重要通知：今晚所有家长请在体育馆门口接孩子，谢谢大家的配合与支持！感谢各位家长和志愿者今晚的辛勤付出与热情帮助！', headline: 'Hi' }), measure);
    expect(cjk.kicker.lines).toHaveLength(2);
    expect(cjk.kicker.size).toBeGreaterThanOrEqual(KICKER.min);
  });
});

describe('fitFrame: the corners', () => {
  const long = 'Parents, please remember that pick-up is at the gym doors this week. '.repeat(10).slice(0, MAX_TEXT);

  it('a wide top row never rises into the corner tab or the top-right stack', () => {
    const fit = fitFrame(frame({ kicker: 'Important announcement for all parents and guardians tonight', headline: long }), measure);
    expect(kickerWidth(fit, fit.kicker.lines[0])).toBeGreaterThan(LAYOUT.clearWidth);
    expect(fit.top).toBeGreaterThanOrEqual(LAYOUT.clearTop);
    expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
  });

  it('a narrow kicker may rise between them, so a long slide keeps its room', () => {
    const fit = fitFrame(frame({ kicker: 'Important', headline: long }), measure);
    expect(fit.top).toBeLessThan(LAYOUT.clearTop);
    expect(kickerWidth(fit, fit.kicker.lines[0])).toBeLessThanOrEqual(LAYOUT.clearWidth);
    const wide = fitFrame(frame({ kicker: 'Important announcement for all parents and guardians tonight', headline: long }), measure);
    expect(fit.headline.size).toBeGreaterThan(wide.headline.size);
  });

  it('with no kicker, a wide first row stays below the corners too', () => {
    const fit = fitFrame(frame({ headline: long }), measure);
    expect(fit.top).toBeGreaterThanOrEqual(LAYOUT.clearTop);
  });
});

describe('fitFrame: the invariants, over many texts', () => {
  // A cheap deterministic generator: every length from a word to a full
  // slide, in several scripts, with and without the operator's line breaks.
  const LATIN = ['Awana', 'club', 'night', 'is', 'at', 'the', 'gym', 'doors', 'bring', 'a', 'friend', 'handbook', 'Pick-up', 'tonight!', 'Wednesday,', 'September', '30'];
  const HEBREW = ['ברוכים', 'הבאים', 'לאוואנה', 'הערב', 'הביאו', 'חבר'];
  const THAI = ['ยินดีต้อนรับ', 'สู่ชมรม', 'คืนนี้', 'นำเพื่อนมา'];
  const CJK = ['欢迎', '来到', '俱乐部', '今晚', '请带上', '手册', '，', '！'];
  let seed = 7;
  const rand = (n) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const texts = [];
  for (let n = 1; n < 90; n += 1) {
    const script = n % 4;
    const words = [];
    for (let i = 0; i < n; i += 1) {
      if (script === 0 || script === 1) words.push(LATIN[rand(LATIN.length)]);
      else if (script === 2) words.push(n % 8 === 2 ? HEBREW[rand(HEBREW.length)] : THAI[rand(THAI.length)]);
      else words.push(CJK[rand(CJK.length)]);
    }
    // Every other Latin text gets line breaks, some of them a lot.
    const sep = () => (script === 1 && rand(n % 3 === 0 ? 2 : 6) === 0 ? '\n' : script === 3 ? '' : ' ');
    texts.push(words.reduce((acc, w, i) => (i === 0 ? w : acc + sep() + w), '').slice(0, MAX_TEXT));
  }
  texts.push(Array.from({ length: 30 }, (_, i) => `Leader ${i + 1}`).join('\n'));
  texts.push(`Register at ${URL130}`);
  texts.push('通'.repeat(MAX_TEXT));

  const KICKERS = [{}, { kicker: 'This week' }, { kicker: 'Heads up', chip: { label: 'BACK WED', value: 'DEC 2' }, sub: 'Christmas Break' },
    { kicker: 'Important announcement for all parents and guardians tonight' }, { kicker: '通'.repeat(60) }];

  it('never breaks inside a word, never leaves the box, never collides with the chrome', () => {
    for (const text of texts) {
      for (const extra of KICKERS) {
        const fit = fitFrame(frame({ headline: text, ...extra }), measure);
        const h = fit.headline;
        const wide = new Set(h.wide);
        // The tokens are the text, in order, whatever the layout.
        expect(h.tokens.map((t) => t.text.replace(READ.joiner, '')).join('')).toBe(text.replace(/\s+/g, ''));
        // Rows break only between tokens; only a token wider than any line spans rows.
        h.starts.forEach((start, r) => {
          const next = h.starts[r + 1] ?? h.tokens.length;
          if (wide.has(start)) expect(h.tokens[start].text).toContain(h.lines[r]);
          else expect(h.lines[r]).toBe(joinTokens(h.tokens, start, next));
        });
        const limit = h.mode === 'shout' ? LAYOUT.width : READ.width;
        for (const line of h.lines) expect(rowWidth(fit, line)).toBeLessThanOrEqual(limit + 1e-6);
        if (h.mode === 'shout') {
          expect(h.lines.length).toBeLessThanOrEqual(SHOUT.maxLines);
          if (h.lines.some((line) => rowWidth(fit, line) > LAYOUT.measure + 1e-6)) expect(h.lines.length).toBeLessThanOrEqual(SHOUT.wideLines);
        }
        if (fit.kicker) for (const line of fit.kicker.lines) expect(kickerWidth(fit, line)).toBeLessThanOrEqual(LAYOUT.width + 1e-6);
        expect(fit.top).toBeGreaterThanOrEqual(LAYOUT.safeTop);
        expect(blockBottom(fit)).toBeLessThanOrEqual(LAYOUT.safeBottom + 1e-6);
        for (const [top, width] of rowsOf(fit)) {
          if (top < LAYOUT.clearTop - 1e-6) expect(width).toBeLessThanOrEqual(LAYOUT.clearWidth + 1e-6);
        }
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
