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

  // The OneDrive "Embed" URL for your looping PowerPoint.
  // Go to OneDrive → open .pptx → File → Share → Embed → copy the <iframe src="…"> value.
  // Leave blank to show a friendly placeholder instead.
  powerpointEmbedUrl: '',

  // How many seconds between slide advances (sets wdSlideShowDelay in the embed URL).
  // Set to 0 to let the PowerPoint file control its own slide timing.
  slideshowDelaySec: 5,

  // Club start time. The corner countdown ticks down to this time today
  // (or tomorrow if today's time has already passed). 24-hour clock.
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

  // Show a tiny "● connected" dot in the corner? Useful while setting up,
  // distracting during club. Defaults to hidden.
  showConnectionStatus: false,
};

export default config;
