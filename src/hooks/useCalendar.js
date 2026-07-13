import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCalendarHtml, sanitizeEvents, sanitizeFeed } from '../lib/calendarParse.js';

// Three layers of "the screen must never go calendar-blind":
//   1. calendar-feed.json — built nightly by the GitHub Action and
//      shipped with the site (same-origin, no CORS, the normal path)
//   2. live scrape of the calendar page through a public CORS proxy
//      (only when the feed is missing or stale)
//   3. the last good proxy scrape, cached in localStorage
// A stale feed still beats an empty screen, so it's the final floor.

const CACHE_KEY = 'awanaCalendar.v1';
const FEED_STALE_MS = 21 * 24 * 60 * 60 * 1000; // Action heartbeats weekly; 3 missed = broken
const RECHECK_MS = 6 * 60 * 60 * 1000;
const MIN_CLUB_EVENTS = 5; // refuse to trust a scrape that lost the calendar

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const events = sanitizeEvents(JSON.parse(raw)?.events);
    return events.length ? events : null;
  } catch {
    return null;
  }
}

function saveCache(events) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: new Date().toISOString(), events }));
  } catch {
    /* localStorage may be blocked; cache is best-effort */
  }
}

async function fetchFeed() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}calendar-feed.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    const feed = sanitizeFeed(await res.json());
    return feed.events.length ? feed : null;
  } catch {
    return null;
  }
}

async function fetchViaProxy(proxyTemplate, calendarUrl) {
  if (!proxyTemplate || !calendarUrl || !proxyTemplate.includes('{url}')) return null;
  try {
    const url = proxyTemplate.replace('{url}', encodeURIComponent(calendarUrl));
    const res = await fetch(url);
    if (!res.ok) return null;
    const events = sanitizeEvents(parseCalendarHtml(await res.text()));
    return events.filter((e) => e.kind === 'club').length >= MIN_CLUB_EVENTS ? events : null;
  } catch {
    return null;
  }
}

/**
 * The club-year calendar, from the freshest source available.
 * Returns { events, source, generatedAt, refresh } — events is [] when
 * the feature is off or nothing loads; callers just render no slides.
 */
export function useCalendar(config) {
  const [state, setState] = useState({ events: [], source: 'none', generatedAt: null });
  const busy = useRef(false);

  const { calendarEnabled, calendarUrl, calendarCorsProxy } = config;

  const load = useCallback(async () => {
    if (!calendarEnabled || busy.current) return;
    busy.current = true;
    try {
      const feed = await fetchFeed();
      const feedFresh =
        feed?.generatedAt && Date.now() - Date.parse(feed.generatedAt) < FEED_STALE_MS;
      if (feed && feedFresh) {
        setState({ events: feed.events, source: 'feed', generatedAt: feed.generatedAt });
        return;
      }

      const scraped = await fetchViaProxy(calendarCorsProxy, calendarUrl);
      if (scraped) {
        saveCache(scraped);
        setState({ events: scraped, source: 'proxy', generatedAt: new Date().toISOString() });
        return;
      }

      const cached = loadCache();
      if (cached) {
        setState({ events: cached, source: 'cache', generatedAt: null });
        return;
      }

      if (feed) {
        // Stale, but real data — far better than a blank club night.
        setState({ events: feed.events, source: 'feed', generatedAt: feed.generatedAt });
      }
    } finally {
      busy.current = false;
    }
  }, [calendarEnabled, calendarUrl, calendarCorsProxy]);

  useEffect(() => {
    if (!calendarEnabled) return undefined;
    load();
    const timer = setInterval(load, RECHECK_MS);
    return () => clearInterval(timer);
  }, [calendarEnabled, load]);

  // Disabled → an empty view of whatever was loaded, without touching
  // state from inside an effect.
  if (!calendarEnabled) {
    return { events: [], source: 'none', generatedAt: null, refresh: load };
  }
  return { ...state, refresh: load };
}
