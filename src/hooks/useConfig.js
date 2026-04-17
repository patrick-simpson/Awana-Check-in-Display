import { useCallback, useEffect, useState } from 'react';
import defaults from '../config.js';

const STORAGE_KEY = 'awanaConfig.v1';

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* localStorage may be blocked; fall back to in-memory only */
  }
}

/**
 * Merges the defaults from src/config.js with any per-device overrides
 * the user has set via the runtime Settings panel. Overrides win.
 */
export function useConfig() {
  const [overrides, setOverrides] = useState(loadOverrides);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setOverrides(loadOverrides());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const config = {
    ...defaults,
    audioMuted: !defaults.audioEnabledByDefault,
    ...overrides,
  };

  const updateConfig = useCallback((patch) => {
    setOverrides((prev) => {
      const next = { ...prev, ...patch };
      saveOverrides(next);
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setOverrides({});
  }, []);

  return { config, updateConfig, resetConfig };
}
