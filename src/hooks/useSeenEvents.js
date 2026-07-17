import { useCallback, useRef } from 'react';

// Dedupe ledger for checkin event ids: live delivery marks an id seen,
// recap replay skips anything already seen — so a display that stayed
// connected never double-banners a kid, while one that reconnects can
// replay what it missed. Persisted to sessionStorage so an accidental
// mid-club refresh doesn't re-celebrate the whole recap buffer.
const STORAGE_KEY = 'awanaSeenEvents.v1';
const MAX_ENTRIES = 500;

function loadMap() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (Array.isArray(raw)) {
      return new Map(raw.filter((p) => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'number'));
    }
  } catch {
    /* corrupt or blocked storage → start empty */
  }
  return new Map();
}

export function useSeenEvents() {
  const mapRef = useRef(null);
  if (mapRef.current === null) mapRef.current = loadMap();

  const persist = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...mapRef.current]));
    } catch {
      /* best-effort */
    }
  }, []);

  const hasSeen = useCallback((id) => mapRef.current.has(id), []);

  const markSeen = useCallback((id, at = Date.now()) => {
    if (typeof id !== 'string' || !id) return;
    const map = mapRef.current;
    map.set(id, at);
    // Trim oldest insertion first — Map preserves insertion order.
    while (map.size > MAX_ENTRIES) {
      map.delete(map.keys().next().value);
    }
    persist();
  }, [persist]);

  const stats = useCallback(() => ({ size: mapRef.current.size }), []);

  return { hasSeen, markSeen, stats };
}
