import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { useConfig } from './useConfig.js';

// Reads the Pusher key/cluster from config, subscribes to
// `awana-channel`, and forwards `checkin` payloads after sanitizing
// them to the four public fields, so allergy/PII data can never reach
// the screen.
export function useSocket(onCheckIn) {
  const { config } = useConfig();
  const { pusherAppKey, pusherCluster } = config;
  const enabled = Boolean(pusherAppKey && pusherCluster);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const handlerRef = useRef(onCheckIn);
  useEffect(() => { handlerRef.current = onCheckIn; }, [onCheckIn]);

  useEffect(() => {
    if (!enabled) return undefined;
    const pusher = new Pusher(pusherAppKey, { cluster: pusherCluster });
    const map = { initialized: 'connecting', connecting: 'connecting', connected: 'connected', unavailable: 'disconnected', failed: 'disconnected', disconnected: 'disconnected' };
    const onStateChange = ({ current }) => setSocketStatus(map[current] || 'disconnected');
    pusher.connection.bind('state_change', onStateChange);
    const channel = pusher.subscribe('awana-channel');
    channel.bind('pusher:subscription_error', (err) => {
      console.error('Pusher subscription failed:', err);
      setSocketStatus('disconnected');
    });
    channel.bind('checkin', (payload) => {
      const safe = sanitize(payload);
      if (safe) handlerRef.current?.(safe);
    });
    return () => {
      // Unbind before disconnecting so the dying connection's final
      // state events can't clobber the status of a replacement socket.
      pusher.connection.unbind('state_change', onStateChange);
      channel.unbind_all();
      pusher.unsubscribe('awana-channel');
      pusher.disconnect();
    };
  }, [enabled, pusherAppKey, pusherCluster]);

  return { status: enabled ? socketStatus : 'disconnected' };
}

// PRIVACY INVARIANT — DO NOT relax. Every incoming payload is reduced
// to exactly these four fields before anything else sees it: allergy
// info, contact info, last names, photos, and any future fields the
// check-in system might send must never reach the display.
export function sanitize(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const firstName = typeof payload.firstName === 'string' ? payload.firstName.trim().slice(0, 40) : '';
  if (!firstName) return null;
  return {
    firstName,
    club: typeof payload.club === 'string' ? payload.club.trim().slice(0, 40) : '',
    isBirthday: payload.isBirthday === true,
    isFirstTimer: payload.isFirstTimer === true,
  };
}
