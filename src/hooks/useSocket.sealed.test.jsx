import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// The socket layer's encrypted-transport behaviour. Three things here are the
// genuinely new bug surface introduced by sealing the name-bearing events, and
// all three fail silently in production if they regress:
//
//   1. ANTI-DOWNGRADE. If a screen holds a key, a PLAINTEXT name event must be
//      refused. Without this the encryption is decorative — anyone able to
//      publish just sends unsealed frames and the screen renders them.
//   2. ORDER. crypto.subtle.decrypt is async inside what Pusher calls as a
//      synchronous handler, so two check-ins milliseconds apart could resolve
//      out of order and greet the second child first. The REAL guard for that is
//      useSocket.order.test.jsx, which injects decrypt latency — against actual
//      WebCrypto the decrypts happen to resolve in submission order, so the
//      burst case below passes even with the chain removed. It is kept as a
//      smoke test of the happy path, not as the ordering guarantee.
//   3. THE SANITIZER STILL RUNS. Decryption sits IN FRONT of dispatchEvent, not
//      beside it, so an opened payload is still reduced to its allowlisted
//      fields. A sealed frame is authenticated, not trusted.

/** The one fake channel every test drives. */
let bound = {};
let connectionHandlers = {};

vi.mock('pusher-js', () => ({
  default: class FakePusher {
    constructor() {
      this.connection = {
        state: 'connected',
        bind: (evt, fn) => { connectionHandlers[evt] = fn; },
        unbind: () => {},
      };
    }
    subscribe() {
      return {
        bind: (evt, fn) => { bound[evt] = fn; },
        unbind_all: () => {},
      };
    }
    unsubscribe() {}
    disconnect() {}
    connect() {}
  },
}));

const { useSocket } = await import('./useSocket.js');
const { sealForTest, fromBase64 } = await import('./../lib/envelope.js');
const { saveDisplayKey } = await import('./../lib/displayKey.js');
const fixture = (await import('./../lib/__fixtures__/envelope-vectors.json')).default;

const KEY = fixture.testKey;
// The sanitizers require `at` to parse to epoch ms, so a placeholder string
// would make these tests pass for the wrong reason (rejected, not delivered).
const AT = '2026-08-01T23:30:00.000Z';
const keyBytes = () => fromBase64(KEY);

/** Emit a frame on the fake channel exactly as pusher-js would. */
const emit = (event, payload) => act(() => { bound[event]?.(payload); });

function setup(handlers) {
  localStorage.setItem('awanaConfig.v1', JSON.stringify({
    pusherAppKey: 'testkey', pusherCluster: 'us2',
  }));
  return renderHook(() => useSocket(handlers));
}

beforeEach(() => {
  bound = {};
  connectionHandlers = {};
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('with no display key (rollout mode)', () => {
  it('accepts plaintext check-ins exactly as before', async () => {
    const onCheckin = vi.fn();
    setup({ onCheckin });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));
    emit('checkin', { firstName: 'Amy', club: 'Sparks' });
    expect(onCheckin).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Amy', club: 'Sparks' }));
  });

  it('reports no-key once sealed frames start arriving that it cannot read', async () => {
    const onCheckin = vi.fn();
    const { result } = setup({ onCheckin });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));
    const env = await sealForTest(keyBytes(), 'checkin', { firstName: 'Amy', club: 'Sparks' });

    // One failure must NOT raise the alarm — a single corrupt frame on flaky TV
    // Wi-Fi should not put a scary sticker on the lobby wall mid-service.
    emit('checkin', env);
    await waitFor(() => expect(onCheckin).not.toHaveBeenCalled());
    expect(result.current.nameStatus).toBe('ok');

    emit('checkin', env);
    await waitFor(() => expect(result.current.nameStatus).toBe('no-key'));
    // And nothing was rendered from a frame it could not open.
    expect(onCheckin).not.toHaveBeenCalled();
  });
});

describe('with a display key', () => {
  it('opens a sealed check-in and renders it', async () => {
    saveDisplayKey(KEY);
    const onCheckin = vi.fn();
    const { result } = setup({ onCheckin });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));

    const env = await sealForTest(keyBytes(), 'checkin', {
      firstName: 'Amy', club: 'Sparks', isBirthday: true,
    });
    emit('checkin', env);
    await waitFor(() => expect(onCheckin).toHaveBeenCalled());
    expect(onCheckin.mock.calls[0][0]).toMatchObject({
      firstName: 'Amy', club: 'Sparks', isBirthday: true,
    });
    expect(result.current.nameStatus).toBe('ok');
    expect(result.current.lastCheckinAt).toBeTruthy();
  });

  it('REFUSES a plaintext check-in — the anti-downgrade rule', async () => {
    saveDisplayKey(KEY);
    const onCheckin = vi.fn();
    const { result } = setup({ onCheckin });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));
    // Wait for the key to finish importing, or the frame is legitimately
    // treated as arriving before this screen was keyed.
    await waitFor(() => expect(result.current.hasDisplayKey).toBe(true));

    emit('checkin', { firstName: 'Attacker', club: 'Sparks' });
    await waitFor(() => expect(result.current.nameStatus).toBe('downgraded'));
    expect(onCheckin).not.toHaveBeenCalled();
  });

  it('refuses plaintext on every name-bearing event, not just checkin', async () => {
    saveDisplayKey(KEY);
    const handlers = { onCheckin: vi.fn(), onRecap: vi.fn(), onBirthdays: vi.fn() };
    const { result } = setup(handlers);
    await waitFor(() => expect(bound.recap).toBeTypeOf('function'));
    await waitFor(() => expect(result.current.hasDisplayKey).toBe(true));

    emit('recap', { entries: [{ id: 'a', at: AT, firstName: 'Amy' }], at: AT });
    emit('birthdays', { entries: [{ firstName: 'Amy', month: 8, day: 1 }], at: AT });
    await waitFor(() => expect(result.current.nameStatus).toBe('downgraded'));
    expect(handlers.onRecap).not.toHaveBeenCalled();
    expect(handlers.onBirthdays).not.toHaveBeenCalled();
  });

  it('leaves the seven plaintext events completely alone', async () => {
    saveDisplayKey(KEY);
    const handlers = { onTally: vi.fn(), onNotice: vi.fn(), onTonight: vi.fn() };
    const { result } = setup(handlers);
    await waitFor(() => expect(bound.tally).toBeTypeOf('function'));
    await waitFor(() => expect(result.current.hasDisplayKey).toBe(true));

    // These must stay readable even with a key set — that readability is what
    // lets a screen tell "pipe down" from "cannot read names" from "quiet night".
    emit('tally', { counts: { Sparks: 4 }, total: 4, at: AT });
    emit('notice', { level: 'critical', message: 'CLUB CANCELLED TONIGHT', at: AT });
    emit('tonight', { checkedIn: 12, booksCompleted: 0, awardsEarned: 0, friendsBrought: 0, at: AT });
    expect(handlers.onTally).toHaveBeenCalled();
    expect(handlers.onNotice).toHaveBeenCalled();
    expect(handlers.onTonight).toHaveBeenCalled();
    expect(result.current.nameStatus).toBe('ok');
  });

  it('reports bad-key when frames are sealed with a different key', async () => {
    saveDisplayKey(KEY);
    const onCheckin = vi.fn();
    const { result } = setup({ onCheckin });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));
    await waitFor(() => expect(result.current.hasDisplayKey).toBe(true));

    const otherKey = new Uint8Array(32).fill(9);
    for (let i = 0; i < 2; i++) {
      emit('checkin', await sealForTest(otherKey, 'checkin', { firstName: 'Amy', club: 'Sparks' }));
    }
    await waitFor(() => expect(result.current.nameStatus).toBe('bad-key'));
    expect(onCheckin).not.toHaveBeenCalled();
  });

  it('drops a frame whose ciphertext was tampered with', async () => {
    saveDisplayKey(KEY);
    const onCheckin = vi.fn();
    const { result } = setup({ onCheckin });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));
    await waitFor(() => expect(result.current.hasDisplayKey).toBe(true));

    const env = await sealForTest(keyBytes(), 'checkin', { firstName: 'Amy', club: 'Sparks' });
    const ct = fromBase64(env.ct);
    ct[9] ^= 0x01;
    let bin = '';
    for (const b of ct) bin += String.fromCharCode(b);
    emit('checkin', { ...env, ct: btoa(bin) });
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(onCheckin).not.toHaveBeenCalled();
  });

  // Smoke test only — see the note at the top of this file. The load-bearing
  // ordering assertion lives in useSocket.order.test.jsx.
  it('delivers a whole burst of sealed check-ins', async () => {
    saveDisplayKey(KEY);
    const seen = [];
    const { result } = setup({ onCheckin: (c) => seen.push(c.firstName) });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));
    await waitFor(() => expect(result.current.hasDisplayKey).toBe(true));

    // Ten children through the door in one burst — none may be dropped.
    const names = ['Ann', 'Ben', 'Cara', 'Dan', 'Eve', 'Finn', 'Gus', 'Hana', 'Ivan', 'Jo'];
    const frames = [];
    for (const n of names) {
      frames.push(await sealForTest(keyBytes(), 'checkin', { firstName: n, club: 'Sparks' }));
    }
    await act(async () => { for (const f of frames) bound.checkin(f); });
    await waitFor(() => expect(seen).toHaveLength(names.length));
    expect(seen).toEqual(names);
  });

  it('still runs the allowlist sanitizer on an OPENED payload', async () => {
    saveDisplayKey(KEY);
    const onCheckin = vi.fn();
    const { result } = setup({ onCheckin });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));
    await waitFor(() => expect(result.current.hasDisplayKey).toBe(true));

    // A frame that authenticates is not a frame that is trusted. Sealing proves
    // the PUBLISHER wrote it; it says nothing about whether the publisher had a
    // bug that put a last name or an allergy in the payload. The sanitizer is
    // still the privacy boundary and must still strip everything.
    emit('checkin', await sealForTest(keyBytes(), 'checkin', {
      firstName: 'Amy',
      club: 'Sparks',
      lastName: 'Hendricks',
      allergies: 'peanuts',
      parentPhone: '555-0123',
      birthYear: 2017,
    }));
    await waitFor(() => expect(onCheckin).toHaveBeenCalled());
    const got = onCheckin.mock.calls[0][0];
    expect(got).toEqual({
      firstName: 'Amy', club: 'Sparks', isBirthday: false, isFirstTimer: false,
    });
    for (const leaked of ['lastName', 'allergies', 'parentPhone', 'birthYear']) {
      expect(got).not.toHaveProperty(leaked);
    }
  });

  it('drops a sealed frame that fails its sanitizer after opening', async () => {
    saveDisplayKey(KEY);
    const onCheckin = vi.fn();
    const { result } = setup({ onCheckin });
    await waitFor(() => expect(bound.checkin).toBeTypeOf('function'));
    await waitFor(() => expect(result.current.hasDisplayKey).toBe(true));
    // No usable firstName — authenticated, but not renderable.
    emit('checkin', await sealForTest(keyBytes(), 'checkin', { club: 'Sparks' }));
    await waitFor(() => expect(result.current.nameStatus).toBe('ok'));
    expect(onCheckin).not.toHaveBeenCalled();
  });
});
