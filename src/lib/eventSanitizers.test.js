import { describe, expect, it } from 'vitest';
import vectors from './__fixtures__/contract-vectors.json';
import {
  sanitizeBirthdays,
  sanitizeCanary,
  sanitizeCheckin,
  sanitizeCheckout,
  sanitizeNotice,
  sanitizeOps,
  sanitizePoints,
  sanitizeRecap,
  sanitizeSchedule,
  sanitizeTally,
  sanitizeTonight,
} from './eventSanitizers.js';

// Data-driven over the mirrored contract vectors: every valid vector
// must survive its sanitizer with ONLY allowlisted keys; every dirty
// vector's PII must vanish; every reject vector must return null.
const SANITIZERS = {
  checkin: sanitizeCheckin,
  recap: sanitizeRecap,
  checkout: sanitizeCheckout,
  tally: sanitizeTally,
  birthdays: sanitizeBirthdays,
  ops: sanitizeOps,
  canary: sanitizeCanary,
  tonight: sanitizeTonight,
  points: sanitizePoints,
  schedule: sanitizeSchedule,
  notice: sanitizeNotice,
};

// The exact key set each sanitizer may emit (checkin `at` becomes epoch
// ms locally, so values differ from the wire shape but keys must not).
const ALLOWED_KEYS = {
  checkin: ['id', 'at', 'firstName', 'club', 'isBirthday', 'isFirstTimer'],
  recap: ['entries', 'at'],
  checkout: ['entries', 'at', 'printed'],
  tally: ['counts', 'total', 'at'],
  birthdays: ['entries'],
  ops: ['type', 'club', 'at'],
  canary: ['at', 'nonce'],
  tonight: ['checkedIn', 'booksCompleted', 'awardsEarned', 'friendsBrought', 'at'],
  points: ['groups', 'at', 'club'],
  schedule: ['at', 'nextMeetingDate', 'title', 'noClubThisWeek'],
  notice: ['level', 'message', 'at'],
};

describe('contract vectors are the v4 contract', () => {
  it('is contract version 4 on awana-channel', () => {
    expect(vectors.contractVersion).toBe(4);
    expect(vectors.channel).toBe('awana-channel');
  });

  it('covers every sanitizer we ship (and vice versa)', () => {
    expect(Object.keys(vectors.events).sort()).toEqual(Object.keys(SANITIZERS).sort());
  });
});

for (const [event, spec] of Object.entries(vectors.events)) {
  const sanitize = SANITIZERS[event];
  const allowed = ALLOWED_KEYS[event];

  describe(`sanitize ${event}`, () => {
    for (const [i, valid] of (spec.valid || []).entries()) {
      it(`accepts valid[${i}] with only allowlisted keys`, () => {
        const out = sanitize(valid);
        expect(out).not.toBeNull();
        for (const key of Object.keys(out)) {
          expect(allowed).toContain(key);
        }
        // Entries inside container events get the same key discipline.
        if (Array.isArray(out.entries)) {
          const entryAllowed = event === 'recap'
            ? ALLOWED_KEYS.checkin
            : ['firstName', 'club', 'month', 'day'];
          for (const e of out.entries) {
            for (const key of Object.keys(e)) expect(entryAllowed).toContain(key);
          }
        }
      });
    }

    for (const [i, dirty] of (spec.dirty || []).entries()) {
      it(`scrubs dirty[${i}]: ${dirty.reason}`, () => {
        const out = sanitize(dirty.payload);
        const raw = JSON.stringify(out ?? null);
        for (const banned of dirty.mustNotContain || []) {
          expect(raw).not.toContain(banned);
        }
        if (dirty.expectEntryCount !== undefined) {
          expect(out?.entries?.length ?? 0).toBe(dirty.expectEntryCount);
        }
      });
    }

    for (const [i, rej] of (spec.reject || []).entries()) {
      it(`rejects reject[${i}]: ${rej.reason}`, () => {
        expect(sanitize(rej.payload)).toBeNull();
      });
    }

    it('never throws on hostile input', () => {
      const hostile = [null, undefined, 0, '', 'x', [], [1], { entries: 0 }, { counts: [] }, () => {}, Symbol('x')];
      for (const h of hostile) {
        expect(() => sanitize(h)).not.toThrow();
      }
    });
  });
}

describe('checkin v2 specifics', () => {
  it('keeps id/at optional (v1 producers still work)', () => {
    const out = sanitizeCheckin({ firstName: 'Alice', club: 'Sparks', isBirthday: false, isFirstTimer: false });
    expect(out).toEqual({ firstName: 'Alice', club: 'Sparks', isBirthday: false, isFirstTimer: false });
  });

  it('converts at to epoch ms and caps id length', () => {
    const out = sanitizeCheckin({ firstName: 'Alice', at: '2026-09-16T22:05:11.000Z', id: 'x'.repeat(100) });
    expect(out.at).toBe(Date.parse('2026-09-16T22:05:11.000Z'));
    expect(out.id).toHaveLength(64);
  });
});

describe('recap specifics', () => {
  it('caps at 30 entries', () => {
    const entry = { id: 'a', at: '2026-09-16T22:05:11.000Z', firstName: 'Kid', club: 'Sparks' };
    const out = sanitizeRecap({ entries: Array.from({ length: 60 }, () => entry), at: '2026-09-16T22:07:00.000Z' });
    expect(out.entries).toHaveLength(30);
  });
});

describe('tally specifics', () => {
  it('caps clubs at 30 and floors floats', () => {
    const counts = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`Club${i}`, 1.9]));
    const out = sanitizeTally({ counts, total: 50, at: '2026-09-16T22:07:00.000Z' });
    expect(Object.keys(out.counts)).toHaveLength(30);
    expect(out.counts.Club0).toBe(1);
  });

  it('derives total when the payload omits it', () => {
    const out = sanitizeTally({ counts: { Sparks: 2, Trek: 3 }, at: '2026-09-16T22:07:00.000Z' });
    expect(out.total).toBe(5);
  });
});
