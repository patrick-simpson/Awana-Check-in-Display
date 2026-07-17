import { describe, expect, it } from 'vitest';
import {
  LIVE_BIRTHDAY_MAX_AGE_MS,
  birthdaysThisWeek,
  listNames,
  mergeLiveBirthdays,
  normalizeClub,
  parseBirthdayCSV,
  parseBirthdayDate,
  weekStart,
} from './birthdays.js';

const entry = (name, month, day, club) => ({
  name,
  month,
  day,
  club,
});

describe('parseBirthdayDate', () => {
  it('accepts common formats, ignoring years', () => {
    expect(parseBirthdayDate('9/16')).toEqual({ month: 9, day: 16 });
    expect(parseBirthdayDate('09/16/2018')).toEqual({ month: 9, day: 16 });
    expect(parseBirthdayDate('9-16-18')).toEqual({ month: 9, day: 16 });
    expect(parseBirthdayDate('2018-09-16')).toEqual({ month: 9, day: 16 });
    expect(parseBirthdayDate('Sep 16')).toEqual({ month: 9, day: 16 });
    expect(parseBirthdayDate('September 16, 2018')).toEqual({ month: 9, day: 16 });
    expect(parseBirthdayDate('Feb 29')).toEqual({ month: 2, day: 29 });
  });

  it('rejects impossible or unparseable dates', () => {
    expect(parseBirthdayDate('13/5')).toBeNull();
    expect(parseBirthdayDate('2/30')).toBeNull();
    expect(parseBirthdayDate('soon')).toBeNull();
    expect(parseBirthdayDate('')).toBeNull();
  });
});

describe('normalizeClub', () => {
  it('maps catalog spellings and loose variants', () => {
    expect(normalizeClub('Sparks')).toBe('sparks');
    expect(normalizeClub('SPARKS!')).toBe('sparks');
    expect(normalizeClub('T&T')).toBe('tnt');
    expect(normalizeClub('TnT')).toBe('tnt');
    expect(normalizeClub('Truth & Training')).toBe('tnt');
    expect(normalizeClub('Cubbies')).toBe('cubbies');
    expect(normalizeClub('cubby')).toBe('cubbies');
    expect(normalizeClub('Puggles')).toBe('puggles');
    expect(normalizeClub('youth group')).toBeNull();
  });
});

describe('parseBirthdayCSV', () => {
  it('parses a headered CSV with mixed date formats', () => {
    const csv = [
      'Name,Birthday,Club',
      'Sarah M.,9/16,Sparks',
      'Liam K.,2019-01-08,T&T',
      '"Smith, Jr., Noah",Dec 30,Puggles',
    ].join('\n');
    const { entries, errors } = parseBirthdayCSV(csv);
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      entry('Sarah M.', 9, 16, 'sparks'),
      entry('Liam K.', 1, 8, 'tnt'),
      entry('Smith, Jr., Noah', 12, 30, 'puggles'),
    ]);
  });

  it('honors reordered header columns', () => {
    const csv = ['Club,Child Name,DOB', 'Cubbies,Ava,2/3'].join('\n');
    const { entries, errors } = parseBirthdayCSV(csv);
    expect(errors).toEqual([]);
    expect(entries).toEqual([entry('Ava', 2, 3, 'cubbies')]);
  });

  it('assumes name,birthday,club when there is no header', () => {
    const { entries } = parseBirthdayCSV('Ava,2/3,Cubbies');
    expect(entries).toEqual([entry('Ava', 2, 3, 'cubbies')]);
  });

  it('skips bad rows with per-row errors, keeping good ones', () => {
    const csv = [
      'Name,Birthday,Club',
      'Ava,2/3,Cubbies',
      ',5/5,Sparks',
      'Ben,someday,Sparks',
      'Cal,6/6,Chess Club',
    ].join('\n');
    const { entries, errors } = parseBirthdayCSV(csv);
    expect(entries).toEqual([entry('Ava', 2, 3, 'cubbies')]);
    expect(errors).toHaveLength(3);
  });

  it('returns nothing for an empty file', () => {
    expect(parseBirthdayCSV('')).toEqual({ entries: [], errors: [] });
  });
});

describe('listNames', () => {
  it('joins names for display', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['Ava'])).toBe('Ava');
    expect(listNames(['Ava', 'Liam'])).toBe('Ava & Liam');
    expect(listNames(['Ava', 'Liam', 'Noah'])).toBe('Ava, Liam & Noah');
  });
});

describe('weekStart', () => {
  it('returns the Sunday of the containing week at local midnight', () => {
    // 2026-09-16 is a Wednesday → its week starts Sunday 2026-09-13.
    const start = weekStart(new Date('2026-09-16T18:04:00'));
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(13);
    expect(start.getHours()).toBe(0);
  });
});

describe('birthdaysThisWeek', () => {
  const roster = [
    entry('Sunday Kid', 9, 13, 'sparks'),
    entry('Wednesday Kid', 9, 16, 'tnt'),
    entry('Saturday Kid', 9, 19, 'cubbies'),
    entry('Next Week Kid', 9, 20, 'puggles'),
    entry('Last Week Kid', 9, 12, 'sparks'),
  ];

  it('includes Sun–Sat of the meeting week, in day order, and nothing else', () => {
    const wed = new Date('2026-09-16T18:04:00');
    expect(birthdaysThisWeek(roster, wed).map((e) => e.name)).toEqual([
      'Sunday Kid',
      'Wednesday Kid',
      'Saturday Kid',
    ]);
  });

  it('handles weeks that span a year boundary', () => {
    // Week of Wed 2026-12-30 runs Sun Dec 27 → Sat Jan 2.
    const roster2 = [entry('NYE Kid', 12, 31, 'tnt'), entry('New Year Kid', 1, 1, 'sparks')];
    const names = birthdaysThisWeek(roster2, new Date('2026-12-30T18:00:00')).map((e) => e.name);
    expect(names).toEqual(['NYE Kid', 'New Year Kid']);
  });

  it('celebrates Feb 29 birthdays on Feb 28 in common years', () => {
    const leapKid = [entry('Leap Kid', 2, 29, 'cubbies')];
    // 2027 is a common year; Feb 28 2027 is a Sunday, so the week of
    // Wed 2027-03-03 contains it.
    expect(birthdaysThisWeek(leapKid, new Date('2027-03-03T18:00:00'))).toHaveLength(1);
    // 2028 is a leap year; Feb 29 2028 is a Tuesday.
    expect(birthdaysThisWeek(leapKid, new Date('2028-03-01T18:00:00'))).toHaveLength(1);
    // A random other week matches nothing.
    expect(birthdaysThisWeek(leapKid, new Date('2027-06-09T18:00:00'))).toHaveLength(0);
  });
});

describe('mergeLiveBirthdays', () => {
  const now = new Date('2026-09-16T18:00:00');
  const live = (
    name,
    club,
    ageMs = 0,
    month = 9,
    day = 16,
  ) => ({ name, month, day, club, receivedAt: now.getTime() - ageMs });

  it('appends fresh live entries after the CSV roster', () => {
    const csv = [entry('Ava Smith', 9, 14, 'sparks')];
    const merged = mergeLiveBirthdays(csv, [live('Liam', 'tnt')], now);
    expect(merged.map((e) => e.name)).toEqual(['Ava Smith', 'Liam']);
  });

  it('CSV wins: drops a live entry matching an existing club + first name', () => {
    const csv = [entry('Ava Smith', 9, 14, 'sparks')];
    const merged = mergeLiveBirthdays(csv, [live('ava', 'sparks')], now);
    expect(merged).toHaveLength(1);
    // Same first name in a DIFFERENT club is a different kid.
    expect(mergeLiveBirthdays(csv, [live('Ava', 'tnt')], now)).toHaveLength(2);
  });

  it('prunes stale live entries and dedupes within the live list', () => {
    const merged = mergeLiveBirthdays(
      [],
      [live('Old Kid', 'cubbies', LIVE_BIRTHDAY_MAX_AGE_MS + 1), live('Noah', 'tnt'), live('noah', 'tnt')],
      now,
    );
    expect(merged.map((e) => e.name)).toEqual(['Noah']);
  });
});
