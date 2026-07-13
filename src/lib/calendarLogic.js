// ─────────────────────────────────────────────────────────────
// Calendar → slides. Pure date math and copywriting, no React,
// no fetching — the fully-testable core between the scraped
// calendar events (calendarParse.js) and the slideshow deck.
//
// House rules encoded here:
//   • "Tonight" is a LOCAL calendar-date match. Never toISOString()
//     — in US-Eastern evenings UTC has already rolled to tomorrow,
//     which is exactly club hours.
//   • Awana Store nights are a surprise: /store/i titles are never
//     announced ahead of time (they force the weather slide).
//   • Saturday day-notes (Build Day, Grand Prix) are not weekly
//     club nights: they never count toward "nights remaining" and
//     never appear as "tonight"/"next week".
// ─────────────────────────────────────────────────────────────

import { SLIDE_THEMES, TEXT_SIZES } from './slides.js';

// Local-time YYYY-MM-DD key (same recipe as useTally's todayKey).
export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 'Water Night - Poster Contest kicks off' → headline + sub-note.
// Split on the FIRST spaced hyphen only, so hyphenated names survive.
export function splitTitle(rawTitle) {
  const raw = String(rawTitle ?? '').trim();
  const at = raw.indexOf(' - ');
  if (at === -1) return { title: raw, note: '' };
  return { title: raw.slice(0, at).trim(), note: raw.slice(at + 3).trim() };
}

export function isStoreNight(title) {
  return /store/i.test(String(title ?? ''));
}

// 'YYYY-MM-DD' → 'Wed, Sep 9'. Components go through the LOCAL Date
// constructor — new Date('YYYY-MM-DD') would parse as UTC midnight
// and render the previous day in the Americas.
export function formatShortDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// Whole days between two date keys, DST-proof (UTC component math).
export function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = String(fromStr).split('-').map(Number);
  const [ty, tm, td] = String(toStr).split('-').map(Number);
  if (!fy || !ty) return NaN;
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/**
 * Everything the slides need to know about where we are in the club
 * year, derived from the sanitized event list and a local date key.
 */
export function deriveClubInfo(events, todayStr) {
  const clubs = (Array.isArray(events) ? events : []).filter((e) => e?.kind === 'club');

  const tonight = clubs.find((e) => e.date === todayStr && !e.isCancelled) || null;
  const after = clubs.filter((e) => e.date > todayStr);

  return {
    todayStr,
    tonight,
    // Next row on the calendar after today, cancelled or not — this is
    // what "next week" means on a weekly calendar with explicit breaks.
    nextEntry: after[0] || null,
    // Next ACTUAL club night, skipping cancelled weeks.
    nextNight: after.find((e) => !e.isCancelled) || null,
    nightsRemaining: after.filter((e) => !e.isCancelled).length,
    seasonOver: after.length === 0,
  };
}

// ── Slide construction ───────────────────────────────────────

const check = (theme, textSize) => ({
  theme: SLIDE_THEMES.includes(theme) ? theme : 'sky',
  textSize: TEXT_SIZES.includes(textSize) ? textSize : 'auto',
});

function slide(id, { eyebrow = '', text, subtext = '', theme = 'sky', textSize = 'auto' }) {
  return { id, eyebrow, text, subtext, durationSec: 0, ...check(theme, textSize) };
}

/**
 * The auto-generated deck, in show order. Derived fresh every render
 * from (events, today, config) — these slides are NEVER persisted, so
 * they can't go stale in localStorage or leak into the user's deck.
 *
 * A `{ type: 'weather' }` placeholder slide asks the slideshow to show
 * live weather in that slot; the caller drops it when weather data is
 * unavailable, so a dead API can never put an empty slide on screen.
 */
export function buildCalendarSlides(info, cfg = {}) {
  if (!info) return [];
  const slides = [];
  const showWelcome = cfg.calendarShowWelcome !== false;
  const showNextWeek = cfg.calendarShowNextWeek !== false;
  const showRemaining = cfg.calendarShowRemaining !== false;
  const showWeather = cfg.calendarShowWeather !== false;

  // 1 — Welcome / next-night pointer
  if (showWelcome) {
    if (info.tonight) {
      if (info.tonight.isSpecial) {
        const { title, note } = splitTitle(info.tonight.title);
        slides.push(slide('cal_welcome', {
          eyebrow: 'Tonight', text: `Welcome to ${title}!`, subtext: note, theme: 'sky', textSize: 'xl',
        }));
      } else {
        slides.push(slide('cal_welcome', {
          eyebrow: 'Awana Clubs',
          text: String(cfg.calendarWelcomeText || 'Welcome to Awana!'),
          theme: 'sky',
          textSize: 'xl',
        }));
      }
    } else if (info.nextNight) {
      // Off-day: point at the next night. Store/regular titles are not
      // announced — the date alone is the message.
      const { title } = splitTitle(info.nextNight.title);
      const announce = info.nextNight.isSpecial && !isStoreNight(info.nextNight.title);
      slides.push(slide('cal_welcome', {
        eyebrow: 'Next club night',
        text: announce
          ? `${title} — ${formatShortDate(info.nextNight.date)}`
          : `See you ${formatShortDate(info.nextNight.date)}!`,
        theme: 'sky',
        textSize: 'lg',
      }));
    }
  }

  // 2 — Next week / weather
  if (showNextWeek && info.nextEntry) {
    const entry = info.nextEntry;
    const gap = daysBetween(info.todayStr || localDateStr(), entry.date);
    if (entry.isCancelled) {
      slides.push(slide('cal_next', {
        eyebrow: 'Heads up',
        text: 'No club next week',
        subtext: splitTitle(entry.title).title || '',
        theme: 'sunset',
        textSize: 'lg',
      }));
    } else if (entry.isSpecial && !isStoreNight(entry.title)) {
      const { title, note } = splitTitle(entry.title);
      slides.push(slide('cal_next', {
        eyebrow: 'Mark your calendar',
        text: gap <= 8 ? `Next week is ${title}!` : `Coming up: ${title} — ${formatShortDate(entry.date)}`,
        subtext: note,
        theme: 'sunset',
        textSize: 'lg',
      }));
    } else if (showWeather) {
      // Regular (or hush-hush store) week ahead → nothing to tease, so
      // fill the slot with something delightful instead: the weather.
      slides.push({ id: 'cal_weather', type: 'weather', durationSec: 0 });
    }
  } else if (showNextWeek && showWeather && info.seasonOver && !info.tonight) {
    // Off-season screen still gets its weather moment.
    slides.push({ id: 'cal_weather', type: 'weather', durationSec: 0 });
  }

  // 3 — Nights remaining (the countdown-to-finish nudge)
  if (showRemaining && info.nightsRemaining >= 1 && info.nightsRemaining <= 9) {
    const n = info.nightsRemaining;
    slides.push(slide('cal_remaining', {
      eyebrow: 'The clock is ticking',
      text: `${n} night${n === 1 ? '' : 's'} remaining`,
      subtext: 'Is your child on track to finish their book?',
      theme: 'night',
      textSize: 'xl',
    }));
  }

  return slides;
}
