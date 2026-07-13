import { describe, it, expect } from 'vitest';
import {
  buildCalendarSlides,
  daysBetween,
  deriveClubInfo,
  formatShortDate,
  isStoreNight,
  localDateStr,
  splitTitle,
} from './calendarLogic.js';

const club = (date, title = 'Awana meeting', extra = {}) => ({
  date, kind: 'club', title,
  isCancelled: false,
  isSpecial: !/^awana meeting$/i.test(title),
  ...extra,
});
const cancelled = (date) => club(date, 'No Awana this week', { isCancelled: true, isSpecial: false });
const note = (date, title) => ({ date, kind: 'note', title, isCancelled: false, isSpecial: false });

describe('localDateStr', () => {
  it('uses LOCAL components — late evening must not roll to tomorrow', () => {
    // 11:59 PM local on Sep 9. toISOString() in any western timezone
    // would already say Sep 10 — the exact club-hours regression.
    expect(localDateStr(new Date(2026, 8, 9, 23, 59))).toBe('2026-09-09');
    expect(localDateStr(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});

describe('splitTitle', () => {
  it('splits headline from note on the first spaced hyphen', () => {
    expect(splitTitle('Water Night - Poster Contest kicks off'))
      .toEqual({ title: 'Water Night', note: 'Poster Contest kicks off' });
    expect(splitTitle('Awards Night - final night of the year!'))
      .toEqual({ title: 'Awards Night', note: 'final night of the year!' });
  });

  it('leaves plain and hyphenated titles alone', () => {
    expect(splitTitle('Backwards Night')).toEqual({ title: 'Backwards Night', note: '' });
    expect(splitTitle('Glow-in-the-dark Night')).toEqual({ title: 'Glow-in-the-dark Night', note: '' });
    expect(splitTitle('A - B - C')).toEqual({ title: 'A', note: 'B - C' });
    expect(splitTitle('')).toEqual({ title: '', note: '' });
  });
});

describe('isStoreNight', () => {
  it('matches any store mention, case-insensitively', () => {
    expect(isStoreNight('Awana Store Night')).toBe(true);
    expect(isStoreNight('STORE night - bring your shekels')).toBe(true);
    expect(isStoreNight('Water Night')).toBe(false);
  });
});

describe('formatShortDate', () => {
  it('formats via the local constructor (never UTC parsing)', () => {
    expect(formatShortDate('2026-09-09')).toBe('Wed, Sep 9');
    expect(formatShortDate('2027-05-26')).toBe('Wed, May 26');
    expect(formatShortDate('garbage')).toBe('');
  });
});

describe('daysBetween', () => {
  it('is exact across the November DST fall-back', () => {
    expect(daysBetween('2026-10-28', '2026-11-04')).toBe(7);
  });
  it('handles same-day and reversed order', () => {
    expect(daysBetween('2026-09-09', '2026-09-09')).toBe(0);
    expect(daysBetween('2026-09-16', '2026-09-09')).toBe(-7);
  });
});

describe('deriveClubInfo', () => {
  const season = [
    cancelled('2026-08-26'),
    club('2026-09-09', 'Water Night - Poster Contest kicks off'),
    club('2026-09-16'),
    cancelled('2026-09-23'),
    club('2026-09-30'),
    note('2026-10-03', 'Build Day'),
    club('2026-10-07', 'Awards Night - final night of the year!'),
  ];

  it('finds tonight by exact local-date match', () => {
    const info = deriveClubInfo(season, '2026-09-09');
    expect(info.tonight?.title).toContain('Water Night');
    expect(info.nextEntry?.date).toBe('2026-09-16');
    expect(info.nightsRemaining).toBe(3); // 16th, 30th, Oct 7 — after tonight
  });

  it('a cancelled date is not "tonight"', () => {
    const info = deriveClubInfo(season, '2026-09-23');
    expect(info.tonight).toBeNull();
    expect(info.nextNight?.date).toBe('2026-09-30');
  });

  it('nextEntry sees cancelled weeks, nextNight skips them', () => {
    const info = deriveClubInfo(season, '2026-09-16');
    expect(info.nextEntry?.isCancelled).toBe(true);
    expect(info.nextNight?.date).toBe('2026-09-30');
  });

  it('day-notes never count as club nights or remaining nights', () => {
    const info = deriveClubInfo(season, '2026-09-30');
    expect(info.nextEntry?.date).toBe('2026-10-07'); // skips the Build Day note
    expect(info.nightsRemaining).toBe(1);
  });

  it('flags season end', () => {
    const info = deriveClubInfo(season, '2026-10-07');
    expect(info.tonight?.title).toContain('Awards Night');
    expect(info.nightsRemaining).toBe(0);
    expect(info.seasonOver).toBe(true);
  });

  it('tolerates garbage input', () => {
    expect(deriveClubInfo(null, '2026-09-09').tonight).toBeNull();
    expect(deriveClubInfo([{}, null, 'x'], '2026-09-09').nightsRemaining).toBe(0);
  });
});

describe('buildCalendarSlides', () => {
  const ids = (slides) => slides.map((s) => s.id);
  const byId = (slides, id) => slides.find((s) => s.id === id);

  it('special tonight → "Welcome to X!" with the note as subtext', () => {
    const info = deriveClubInfo([club('2026-09-09', 'Water Night - Poster Contest kicks off'), club('2026-09-16')], '2026-09-09');
    const welcome = byId(buildCalendarSlides(info, {}), 'cal_welcome');
    expect(welcome.text).toBe('Welcome to Water Night!');
    expect(welcome.subtext).toBe('Poster Contest kicks off');
    expect(welcome.eyebrow).toBe('Tonight');
  });

  it('regular tonight → configurable welcome wording', () => {
    const info = deriveClubInfo([club('2026-09-16'), club('2026-09-23')], '2026-09-16');
    const slides = buildCalendarSlides(info, { calendarWelcomeText: 'Welcome to KVB Awana!' });
    expect(byId(slides, 'cal_welcome').text).toBe('Welcome to KVB Awana!');
  });

  it('off-day → points at the next night; special titles announced, regular just dated', () => {
    const special = deriveClubInfo([club('2026-09-09', 'Water Night')], '2026-09-07');
    expect(byId(buildCalendarSlides(special, {}), 'cal_welcome').text).toBe('Water Night — Wed, Sep 9');

    const regular = deriveClubInfo([club('2026-09-16')], '2026-09-14');
    expect(byId(buildCalendarSlides(regular, {}), 'cal_welcome').text).toBe('See you Wed, Sep 16!');
  });

  it('off-day store night is NEVER announced by name', () => {
    const info = deriveClubInfo([club('2026-09-16', 'Awana Store Night')], '2026-09-14');
    const welcome = byId(buildCalendarSlides(info, {}), 'cal_welcome');
    expect(welcome.text).toBe('See you Wed, Sep 16!');
    expect(JSON.stringify(buildCalendarSlides(info, {}))).not.toMatch(/store/i);
  });

  it('next week special → announcement slide with note', () => {
    const info = deriveClubInfo([club('2026-09-09'), club('2026-09-16', 'Backwards Night')], '2026-09-09');
    const next = byId(buildCalendarSlides(info, {}), 'cal_next');
    expect(next.text).toBe('Next week is Backwards Night!');
  });

  it('next week cancelled → "No club next week"', () => {
    const info = deriveClubInfo([club('2026-09-09'), cancelled('2026-09-16')], '2026-09-09');
    const next = byId(buildCalendarSlides(info, {}), 'cal_next');
    expect(next.text).toBe('No club next week');
    expect(next.subtext).toBe('No Awana this week');
  });

  it('next week regular → weather slide instead', () => {
    const info = deriveClubInfo([club('2026-09-09'), club('2026-09-16')], '2026-09-09');
    const slides = buildCalendarSlides(info, {});
    expect(byId(slides, 'cal_weather')).toEqual({ id: 'cal_weather', type: 'weather', durationSec: 0 });
    expect(byId(slides, 'cal_next')).toBeUndefined();
  });

  it('next week is the store → weather slide, title never leaks', () => {
    const info = deriveClubInfo([club('2026-09-09'), club('2026-09-16', 'Awana Store Night - bring shekels')], '2026-09-09');
    const slides = buildCalendarSlides(info, {});
    expect(byId(slides, 'cal_weather')).toBeTruthy();
    expect(JSON.stringify(slides)).not.toMatch(/store|shekel/i);
  });

  it('store tonight IS disclosed (masking is forward-looking only)', () => {
    const info = deriveClubInfo([club('2026-09-09', 'Awana Store Night'), club('2026-09-16')], '2026-09-09');
    expect(byId(buildCalendarSlides(info, {}), 'cal_welcome').text).toBe('Welcome to Awana Store Night!');
  });

  it('long break → "Coming up" phrasing instead of "next week"', () => {
    const info = deriveClubInfo([club('2026-12-16'), club('2027-01-06', 'Backwards Night')], '2026-12-16');
    const next = byId(buildCalendarSlides(info, {}), 'cal_next');
    expect(next.text).toBe('Coming up: Backwards Night — Wed, Jan 6');
  });

  it('night before the finale reads "Next week is Awards Night!"', () => {
    const info = deriveClubInfo(
      [club('2027-05-19'), club('2027-05-26', 'Awards Night - final night of the year!')],
      '2027-05-19'
    );
    const slides = buildCalendarSlides(info, {});
    expect(byId(slides, 'cal_next').text).toBe('Next week is Awards Night!');
    expect(byId(slides, 'cal_remaining').text).toBe('1 night remaining');
  });

  it('remaining slide shows only for 1–9 nights, with the book nudge', () => {
    const many = Array.from({ length: 12 }, (_, i) => club(`2026-10-${String(i + 10).padStart(2, '0')}`));
    expect(ids(buildCalendarSlides(deriveClubInfo(many, '2026-10-09'), {}))).not.toContain('cal_remaining');

    const nine = many.slice(0, 10); // tonight + 9 after
    const info = deriveClubInfo(nine, '2026-10-10');
    const remaining = byId(buildCalendarSlides(info, {}), 'cal_remaining');
    expect(remaining.text).toBe('9 nights remaining');
    expect(remaining.subtext).toBe('Is your child on track to finish their book?');
  });

  it('final night shows no remaining slide (0 after tonight)', () => {
    const info = deriveClubInfo([club('2027-05-26', 'Awards Night')], '2027-05-26');
    expect(ids(buildCalendarSlides(info, {}))).not.toContain('cal_remaining');
  });

  it('per-slide config toggles remove exactly their slide', () => {
    const info = deriveClubInfo([club('2026-09-09'), club('2026-09-16'), club('2026-09-23')], '2026-09-09');
    expect(ids(buildCalendarSlides(info, { calendarShowWelcome: false }))).not.toContain('cal_welcome');
    expect(ids(buildCalendarSlides(info, { calendarShowWeather: false }))).not.toContain('cal_weather');
    expect(ids(buildCalendarSlides(info, { calendarShowRemaining: false }))).not.toContain('cal_remaining');
    expect(ids(buildCalendarSlides(info, { calendarShowNextWeek: false }))).not.toContain('cal_weather');
  });

  it('every text slide looks like a valid manual slide', () => {
    const info = deriveClubInfo(
      [club('2026-09-09', 'Water Night - fun'), cancelled('2026-09-16'), club('2026-09-23')],
      '2026-09-09'
    );
    for (const s of buildCalendarSlides(info, {})) {
      if (s.type === 'weather') continue;
      expect(typeof s.id).toBe('string');
      expect(s.text.length).toBeGreaterThan(0);
      expect(['sky', 'sunset', 'night', 'meadow', 'lavender']).toContain(s.theme);
      expect(s.durationSec).toBe(0);
    }
  });

  it('returns [] for null info or empty calendars', () => {
    expect(buildCalendarSlides(null, {})).toEqual([]);
    const empty = deriveClubInfo([], '2026-09-09');
    // seasonOver && no tonight → just the weather slide slot
    expect(ids(buildCalendarSlides(empty, {}))).toEqual(['cal_weather']);
    expect(buildCalendarSlides(empty, { calendarShowWeather: false })).toEqual([]);
  });
});
