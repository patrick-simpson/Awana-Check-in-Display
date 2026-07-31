// ─────────────────────────────────────────────────────────────
// EDIT-ME CONFIG
//
// This is the file most users will change. Anything here can ALSO be
// overridden at runtime via the on-screen Settings panel (gear icon,
// bottom-left), which stores your overrides in the browser's
// localStorage so you can tweak without committing new code.
//
// All keys are optional — leave one blank and the app falls back to
// a sensible default.
// ─────────────────────────────────────────────────────────────

// Resolve a path relative to wherever this app is being served from —
// so forks and mirrors read their own /shared/ files instead of the
// original deployment's. (Guarded for non-browser contexts like tests.)
const fromSiteRoot = (path) => {
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return '';
  }
};

const config = {
  // Pusher credentials. Sign up free at https://pusher.com, create a
  // Channels app, and copy these two values from its "App Keys" page.
  pusherAppKey: '',
  pusherCluster: 'us2',

  // What plays behind the check-in banners:
  //   'powerpoint' — the OneDrive PowerPoint embed below (the default)
  //   'manual'     — slides you free-type in the on-screen editor
  //                  (Settings → Typed slides, or Ctrl+Shift+E)
  //   'pptx'       — a .pptx you upload in Settings, rendered locally
  //                  on this device (no OneDrive, no iframe)
  backgroundSource: 'powerpoint',

  // Typed slides live here when you use the 'manual' source. Edit them
  // with the on-screen editor rather than by hand — they're saved per
  // device in the browser, and the editor can export/import them as a
  // JSON file to move a deck between computers.
  manualSlides: [],

  // The OneDrive "Embed" URL for your looping PowerPoint.
  // Go to OneDrive → open .pptx → File → Share → Embed → copy the <iframe src="…"> value.
  // Leave blank to show a friendly placeholder instead.
  powerpointEmbedUrl: '',

  // How many seconds between slide advances (sets wdSlideShowDelay in the embed URL).
  // Set to 0 to let the PowerPoint file control its own slide timing.
  slideshowDelaySec: 5,

  // Download the .pptx from the OneDrive URL above and render it locally
  // instead of using the Office Online iframe. Local rendering covers
  // backgrounds, text, pictures and solid/gradient shapes (with rotation
  // and per-slide timings); it does NOT render animations, SmartArt,
  // charts or tables, and fonts substitute to the system stack. Applies
  // only to this URL-fetch path — the primary way to use local rendering
  // is uploading a deck in Settings (backgroundSource: 'pptx'), which
  // avoids OneDrive's CORS blocks entirely. If the download or parse
  // fails, the app falls back to the iframe embed automatically.
  useLocalSlideshow: false,

  // RETIRED: the corner countdown card moved to the presentation tool
  // (countdown.html), which owns countdown duty for the program. The
  // key is kept so older saved settings still validate; it no longer
  // drives anything on the signage page.
  countdownTargetTime: '18:30',

  // How long each check-in banner stays on screen (milliseconds).
  standardDisplayMs: 6000,
  specialDisplayMs: 8000, // birthday / first-timer banners hold longer

  // Small gap between banners so the animation in/out doesn't clip.
  gapBetweenBannersMs: 400,

  // Play a little chime alongside the banner? The user can flip this
  // at runtime in the Settings panel; this is just the initial default.
  // Browsers block autoplay until the user interacts with the page
  // at least once, so the chime is silent on first load either way.
  audioEnabledByDefault: false,

  // How the corner data widgets (time, tally, weather, countdown) are
  // presented:
  //   'cycle'    — one big beautifully-animated data point at a time in
  //                the bottom-right corner, cycling through whichever
  //                items are enabled below (the default)
  //   'stickers' — the classic look: sticker chips pinned to the top
  //                corners plus the countdown card bottom-right
  widgetDisplayMode: 'cycle',

  // How long each data point holds the corner before the next one
  // tumbles in (seconds). Only used in 'cycle' mode.
  cycleIntervalSec: 3,

  // Show a tiny "● connected" dot in the corner? Useful while setting up,
  // distracting during club. Defaults to hidden. (If the connection drops
  // mid-club the dot appears on its own either way, so a dead pipe is
  // never silent.)
  showConnectionStatus: false,

  // Show tonight's check-in counter in the corner. Counts only a number —
  // no names are stored — and resets automatically each day.
  showTally: true,

  // Celebrate every Nth check-in with a room-wide confetti moment and a
  // "25 kids tonight!" toast. Set to 0 to turn milestones off.
  milestoneEvery: 25,

  // Show the current time of day (the countdown shows time-until-start;
  // this is a plain wall clock). A headline item in 'cycle' mode, a
  // top-right sticker in 'stickers' mode.
  showClock: true,

  // Animated weather — temperature plus a living doodle of the sky.
  // Joins the cycle in 'cycle' mode, or sits under the clock as a
  // top-right sticker in 'stickers' mode. Refreshes every 15 minutes
  // from Open-Meteo (free, keyless). Works over any background source;
  // hides itself whenever no reading is available.
  showWeatherChip: true,

  // Ask the browser to keep the TV/projector screen awake while the
  // display is open (Screen Wake Lock API; ignored where unsupported).
  keepScreenAwake: true,

  // ── Calendar-aware slides ─────────────────────────────────
  // The display can read the church's Awana calendar and auto-generate
  // slides in the typed-slides rotation: "Welcome to Water Night!",
  // "Next week is Backwards Night!", and "N nights remaining". A nightly
  // GitHub Action turns the calendar page into calendar-feed.json;
  // if that file is missing or stale the app falls back to fetching
  // the calendar page live through the CORS proxy below.
  calendarEnabled: true,

  // ── Church profile ────────────────────────────────────────
  // Everything specific to YOUR church lives in this block — if you
  // forked this repo for a different church, these are the values to
  // change (all of them can also be overridden at runtime in Settings).

  // The public calendar page to read (twotimtwo format).
  calendarUrl: 'https://kvbchurch.twotimtwo.com/calendar/index',

  // The shared program schedule (shared/ at the repo root →
  // dist/shared/ on build) — the single source of truth for the whole
  // Awana app family. Drives "phase awareness": calm late-arrival
  // banners + ducked chimes once the ceremony starts. Resolved against
  // wherever this site is served from, so forks automatically read
  // their own copy; blank disables the fetch (baked KVBC schedule
  // still applies).
  sharedScheduleUrl: fromSiteRoot('shared/schedule.json'),

  // The shared per-club theme (catalog colors + official club art),
  // also served from this site's shared/. Blank keeps the baked palette.
  sharedThemeUrl: fromSiteRoot('shared/theme.json'),

  // Where the weather chip looks. Use Settings → Calendar & Weather →
  // "Look up" to fill the coordinates from a town name.
  weatherLocationName: 'Waterville, Maine',
  weatherLat: 44.552,
  weatherLon: -69.6317,
  weatherUnits: 'fahrenheit', // or 'celsius'

  // ── End church profile ────────────────────────────────────

  // Recap replay: how far back (minutes) a replayed check-in may be and
  // still get its quiet "also joined us" banner after a reconnect.
  recapMaxAgeMin: 20,

  // Celebrate when a single club's tally (from the printer's live
  // broadcasts) crosses a multiple of this. 0 disables.
  clubMilestoneEvery: 10,

  // Themed night skin: 'none' | 'auto' | a skin id. The ids live in ONE
  // place — SKIN_TABLE in src/lib/skins.js — which also carries each
  // skin's accent colors, its scene theme, and the calendar-title
  // keywords that select it.
  //
  // 'auto' reads tonight's church calendar title first (so Easter, VBS,
  // Thanksgiving and back-to-school work — none of which a month table
  // can express, being lunar, floating or church-scheduled) and falls
  // back to the month. The skin dresses the room; banners always keep
  // their club colors.
  nightTheme: 'none',

  // Let the weather add atmosphere over whatever the season chose: a
  // rainy or snowy night cools and dims the background scene. The season
  // still owns the palette, so a chosen VBS skin doesn't disappear when
  // it rains. Needs a weather location (Calendar & Weather) but NOT the
  // corner chip — either one being on is enough to fetch.
  weatherTheme: false,

  // Per-club banner flavor text, shown under the kid's name on their
  // welcome banner. Keys match the club name the printer sends
  // (case-insensitive); missing clubs just get no subtitle. Example:
  //   clubPhrases: { sparks: 'Shine bright tonight!', 't&t': 'Bring it!' },
  clubPhrases: {},

  // Room-wide confetti intensity: 'full' | 'reduced' | 'off'.
  // 'reduced' halves the particle counts (weak hardware / busy nights);
  // 'off' keeps banners and chimes but never fires the cannons.
  confettiLevel: 'full',

  // Panic mode strips the screen to its reliable core (placeholder
  // background, clock only) while banners keep working. Toggle it live
  // with Ctrl+Shift+X when something looks wrong mid-event.
  panicMode: false,

  // What the welcome slide says on an ordinary club night (special
  // nights use their calendar title instead).
  calendarWelcomeText: 'Welcome to Awana!',

  // Turn individual auto-slides off without losing the others.
  calendarShowWelcome: true,
  calendarShowNextWeek: true,
  calendarShowRemaining: true,

  // Self-heal watchdog: reload the page automatically after this many
  // minutes of continuously-lost realtime connection (never more than
  // twice an hour). 0 disables. Only fires when Pusher is configured —
  // a display that was never set up is left alone.
  watchdogReloadMin: 30,

  // Burst mode floor: even during a check-in rush, no banner ever holds
  // for less than this (milliseconds).
  burstFloorMs: 2500,
};

export default config;
