import { useEffect, useState } from 'react';
import { DEFAULT_SCHEDULE, resolvePhase, sanitizeSchedule } from '../lib/schedule.js';

// Fetch → cache → baked default, in that order. The shared schedule is
// published by the countdown repo's Pages site so all three Awana apps
// read the same program; a display with no network still resolves
// phases from cache or the baked KVBC fallback.
const CACHE_KEY = 'awanaSchedule.v1';
const REFRESH_MS = 6 * 60 * 60 * 1000;
const TICK_MS = 30 * 1000;

function loadCache() {
  try {
    return sanitizeSchedule(JSON.parse(localStorage.getItem(CACHE_KEY))?.raw);
  } catch {
    return null;
  }
}

function saveCache(raw) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: new Date().toISOString(), raw }));
  } catch {
    /* best-effort */
  }
}

/**
 * Returns { phase, schedule, source } — phase re-resolves every 30 s
 * so banner styling flips on the program boundaries without a reload.
 */
export function useSchedule(config) {
  const url = config.sharedScheduleUrl;
  const [state, setState] = useState(() => {
    const cached = loadCache();
    return cached
      ? { schedule: cached, source: 'cache' }
      : { schedule: DEFAULT_SCHEDULE, source: 'default' };
  });
  // Phase is derived, not stored: a 30 s clock tick re-renders and
  // resolvePhase(schedule, now) recomputes — so it also flips
  // immediately when a fresh schedule arrives.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const phase = resolvePhase(state.schedule, now);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) return;
        const raw = await res.json();
        const clean = sanitizeSchedule(raw);
        if (clean && !cancelled) {
          saveCache(raw);
          setState({ schedule: clean, source: 'shared' });
        }
      } catch {
        /* offline / CORS / bad deploy — cache or default carries on */
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [url]);

  return { phase, schedule: state.schedule, source: state.source };
}
