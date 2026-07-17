// Pure club-night phase resolution — where are we in tonight's program?
// The shared schedule is hosted by the countdown repo's Pages site
// (…/KVBC-Awana-Countdown/shared/schedule.json); useSchedule fetches it
// with a cache and this baked fallback underneath.
//
// Phases drive presentation, not logic-critical behavior: after the
// ceremony starts, live check-in banners switch to the calm 'late'
// styling and the chime ducks, so a straggler's arrival doesn't blast
// over the pledges happening in the next room.

export const PHASES = ['off', 'countdown', 'ceremony', 'game-time', 'closing', 'shutdown'];

// shared/schedule.json window `kind` → display phase.
const KIND_TO_PHASE = {
  slideshow: (w) => (w.deck === 'closing' ? 'closing' : 'ceremony'),
  game: () => 'game-time',
  shutdown: () => 'shutdown',
};

// Baked KVBC fallback — mirrors shared/schedule.json in the countdown
// repo, already reduced to phases.
export const DEFAULT_SCHEDULE = {
  meetingDay: 3, // Wednesday
  windows: [
    { start: '18:00', end: '18:05', phase: 'ceremony' },
    { start: '18:05', end: '19:30', phase: 'game-time' },
    { start: '19:30', end: '19:35', phase: 'closing' },
    { start: '19:35', end: '24:00', phase: 'shutdown' },
  ],
};

function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof s === 'string' ? s.trim() : '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Strict-parse a fetched shared/schedule.json into { meetingDay,
 * windows: [{start, end, phase}] }; null on anything malformed so a bad
 * deploy of the shared file can never break the display — the baked
 * DEFAULT_SCHEDULE takes over instead.
 */
export function sanitizeSchedule(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const meetingDay = Number(raw.meeting?.day);
  if (!Number.isInteger(meetingDay) || meetingDay < 0 || meetingDay > 6) return null;
  if (!Array.isArray(raw.windows) || raw.windows.length === 0) return null;
  const windows = [];
  for (const w of raw.windows.slice(0, 20)) {
    if (!w || typeof w !== 'object') return null;
    const start = parseHM(w.start);
    const end = parseHM(w.end);
    const toPhase = KIND_TO_PHASE[w.kind];
    if (start === null || end === null || !toPhase || end <= start) return null;
    windows.push({ start: w.start, end: w.end, phase: toPhase(w) });
  }
  return { meetingDay, windows };
}

/**
 * The current program phase, as a pure function of the schedule and a
 * Date. Non-meeting days are 'off'; a meeting day before the first
 * window is 'countdown'.
 */
export function resolvePhase(schedule, now = new Date()) {
  const s = schedule && Array.isArray(schedule.windows) && schedule.windows.length
    ? schedule
    : DEFAULT_SCHEDULE;
  if (now.getDay() !== s.meetingDay) return 'off';
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const w of s.windows) {
    const start = parseHM(w.start);
    const end = parseHM(w.end);
    if (start !== null && end !== null && mins >= start && mins < end) return w.phase;
  }
  const first = parseHM(s.windows[0]?.start);
  if (first !== null && mins < first) return 'countdown';
  return 'shutdown';
}

/**
 * Live banners arriving after the ceremony has started get the calm
 * treatment: the room is mid-program, so no confetti cannon and a
 * ducked chime.
 */
export function isLatePhase(phase) {
  return phase === 'ceremony' || phase === 'game-time' || phase === 'closing';
}
