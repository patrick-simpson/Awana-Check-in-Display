// @ts-check
import { useCallback, useSyncExternalStore } from 'react';
import {
  getSnapshot,
  loadLoginKey,
  loginWithPassphrase,
  logout,
  subscribe,
} from '../lib/displayLogin.js';

/**
 * This screen's display-login state, for the Settings panels.
 *
 * Deliberately NOT part of useConfig: the login key lives in its own storage
 * slot for the same reasons the display key does. See src/lib/displayLogin.js.
 */
export function useDisplayLogin() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const login = useCallback((/** @type {string} */ passphrase) => loginWithPassphrase(passphrase), []);
  const doLogout = useCallback(() => logout(), []);
  return { ...snap, hasLoginKey: Boolean(loadLoginKey()), login, logout: doLogout };
}
