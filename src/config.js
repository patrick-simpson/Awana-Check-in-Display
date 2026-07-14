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

const config = {
  // Pusher credentials. Sign up free at https://pusher.com, create a
  // Channels app, and copy these two values from its "App Keys" page.
  pusherAppKey: '',
  pusherCluster: 'us2',

  // What plays behind the check-in banners:
  //   'powerpoint' — the OneDrive PowerPoint embed below (the default)
  //   'manual'     — slides you free-type in the on-screen editor
  //                  (Settings → Typed slides, or Ctrl+Shift+E)
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

  // EXPERIMENTAL: download the .pptx from OneDrive and drive slide timing
  // locally instead of using the Office Online iframe. Slide rendering is
  // not implemented yet, so leave this off for real club nights — if it
  // fails the app falls back to the iframe embed automatically.
  useLocalSlideshow: false,

  // Club start time. The corner countdown ticks down to this time today
  // (or tomorrow if today's time has already passed). 24-hour clock.
  // With calendar events loaded, it only shows when the target day is
  // an actual club night — never during breaks.
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
  cycleIntervalSec: 12,

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

  // The public calendar page to read (twotimtwo format).
  calendarUrl: 'https://kvbchurch.twotimtwo.com/calendar/index',

  // Fallback-only CORS proxy template; {url} is replaced with the
  // encoded calendar URL. Leave blank to disable the runtime fallback
  // and rely purely on the nightly feed.
  calendarCorsProxy: 'https://api.allorigins.win/raw?url={url}',

  // What the welcome slide says on an ordinary club night (special
  // nights use their calendar title instead).
  calendarWelcomeText: 'Welcome to Awana!',

  // Turn individual auto-slides off without losing the others.
  calendarShowWelcome: true,
  calendarShowNextWeek: true,
  calendarShowRemaining: true,

  // Where the weather chip looks. Use Settings → Calendar & Weather →
  // "Look up" to fill the coordinates from a town name.
  weatherLocationName: 'Waterville, Maine',
  weatherLat: 44.552,
  weatherLon: -69.6317,
  weatherUnits: 'fahrenheit', // or 'celsius'
};

export default config;
