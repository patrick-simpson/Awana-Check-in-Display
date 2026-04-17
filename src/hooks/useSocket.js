import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { useConfig } from './useConfig.js';

// Ignores its first arg (kept for App.jsx compatibility) and reads the
// Pusher key/cluster from config. Subscribes to `awana-channel` and
// forwards `checkin` payloads after sanitizing them to the four public
// fields, so allergy/PII data can never reach the screen.
export function useSocket(_unused, onCheckIn) {
  const { config } = useConfig();
  const { pusherAppKey, pusherCluster } = config;
  const [status, setStatus] = useState('disconnected');
  const handlerRef = useRef(onCheckIn);
  useEffect(() => { handlerRef.current = onCheckIn; }, [onCheckIn]);

  useEffect(() => {
    if (!pusherAppKey || !pusherCluster) { setStatus('disconnected'); return undefined; }
    setStatus('connecting');
    const pusher = new Pusher(pusherAppKey, { cluster: pusherCluster });
    const map = { connected: 'connected', connecting: 'connecting', unavailable: 'disconnected', failed: 'disconnected', disconnected: 'disconnected' };
    pusher.connection.bind('state_change', ({ current }) => setStatus(map[current] || 'disconnected'));
    const channel = pusher.subscribe('awana-channel');
    channel.bind('checkin', (payload) => {
      const safe = sanitize(payload);
      if (safe) handlerRef.current?.(safe);
    });
    return () => { channel.unbind_all(); pusher.unsubscribe('awana-channel'); pusher.disconnect(); };
  }, [pusherAppKey, pusherCluster]);

  return { status };
}

function sanitize(payload) {
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
