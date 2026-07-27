import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { useConfig } from './useConfig.js';
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
  const enabled = Boolean(pusherAppKey && pusherCluster);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [lastEventAt, setLastEventAt] = useState(null);
  const [lastCheckinAt, setLastCheckinAt] = useState(null);
  const [retry, setRetry] = useState(null);
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; }, [handlers]);

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

    for (const [event, sanitizeEvent] of Object.entries(EVENT_SANITIZERS)) {
      channel.bind(event, (payload) => {
        const safe = sanitizeEvent(payload);
        if (!safe) return;
        setLastEventAt(Date.now());
        if (event === 'checkin') setLastCheckinAt(Date.now());
        const h = handlersRef.current;
        const fn = typeof h === 'function'
          ? (event === 'checkin' ? h : null)
          : h?.[HANDLER_NAMES[event]];
        fn?.(safe);
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
  };
}

// Historical export: the checkin sanitizer began life here and the
// privacy tests guard it under this name. It now lives with its five
// siblings in src/lib/eventSanitizers.js.
export { sanitizeCheckin as sanitize };
