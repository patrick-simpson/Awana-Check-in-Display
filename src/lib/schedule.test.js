import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEDULE, isLatePhase, resolvePhase, sanitizeSchedule } from './schedule.js';

// Wed Sep 16 2026 is a Wednesday (meeting day 3).
const wed = (h, m) => new Date(2026, 8, 16, h, m);
const thu = (h, m) => new Date(2026, 8, 17, h, m);

// The real shared/schedule.json shape from the countdown repo.
const SHARED = {
  version: 1,
  timezone: 'America/New_York',
  meeting: { day: 3, start: '18:00' },
  windows: [
    { kind: 'slideshow', deck: 'opening', title: 'Opening Ceremony', start: '18:00', end: '18:05' },
    { kind: 'game', clubs: ['tnt'], title: 'T&T Game Time', start: '18:05', end: '18:30' },
    { kind: 'game', clubs: ['sparks'], title: 'Sparks Game Time', start: '18:30', end: '19:00' },
    { kind: 'game', clubs: ['cubbies', 'puggles'], title: 'Puggles & Cubbies', start: '19:00', end: '19:30' },
    { kind: 'slideshow', deck: 'closing', title: 'Closing', start: '19:30', end: '19:35' },
    { kind: 'shutdown', title: 'Shutdown', start: '19:35', end: '24:00' },
  ],
  specialDates: {},
};

describe('sanitizeSchedule', () => {
  it('parses the real shared schedule into phases', () => {
    const s = sanitizeSchedule(SHARED);
    expect(s.meetingDay).toBe(3);
    expect(s.windows.map((w) => w.phase)).toEqual([
      'ceremony', 'game-time', 'game-time', 'game-time', 'closing', 'shutdown',
    ]);
  });

  it('rejects malformed inputs instead of half-parsing them', () => {
    expect(sanitizeSchedule(null)).toBeNull();
    expect(sanitizeSchedule({})).toBeNull();
    expect(sanitizeSchedule({ meeting: { day: 9 }, windows: SHARED.windows })).toBeNull();
    expect(sanitizeSchedule({ meeting: { day: 3 }, windows: [] })).toBeNull();
    expect(sanitizeSchedule({ meeting: { day: 3 }, windows: [{ kind: 'game', start: 'six', end: '19:00' }] })).toBeNull();
    expect(sanitizeSchedule({ meeting: { day: 3 }, windows: [{ kind: 'mystery', start: '18:00', end: '19:00' }] })).toBeNull();
    expect(sanitizeSchedule({ meeting: { day: 3 }, windows: [{ kind: 'game', start: '19:00', end: '18:00' }] })).toBeNull();
  });
});

describe('resolvePhase', () => {
  const s = sanitizeSchedule(SHARED);

  it('walks the whole Wednesday program', () => {
    expect(resolvePhase(s, wed(17, 0))).toBe('countdown');
    expect(resolvePhase(s, wed(18, 0))).toBe('ceremony');
    expect(resolvePhase(s, wed(18, 4))).toBe('ceremony');
    expect(resolvePhase(s, wed(18, 5))).toBe('game-time');
    expect(resolvePhase(s, wed(19, 29))).toBe('game-time');
    expect(resolvePhase(s, wed(19, 30))).toBe('closing');
    expect(resolvePhase(s, wed(19, 35))).toBe('shutdown');
    expect(resolvePhase(s, wed(23, 59))).toBe('shutdown');
  });

  it('is off on non-meeting days', () => {
    expect(resolvePhase(s, thu(18, 30))).toBe('off');
  });

  it('falls back to the baked default on null schedule', () => {
    expect(resolvePhase(null, wed(18, 30))).toBe('game-time');
    expect(resolvePhase(undefined, thu(18, 30))).toBe('off');
    expect(DEFAULT_SCHEDULE.meetingDay).toBe(3);
  });
});

describe('isLatePhase', () => {
  it('is calm during the program, loud before it', () => {
    expect(isLatePhase('countdown')).toBe(false);
    expect(isLatePhase('off')).toBe(false);
    expect(isLatePhase('ceremony')).toBe(true);
    expect(isLatePhase('game-time')).toBe(true);
    expect(isLatePhase('closing')).toBe(true);
    expect(isLatePhase('shutdown')).toBe(false);
  });
});
