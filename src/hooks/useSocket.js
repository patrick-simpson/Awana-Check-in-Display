import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Connects to the configured WebSocket URL and listens for `checkIn`
 * events. Validates the payload to strip any fields other than the four
 * public-facing ones before passing to the handler, so even a chatty
 * backend can't leak allergy or contact data to the screen.
 */
export function useSocket(url, onCheckIn) {
  const [status, setStatus] = useState('disconnected');
  // Keep the latest handler in a ref so changing it doesn't reopen the socket.
  const handlerRef = useRef(onCheckIn);
  useEffect(() => { handlerRef.current = onCheckIn; }, [onCheckIn]);

  useEffect(() => {
    if (!url) {
      setStatus('disconnected');
      return undefined;
    }

    setStatus('connecting');
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 8000,
    });

    socket.on('connect',    () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error',   () => setStatus('disconnected'));
    socket.on('reconnect_attempt', () => setStatus('connecting'));

    socket.on('checkIn', (payload) => {
      const safe = sanitize(payload);
      if (safe) handlerRef.current?.(safe);
    });

    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [url]);

  return { status };
}

function sanitize(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const firstName = typeof payload.firstName === 'string'
    ? payload.firstName.trim().slice(0, 40)
    : '';
  if (!firstName) return null;
  return {
    firstName,
    club: typeof payload.club === 'string' ? payload.club.trim().slice(0, 40) : '',
    isBirthday: payload.isBirthday === true,
    isFirstTimer: payload.isFirstTimer === true,
  };
}
