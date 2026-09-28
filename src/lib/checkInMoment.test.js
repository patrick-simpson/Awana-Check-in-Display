import { describe, it, expect } from 'vitest';
import { momentFor, kickerFor, sublineFor, stickerFor, nameSizeU, NAME_ROOM_U, NAME_MIN_U } from './checkInMoment.js';

describe('momentFor', () => {
  it('ranks birthday over first-timer over welcome-back over welcome', () => {
    expect(momentFor({ isBirthday: true, isFirstTimer: true, welcomeBack: true })).toBe('birthday');
    expect(momentFor({ isFirstTimer: true, welcomeBack: true })).toBe('first');
    expect(momentFor({ welcomeBack: true })).toBe('back');
    expect(momentFor({})).toBe('welcome');
  });
});

describe('kickerFor', () => {
  it('names the kind of arrival', () => {
    expect(kickerFor({}, 'birthday')).toBe('Happy birthday');
    expect(kickerFor({}, 'first')).toBe('Welcome to Awana Clubs');
    expect(kickerFor({}, 'back')).toBe('Welcome back');
    expect(kickerFor({ presentation: 'late' }, 'welcome')).toBe('Welcome');
  });

  it('says a replayed recap is not happening now', () => {
    expect(kickerFor({ presentation: 'replay' }, 'welcome')).toBe('Also joined us tonight');
    expect(kickerFor({ presentation: 'replay' }, 'birthday')).toBe('Also joined us tonight');
  });
});

describe('sublineFor', () => {
  it('a birthday-week ribbon replaces the day-claiming tagline', () => {
    expect(sublineFor('birthday')).toMatch(/special day/);
    expect(sublineFor('birthday', { ribbon: 'Birthday this Friday!' })).toBe('Birthday this Friday!');
  });

  it('first-timers and returning kids get their own line, and ignore phrase and ribbon', () => {
    expect(sublineFor('first', { phrase: 'Go Sparks!' })).toMatch(/very first time/);
    expect(sublineFor('back', { ribbon: 'Birthday this Friday!' })).toMatch(/brand-new season/);
  });

  it('a plain welcome carries the ribbon and the club phrase, or nothing', () => {
    expect(sublineFor('welcome')).toBeNull();
    expect(sublineFor('welcome', { phrase: 'Go Sparks!' })).toBe('Go Sparks!');
    expect(sublineFor('welcome', { ribbon: 'Birthday this Friday!' })).toBe('Birthday this Friday!');
    expect(sublineFor('welcome', { ribbon: 'Birthday this Friday!', phrase: 'Go Sparks!' }))
      .toBe('Birthday this Friday! · Go Sparks!');
    expect(sublineFor('welcome', { phrase: '   ' })).toBeNull();
  });
});

describe('stickerFor', () => {
  it('only birthdays and first-timers get the hot sticker', () => {
    expect(stickerFor('birthday')).toEqual(['Happy', 'birthday!']);
    expect(stickerFor('first')).toEqual(['New!']);
    expect(stickerFor('back')).toBeNull();
    expect(stickerFor('welcome')).toBeNull();
  });

  it('never claims an age: no numbers on a birthday sticker', () => {
    expect(stickerFor('birthday').join(' ')).not.toMatch(/\d/);
  });
});

describe('nameSizeU', () => {
  const em = (perChar) => (t) => [...t].length * perChar;

  it('uses the catalog step for short names', () => {
    expect(nameSizeU('MAYA', em(0.7)).size).toBe(10);
    expect(nameSizeU('SOPHIA', em(0.7)).size).toBe(10);
    expect(nameSizeU('ISABELLA', em(0.7)).size).toBe(8.6);
    expect(nameSizeU('CHRISTOPHER', em(0.7)).size).toBe(7.2);
  });

  it('shrinks a name that would not fit the column at its step', () => {
    const { size, wraps } = nameSizeU('BARTHOLOMEW', em(1));
    expect(size).toBeCloseTo(NAME_ROOM_U / 11, 1);
    expect(size * 11).toBeLessThanOrEqual(NAME_ROOM_U + 0.01);
    expect(wraps).toBe(false);
  });

  it('never goes below the floor, and only wraps between words', () => {
    const long = 'MARY ELIZABETH ANNE-CATHERINE MARGARET';
    const r = nameSizeU(long, em(0.8));
    expect(r.size).toBe(NAME_MIN_U);
    expect(r.wraps).toBe(true);
    const oneWord = 'X'.repeat(60);
    const w = nameSizeU(oneWord, em(0.8));
    expect(w.size).toBe(NAME_MIN_U);
    expect(w.wraps).toBe(false);
  });

  it('survives a measure that reports nothing', () => {
    expect(nameSizeU('MAYA', () => 0).size).toBe(10);
    expect(nameSizeU('', em(1)).size).toBe(10);
  });
});
