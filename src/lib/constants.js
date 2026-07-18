// Timing and cap constants shared across the signage app. Gathered in
// one place so tuning a club-night behavior never means hunting through
// components — and so operator-tunable values (see config.js) have one
// canonical baked fallback.

// How many ops (printer telemetry) failures the Signal sticker keeps.
export const OPS_FAILURES_MAX = 20;

// Milestone / club-milestone toast hold time.
export const MILESTONE_TOAST_MS = 6000;

// Settings gear fades after this much mouse stillness.
export const GEAR_IDLE_MS = 3000;

// Grace period before a dropped realtime pipe forces the status sticker
// visible — ordinary reconnect blips stay silent.
export const DROPPED_GRACE_MS = 8000;

// Check-in queue: burst mode starts shrinking holds past this many
// waiting events, never below the floor; the queue is capped against a
// runaway/duplicated feed.
export const BURST_THRESHOLD = 2;
export const BURST_FLOOR_MS = 2500;
export const MAX_QUEUE = 100;

// Fallback banner hold when the configured duration is invalid.
export const DEFAULT_HOLD_MS = 6000;

// Seen-events dedupe ledger cap (sessionStorage).
export const SEEN_EVENTS_MAX = 500;

// Refuse to trust a calendar scrape that lost most of the calendar.
export const MIN_CLUB_EVENTS = 5;

// Self-heal watchdog: reload the page after this long continuously
// disconnected (minutes, overridable via config.watchdogReloadMin), with
// at most this many automatic reloads per hour so a dead network can't
// put the display in a reload loop.
export const WATCHDOG_DISCONNECT_MIN = 30;
export const WATCHDOG_MAX_RELOADS_PER_HOUR = 2;
