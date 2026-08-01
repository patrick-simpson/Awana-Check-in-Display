import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { useConfig } from './useConfig.js';
import { useDisplayKey } from './useDisplayKey.js';
import {
  ENCRYPTED_EVENTS,
  importDisplayKey,
  isEnvelope,
  openEnvelope,
} from '../lib/envelope.js';
import {
  sanitizeBirthdays,
  sanitizeCanary,
  sanitizeCheckin,
  sanitizeNotice,
  sanitizeOps,
  sanitizePoints,
  sanitizeRecap,
  sanitizeSchedule,
  sanitizeTally,
  sanitizeTonight,
} from '../lib/eventSanitizers.js';

// PRIVACY INVARIANT — DO NOT relax. Every event type on the channel is
// bound through its own strict allowlist sanitizer from
// src/lib/eventSanitizers.js, so allergy/PII data can never reach the
// screen no matter what the producer (or an attacker with the publish
// key) sends. Payload shapes are pinned by the mirrored contract
// vectors — see CONTRACT.md.
const EVENT_SANITIZERS = {
  checkin: sanitizeCheckin,
  recap: sanitizeRecap,
  tally: sanitizeTally,
  birthdays: sanitizeBirthdays,
  ops: sanitizeOps,
  canary: sanitizeCanary,
  tonight: sanitizeTonight,
  points: sanitizePoints,
  schedule: sanitizeSchedule,
  notice: sanitizeNotice,
};

/**
 * The three events whose payloads carry a child's name arrive SEALED — see
 * src/lib/envelope.js for why and for the framing. Everything about the
 * decryption lives in this file and nowhere else, and it sits strictly IN FRONT
 * of `dispatchEvent`, never beside it, so an opened payload still passes its own
 * allowlist sanitizer exactly as a plaintext one does. `eventSanitizers.js` is
 * deliberately untouched by this change.
 */
const SEALED = new Set(ENCRYPTED_EVENTS);

/** Consecutive decrypt failures before a screen admits it cannot read names. */
const UNREADABLE_AFTER = 2;

// Handler-prop name for each wire event ('checkin' → onCheckin, …).
const HANDLER_NAMES = {
  checkin: 'onCheckin',
  recap: 'onRecap',
  tally: 'onTally',
  birthdays: 'onBirthdays',
  ops: 'onOps',
  canary: 'onCanary',
  tonight: 'onTonight',
  points: 'onPoints',
  schedule: 'onSchedule',
  notice: 'onNotice',
};

/**
 * Subscribes to `awana-channel` and forwards each event type to its
 * handler after sanitizing:
 *
 *   useSocket({ onCheckin, onRecap, onTally, onBirthdays, onOps, onCanary,
 *              onTonight, onPoints, onSchedule, onNotice })
 *
 * A bare function is accepted as shorthand for `{ onCheckin }`.
 * Returns { status, lastEventAt, lastCheckinAt, retry }.
 * `retry` is { attempts, delaySec } while the pipe is down (pusher-js
 * announces each backoff via its 'connecting_in' event), null otherwise
 * — so the Signal sticker can say "retrying in ~Ns" instead of a bare
 * "disconnected".
 */
export function useSocket(handlers) {
  const { config } = useConfig();
  const { pusherAppKey, pusherCluster } = config;
  const { displayKey } = useDisplayKey();
  const enabled = Boolean(pusherAppKey && pusherCluster);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [lastEventAt, setLastEventAt] = useState(null);
  const [lastCheckinAt, setLastCheckinAt] = useState(null);
  const [retry, setRetry] = useState(null);
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

  // ── Name readability ───────────────────────────────────────────────────────
  // A screen that simply stops showing banners is indistinguishable from a quiet
  // night, which is the single worst outcome of this whole change. So the socket
  // reports WHY names are missing, and App.jsx forces that onto the screen
  // regardless of the showConnectionStatus setting.
  //   'ok'          names are arriving and opening
  //   'no-key'      sealed frames are arriving but this screen has no key
  //   'bad-key'     sealed frames arrive and will not open (wrong/rotated key)
  //   'downgraded'  PLAINTEXT names arrived while a key is configured — refused
  const [nameStatus, setNameStatus] = useState('ok');
  const keyRef = useRef(null);
  const failuresRef = useRef(0);
  // One promise chain per sealed event. crypto.subtle.decrypt is async inside
  // what Pusher calls as a synchronous handler, so without this two check-ins
  // arriving milliseconds apart could resolve out of order and greet the second
  // child first. Chaining costs nothing at this volume and removes the whole
  // class of bug.
  const chainsRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    failuresRef.current = 0;
    // Clear the ref synchronously so a frame arriving in the microtask gap
    // below is never opened with the PREVIOUS key.
    keyRef.current = null;
    (displayKey ? importDisplayKey(displayKey) : Promise.resolve(null)).then((imported) => {
      if (cancelled) return;
      keyRef.current = imported;
      if (displayKey && !imported) {
        console.error('[socket] The display key on this screen is not usable — names will not appear');
        setNameStatus('bad-key');
      } else {
        // No key is not an error yet: until the publisher starts sealing, this is
        // the normal state and plaintext is accepted. It only becomes visible
        // when a sealed frame actually shows up and cannot be opened.
        setNameStatus('ok');
      }
    });
    return () => { cancelled = true; };
  }, [displayKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const pusher = new Pusher(pusherAppKey, { cluster: pusherCluster });
    const map = { initialized: 'connecting', connecting: 'connecting', connected: 'connected', unavailable: 'disconnected', failed: 'disconnected', disconnected: 'disconnected' };
    const onStateChange = ({ current }) => {
      setSocketStatus(map[current] || 'disconnected');
      if (current === 'connected') setRetry(null);
    };
    const onConnectingIn = (delaySec) => {
      setRetry((prev) => ({
        attempts: (prev?.attempts ?? 0) + 1,
        delaySec: Number.isFinite(delaySec) ? Math.round(delaySec) : null,
      }));
    };
    pusher.connection.bind('state_change', onStateChange);
    pusher.connection.bind('connecting_in', onConnectingIn);
    const channel = pusher.subscribe('awana-channel');
    channel.bind('pusher:subscription_error', (err) => {
      console.error('Pusher subscription failed:', err);
      setSocketStatus('disconnected');
    });

    // Bind every contract event. The sanitizing + handler lookup lives in
    // dispatchEvent so the debug panel's simulated events use the identical
    // path — see simulateEvent below.
    const accept = (event, payload) => {
      const safe = dispatchEvent(event, payload, handlersRef.current);
      if (!safe) return;
      setLastEventAt(Date.now());
      if (event === 'checkin') setLastCheckinAt(Date.now());
    };

    for (const event of Object.keys(EVENT_SANITIZERS)) {
      if (!SEALED.has(event)) {
        channel.bind(event, (payload) => accept(event, payload));
        continue;
      }

      channel.bind(event, (frame) => {
        // ANTI-DOWNGRADE. Once this screen holds a key, a PLAINTEXT payload on a
        // name-bearing event is refused. Without this the encryption would be
        // decorative: anyone able to publish could simply send unsealed frames
        // and the screen would render them. (Publishing needs the Pusher app
        // SECRET, not the public app key, so this is defence in depth rather
        // than the only lock — but it is the lock that belongs on the consumer.)
        if (keyRef.current && !isEnvelope(frame)) {
          console.error(
            `[socket] REFUSED a plaintext '${event}' — this screen has a display key, so names must arrive sealed`);
          setNameStatus('downgraded');
          return;
        }

        // No key configured: accept plaintext exactly as before. This is what
        // makes the rollout safe in either order — a screen that has not been
        // keyed yet keeps working against an unsealed publisher.
        if (!isEnvelope(frame)) {
          accept(event, frame);
          return;
        }

        const prev = chainsRef.current[event] || Promise.resolve();
        chainsRef.current[event] = prev
          .then(async () => {
            const result = await openEnvelope(keyRef.current, event, frame);
            if (result.ok) {
              failuresRef.current = 0;
              setNameStatus('ok');
              accept(event, result.payload);
              return;
            }
            // Count consecutive failures rather than reacting to one: a single
            // corrupt frame on a flaky TV Wi-Fi must not put a scary sticker on
            // the wall mid-service.
            failuresRef.current += 1;
            if (failuresRef.current >= UNREADABLE_AFTER) {
              setNameStatus(result.reason === 'no-key' ? 'no-key' : 'bad-key');
            }
            console.warn(`[socket] Could not open '${event}': ${result.reason}`);
          })
          // A throw here would poison the chain and silently stop every later
          // frame of this event for the rest of the night.
          .catch((err) => { console.error(`[socket] decrypt chain error on '${event}'`, err); });
      });
    }

    // When the TV wakes from sleep or the network returns, pusher-js can
    // take minutes to notice its socket is dead (activity-timeout + pong
    // cycle). Nudge it to reconnect immediately so the first kid through
    // the door still gets a banner.
    const nudge = () => {
      const state = pusher.connection.state;
      if (state === 'disconnected' || state === 'unavailable' || state === 'failed') {
        pusher.connect();
      }
    };
    const onVisible = () => { if (!document.hidden) nudge(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', nudge);
    window.addEventListener('focus', nudge);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', nudge);
      window.removeEventListener('focus', nudge);
      // Unbind before disconnecting so the dying connection's final
      // state events can't clobber the status of a replacement socket.
      pusher.connection.unbind('state_change', onStateChange);
      pusher.connection.unbind('connecting_in', onConnectingIn);
      channel.unbind_all();
      pusher.unsubscribe('awana-channel');
      pusher.disconnect();
    };
  }, [enabled, pusherAppKey, pusherCluster]);

  // 'off' (not configured) is distinct from 'disconnected' (configured
  // but the pipe is down) so the UI can warn about the latter without
  // nagging brand-new installs.
  return {
    status: enabled ? socketStatus : 'off',
    lastEventAt,
    lastCheckinAt,
    retry: enabled && socketStatus !== 'connected' ? retry : null,
    // Independent of `status` on purpose: a screen can be perfectly connected,
    // showing a live clock, weather and climbing counts, and still be unable to
    // read a single name. Those are different faults with different fixes, so
    // they get different words on the wall.
    nameStatus: enabled ? nameStatus : 'ok',
    hasDisplayKey: Boolean(displayKey),
  };
}

// Historical export: the checkin sanitizer began life here and the
// privacy tests guard it under this name. It now lives with its five
// siblings in src/lib/eventSanitizers.js.
export { sanitizeCheckin as sanitize };

/**
 * Sanitize one wire payload and hand it to its bound handler.
 *
 * PRIVACY INVARIANT — this is the ONE dispatch path. The live Pusher binding
 * above calls it, and so does `simulateEvent()` below, so a simulated event is
 * filtered by exactly the same allowlist sanitizer as a real one. Before this
 * was factored out, the debug panel called the render handlers directly and
 * every simulated payload bypassed the privacy boundary entirely — the one
 * thing this app's docs insist is inviolable.
 *
 * Returns the sanitized payload, or null when the sanitizer rejected it.
 *
 * @param {string} event Wire event name (a key of EVENT_SANITIZERS).
 * @param {unknown} payload Raw payload.
 * @param {*} handlers The handlers object (or bare checkin function).
 * @returns {object|null}
 */
export function dispatchEvent(event, payload, handlers) {
  const sanitizeEvent = EVENT_SANITIZERS[event];
  if (!sanitizeEvent) {
    console.warn(`[socket] Ignoring unknown event '${event}'`);
    return null;
  }
  const safe = sanitizeEvent(payload);
  if (!safe) return null;
  const fn = typeof handlers === 'function'
    ? (event === 'checkin' ? handlers : null)
    : handlers?.[HANDLER_NAMES[event]];
  fn?.(safe);
  return safe;
}

/**
 * Inject a simulated event — the debug panel's only route to the screen.
 *
 * Goes through `dispatchEvent`, so a malformed fake payload is dropped exactly
 * as a malformed real one would be. That makes the debug panel double as a live
 * contract check: if a simulator's shape drifts from the sanitizer's allowlist,
 * pressing the button visibly does nothing instead of rendering something the
 * wire could never actually deliver.
 *
 * Logs rejections, because "I pressed the button and nothing happened" is
 * otherwise indistinguishable from a broken screen.
 *
 * @param {string} event
 * @param {unknown} payload
 * @param {*} handlers
 * @returns {boolean} true when the event reached its handler.
 */
export function simulateEvent(event, payload, handlers) {
  const safe = dispatchEvent(event, payload, handlers);
  if (!safe) {
    console.warn(
      `[debug] Simulated '${event}' was REJECTED by its sanitizer — the fake payload does not match the contract`,
      payload,
    );
    return false;
  }
  return true;
}

/** Event names the debug panel may simulate. */
export const SIMULATABLE_EVENTS = Object.keys(EVENT_SANITIZERS);
