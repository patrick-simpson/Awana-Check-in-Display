import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import { formatLongDate } from '../lib/calendarLogic.js';

// ─────────────────────────────────────────────────────────────
// The fall 2026 event promos: animated lobby-TV recreations of the
// church's three printed posters (DEFEND poster contest, BARF Night,
// Parents' Night). Which one shows, and what its countdown says, is
// decided in the pure src/lib/promos.js. This file is only the art.
//
// v2 shape, from watching them on the lobby TV: a poster is read from
// the check-in line, twenty feet away, by someone who is not trying.
// So each slide is THREE big statements (headline, hero graphic, date)
// plus ONE rotating detail line and the countdown chip. Everything the
// first pass said in a sixth small line is now a detail string that
// takes its turn in that one slot at full size.
//
// Three things to keep true of anything added here:
//   • Every animated element is M.* from src/lib/motion.jsx, never
//     `motion` from framer-motion, so ?lowPower=1 freezes it. Ambient
//     `repeat: Infinity` loops are fine for the same reason, as long as
//     the LAST keyframe is the resting value: zero-animation mode jumps
//     straight to it and that is the frame the kiosk sits on.
//     (AnimatePresence is transport, not an animated element, so it
//     still comes straight from framer-motion.)
//   • Every transition is spelled out (duration/spring, delay), so the
//     choreography reads the same if framer-motion's defaults move.
//   • The 8 second hold has a shape: entrance through 1.5 s, the detail
//     line turning over at 1.6 / 3.8 / 6.0 s, and one beat at 4.0 s so
//     the slide is never just sitting there. Ambient loops all run at
//     different periods so nothing pulses in unison.
// ─────────────────────────────────────────────────────────────

// Same recipe as config.js's fromSiteRoot: a fork or mirror serves its
// own copy of shared/, and a non-browser context (tests) must not throw.
function siteRootUrl(path) {
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return '';
  }
}

const LOGO_URL = siteRootUrl('shared/art/awana-clubs-logo.png');

// The detail line's cadence, and the one mid-hold beat. Seconds for
// framer-motion, milliseconds for the timer chain.
const DETAIL_START_MS = 1600;
const DETAIL_STEP_MS = 2200;
const BEAT_AT_SEC = 4;
const BEAT_SEC = 0.5;

/**
 * The mid-hold beat: a quick bounce on a hero word, spread
 * with a small per-letter delay where the hero is spelled out.
 * One-shot keyframes rather than a repeat loop, so the slide lands back
 * on its resting size and stays there.
 */
function beat(delay = 0) {
  return {
    animate: { scale: [1, 1.06, 1] },
    transition: { duration: BEAT_SEC, delay: BEAT_AT_SEC + delay, ease: 'easeInOut' },
  };
}

/** The Awana Clubs wordmark, which simply is not there if the art 404s. */
function Wordmark({ delay = 0 }) {
  const [broken, setBroken] = useState(false);
  if (broken || !LOGO_URL) return null;
  return (
    <div className="promo-wordmark-slot">
      <M.img
        className="promo-wordmark"
        src={LOGO_URL}
        alt="Awana Clubs"
        onError={() => setBroken(true)}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      />
    </div>
  );
}

/**
 * The live counter, popped in early enough to be read and pulsed once
 * on the mid-hold beat. The slot carries the position so the pill's own
 * transform is free for that pulse.
 */
function CountdownChip({ label, delay = 1.2 }) {
  if (!label) return null;
  return (
    <M.div
      className="promo-chip-slot"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 14, delay }}
    >
      <M.div
        className="promo-chip"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: BEAT_SEC, delay: BEAT_AT_SEC, ease: 'easeInOut' }}
      >
        {label}
      </M.div>
    </M.div>
  );
}

// Every line each poster says in its one rotating slot, in the order it
// says them. This is the ONLY place that copy lives: the first pass had
// a verse reference, a reward line, a chain line and a pill scattered
// across three components at four different sizes, which is exactly what
// made the slides unreadable from the check-in line.
export const PROMO_DETAILS = Object.freeze({
  contest: Object.freeze({
    default: Object.freeze([
      '1 Peter 3:15 NKJV',
      'Open to all clubbers',
      'Voting at Parents’ Night · Nov 4',
    ]),
    tonight: Object.freeze([
      'Voting at Parents’ Night · Nov 4',
      '1 Peter 3:15 NKJV',
    ]),
  }),
  friend: Object.freeze({
    default: Object.freeze([
      'Earn 10 Awana Shares per friend',
      '+ a BARF bag!',
      'Bring A Real Friend',
    ]),
    tonight: Object.freeze([
      '10 Awana Shares per friend',
      '+ a BARF bag!',
    ]),
  }),
  parents: Object.freeze({
    // Before the contest closes the evening is still being sold; after
    // it, the ask is the vote.
    default: Object.freeze([
      'Spend the evening with your clubber',
      'DEFEND poster voting that night',
      'Posters due Oct 14',
    ]),
    afterContest: Object.freeze([
      'Spend the evening with your clubber',
      'Vote for your favorite DEFEND poster',
    ]),
    tonight: Object.freeze([
      'Spend the evening with your clubber',
      'Vote for your favorite DEFEND poster tonight',
    ]),
  }),
});

const NO_DETAILS = Object.freeze([]);

/**
 * Which set of lines a promo descriptor gets. Tonight wins over
 * afterContest: on Parents' Night itself both are true and the room is
 * standing in front of the posters.
 *
 * @param {{ kind?: string, tonight?: boolean, afterContest?: boolean }|null|undefined} promo
 * @returns {ReadonlyArray<string>}
 */
export function detailsFor(promo) {
  const table = promo && PROMO_DETAILS[promo.kind];
  if (!table) return NO_DETAILS;
  if (promo.tonight && table.tonight) return table.tonight;
  if (promo.afterContest && table.afterContest) return table.afterContest;
  return table.default;
}

/**
 * The one supporting line on a poster, at full size, one string at a
 * time. Everything the printed poster says in small type takes its turn
 * here instead of crowding the slide.
 *
 * `lines` must be a stable array (the tables in PROMO_DETAILS), because
 * it keys the timer chain. Timers are cleared on unmount, and under
 * zero-animation the swaps are instant rather than crossfaded.
 *
 * Exported for its own tests: the cadence is the point of the component,
 * and at the real 1.6 / 2.2 s spacing a test would spend six seconds
 * waiting for framer-motion's crossfade.
 */
export function RotatingDetail({ lines, startMs = DETAIL_START_MS, stepMs = DETAIL_STEP_MS }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (lines.length < 2) return undefined;
    // A chain of one-shot timeouts rather than an interval: each string
    // gets its turn once inside the hold, and the slide is remounted on
    // its next visit anyway.
    let timer = 0;
    let shown = 0;
    const step = () => {
      shown += 1;
      setIndex(shown);
      if (shown < lines.length - 1) timer = setTimeout(step, stepMs);
    };
    timer = setTimeout(step, startMs + stepMs);
    return () => clearTimeout(timer);
  }, [lines, startMs, stepMs]);

  if (!lines.length) return null;

  return (
    <M.div
      className="promo-detail-slot"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: startMs / 1000, ease: 'easeOut' }}
    >
      {/* mode="wait" so the outgoing string is gone before the next one
          arrives: two lines of condensed caps on top of each other are
          unreadable, and the slot holds its height either way. */}
      <AnimatePresence mode="wait" initial={false}>
        <M.span
          key={lines[index]}
          className="promo-detail"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {lines[index]}
        </M.span>
      </AnimatePresence>
    </M.div>
  );
}

/** The flat poster color, a spotlight behind the hero, and a vignette. */
function PosterDepth() {
  return (
    <>
      <div className="promo-texture" aria-hidden="true" />
      <div className="promo-vignette" aria-hidden="true" />
    </>
  );
}

// A four-point catalog sparkle that breathes. First and last keyframe are
// fully lit, so the frozen low-power frame shows a sparkle, not a ghost.
function Sparkle({ className, size, duration, delay, drift = 6 }) {
  return (
    <M.svg
      className={`promo-sparkle ${className}`}
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      animate={{ opacity: [1, 0.3, 1], scale: [1, 0.82, 1], y: [0, -drift, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path
        d="M20 0 c2.6 14.4 3 14.8 20 20 c-17 5.2 -17.4 5.6 -20 20 c-2.6 -14.4 -3 -14.8 -20 -20 c17 -5.2 17.4 -5.6 20 -20z"
        fill="currentColor"
      />
    </M.svg>
  );
}

// ── Poster contest ───────────────────────────────────────────
// Navy ground, the headline, the taped sign with DEFEND on it hanging
// and swinging, and the orange "posters due" band sweeping up across
// the bottom with the date and the detail line on it.

const DEFEND = ['D', 'E', 'F', 'E', 'N', 'D'];
const TAPE_CORNERS = ['tl', 'tr', 'bl', 'br'];

// Slow confetti through the navy. Negative delays start each piece
// partway down its fall, so the screen is never caught with all of them
// lined up at the top edge.
const CONTEST_CONFETTI = Object.freeze([
  { left: '6%', w: 0.85, h: 2.1, tone: 'gold', duration: 17, delay: -5, spin: 260 },
  { left: '17%', w: 0.7, h: 1.7, tone: 'white', duration: 21, delay: -13, spin: -180 },
  { left: '26%', w: 1, h: 2.4, tone: 'gold', duration: 15, delay: -9, spin: 320 },
  { left: '38%', w: 0.75, h: 1.8, tone: 'white', duration: 19, delay: -2, spin: -240 },
  { left: '52%', w: 0.9, h: 2.2, tone: 'gold', duration: 22, delay: -16, spin: 200 },
  { left: '63%', w: 0.7, h: 1.6, tone: 'white', duration: 16, delay: -7, spin: -300 },
  { left: '74%', w: 1, h: 2.3, tone: 'gold', duration: 20, delay: -11, spin: 280 },
  { left: '85%', w: 0.8, h: 1.9, tone: 'white', duration: 14, delay: -4, spin: -220 },
  { left: '93%', w: 0.9, h: 2.1, tone: 'gold', duration: 18, delay: -15, spin: 240 },
]);

/**
 * A slow drift of flecks across the whole poster, falling or rising.
 * The travel is in vh so it clears any screen, and every piece ends
 * off-frame: a frozen low-power screen shows a clean poster rather than
 * a handful of specks parked mid-air.
 */
function Drift({ pieces, className, from = '-8vh', to = '108vh' }) {
  return (
    <div className="promo-drift-layer" aria-hidden="true">
      {pieces.map((p) => (
        <M.span
          key={p.left}
          className={`${className} ${className}--${p.tone}`}
          style={{ left: p.left, width: `${p.w}vmin`, height: `${p.h}vmin` }}
          animate={{ y: [from, to], rotate: [0, p.spin] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

function ContestPromo({ promo }) {
  const { tonight } = promo;
  return (
    <div className="promo-slide promo-slide--contest">
      <PosterDepth />
      <Wordmark />

      <Sparkle className="promo-sparkle--a promo-sparkle--gold" size="4.2vmin" duration={3.4} delay={1.2} />
      <Sparkle className="promo-sparkle--b" size="2.8vmin" duration={4.6} delay={1.9} />
      <Sparkle className="promo-sparkle--c promo-sparkle--gold" size="3.4vmin" duration={5.2} delay={0.6} />
      <Sparkle className="promo-sparkle--d" size="3.8vmin" duration={4.1} delay={2.4} />
      <Sparkle className="promo-sparkle--e promo-sparkle--gold" size="3vmin" duration={3.9} delay={1.5} />
      <Sparkle className="promo-sparkle--f" size="3.6vmin" duration={4.8} delay={0.9} />
      <Drift pieces={CONTEST_CONFETTI} className="promo-fleck" />

      <div className="promo-contest-stack">
        <M.h2
          className="promo-headline promo-headline--contest"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        >
          Poster Contest
        </M.h2>

        {/* The sign DROPS in, then hangs. Two elements so the landing and
            the pendulum never fight over one transform. */}
        <M.div
          className="promo-sign-hang"
          initial={{ opacity: 0, y: -160 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 130, damping: 11, delay: 0.4 }}
        >
          <M.div
            className="promo-sign-swing"
            style={{ transformOrigin: '50% 0%' }}
            initial={{ rotate: -5 }}
            animate={{ rotate: [-5, -3, -5] }}
            transition={{ duration: 5.5, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="promo-sign">
              {TAPE_CORNERS.map((corner) => (
                <span key={corner} className={`promo-tape promo-tape--${corner}`} aria-hidden="true" />
              ))}
              <span className="promo-sign-word">
                {DEFEND.map((letter, i) => (
                  <M.span
                    // Fixed copy, so the index is a stable identity here.
                    key={`${letter}-${i}`}
                    className="promo-sign-letter promo-outline"
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 15, delay: 0.95 + i * 0.08 }}
                  >
                    <M.span className="promo-beat" {...beat(i * 0.06)}>{letter}</M.span>
                  </M.span>
                ))}
              </span>
            </div>
          </M.div>
        </M.div>
      </div>

      <M.div
        className="promo-contest-band"
        initial={{ opacity: 0, y: 200, rotate: -9 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.6 }}
      >
        <div className="promo-band-copy">
          <M.span
            className="promo-band-kicker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.05, ease: 'easeOut' }}
          >
            {tonight ? 'Posters due tonight' : 'Posters due'}
          </M.span>
          <M.span
            className={`promo-date promo-outline promo-band-head ${tonight ? 'promo-band-head--long' : ''}`}
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.15, ease: 'easeOut' }}
          >
            {tonight ? 'Hand yours in at the check-in desk' : formatLongDate(promo.eventDate).toUpperCase()}
          </M.span>
          <RotatingDetail lines={detailsFor(promo)} />
        </div>
      </M.div>

      <CountdownChip label={promo.countdown} />
    </div>
  );
}

// ── BARF Night ───────────────────────────────────────────────
// Purple ground, a comic burst turning behind the headline, and a lime
// splat that lands with a squish and then never quite stops wobbling.

const SPLAT_DOTS = [
  { cx: 66, cy: 74, r: 13, dx: 5, dy: 4, period: 5.4 },
  { cx: 336, cy: 62, r: 10, dx: -4, dy: 5, period: 6.6 },
  { cx: 358, cy: 172, r: 15, dx: 6, dy: -4, period: 4.8 },
  { cx: 42, cy: 186, r: 9, dx: -5, dy: -5, period: 7.2 },
  { cx: 128, cy: 30, r: 8, dx: 4, dy: 6, period: 5.9 },
  { cx: 288, cy: 22, r: 11, dx: -6, dy: 4, period: 6.3 },
  { cx: 20, cy: 128, r: 7, dx: 5, dy: -6, period: 4.4 },
];
const SPLAT_DRIPS = [
  { d: 'M128 230 c14 0 16 34 8 44 c-9 11 -22 6 -22 -10 c0 -12 4 -34 14 -34z', period: 3.6 },
  { d: 'M206 240 c16 0 18 46 8 58 c-11 13 -26 6 -26 -14 c0 -15 5 -44 18 -44z', period: 4.7 },
  { d: 'M288 222 c12 0 14 26 7 34 c-8 9 -19 5 -19 -8 c0 -9 3 -26 12 -26z', period: 5.5 },
];
const FRIEND_WORDS = ['BRING', 'A REAL', 'FRIEND'];

// Lime flecks drifting UP through the purple, the opposite of the
// contest's falling confetti so the two slides never read as the same
// poster in another color.
const FRIEND_FLECKS = Object.freeze([
  { left: '8%', w: 1.1, h: 1.1, tone: 'lime', duration: 15, delay: -4, spin: 180 },
  { left: '19%', w: 0.8, h: 0.8, tone: 'pale', duration: 19, delay: -12, spin: -140 },
  { left: '29%', w: 1.3, h: 1.3, tone: 'lime', duration: 13, delay: -8, spin: 220 },
  { left: '41%', w: 0.9, h: 0.9, tone: 'pale', duration: 17, delay: -1, spin: -200 },
  { left: '57%', w: 1.2, h: 1.2, tone: 'lime', duration: 20, delay: -14, spin: 160 },
  { left: '68%', w: 0.85, h: 0.85, tone: 'pale', duration: 14, delay: -6, spin: -260 },
  { left: '79%', w: 1.15, h: 1.15, tone: 'lime', duration: 18, delay: -10, spin: 200 },
  { left: '89%', w: 0.95, h: 0.95, tone: 'pale', duration: 12, delay: -3, spin: -180 },
  { left: '96%', w: 1.05, h: 1.05, tone: 'lime', duration: 16, delay: -15, spin: 240 },
]);

// A 14-point comic burst, built once so the headline has something
// turning slowly behind it instead of flat purple.
const BURST_POINTS = (() => {
  const spikes = 14;
  const points = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const r = i % 2 === 0 ? 50 : 35;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    points.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return points.join(' ');
})();

function FriendPromo({ promo }) {
  const { tonight } = promo;
  return (
    <div className="promo-slide promo-slide--friend">
      <PosterDepth />
      <Wordmark />
      <Drift pieces={FRIEND_FLECKS} className="promo-fleck" from="108vh" to="-8vh" />

      <div className="promo-friend-stack">
        <div className="promo-friend-head">
          <M.svg
            className="promo-friend-burst"
            viewBox="0 0 100 100"
            aria-hidden="true"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          >
            <polygon points={BURST_POINTS} fill="#7b35bd" />
          </M.svg>
          <M.h2
            className="promo-headline promo-headline--friend"
            initial={{ opacity: 0, y: -26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }}
          >
            <M.span className="promo-beat" {...beat()}>
              {tonight ? 'BARF Night is tonight!' : 'BARF Night!'}
            </M.span>
          </M.h2>
        </div>

        <div className="promo-friend-splat-area">
          {/* The jelly: a slow squash-and-stretch on the whole splat,
              separate from the squish landing below it so the two never
              fight over one transform. */}
          <M.div
            className="promo-friend-jelly"
            animate={{ scaleX: [1, 1.04, 0.97, 1], scaleY: [1, 0.96, 1.03, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 1.3 }}
          >
            <M.div
              className="promo-friend-squish"
              initial={{ opacity: 0, scale: 0, rotate: -3 }}
              // Keyframes rather than a spring so the overshoot is exact and
              // the last value (the resting one) is what low-power freezes on.
              animate={{ opacity: 1, scale: [0, 1.06, 1], rotate: [-3, 2, 0] }}
              transition={{ duration: 0.85, times: [0, 0.6, 1], delay: 0.35, ease: 'easeOut' }}
            >
              <svg className="promo-friend-splat" viewBox="0 0 400 300" aria-hidden="true">
                <path
                  d="M196 26 C238 8 292 22 306 58 C318 88 350 84 366 110 C382 136 372 172 346 190 C326 204 332 234 310 246 C286 258 258 240 236 250 C210 262 176 268 150 254 C124 240 96 246 76 228 C52 206 58 170 44 148 C28 122 40 84 70 70 C96 58 108 34 136 28 C158 24 176 34 196 26z"
                  fill="#7ed321"
                />
                {SPLAT_DRIPS.map((drip, i) => (
                  <M.g
                    key={drip.d}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center top' }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 1.15 + i * 0.1 }}
                  >
                    <M.path
                      d={drip.d}
                      fill="#7ed321"
                      style={{ transformBox: 'fill-box', transformOrigin: 'center top' }}
                      animate={{ scaleY: [1, 1.12, 1] }}
                      transition={{ duration: drip.period, delay: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </M.g>
                ))}
                {SPLAT_DOTS.map((dot, i) => (
                  <M.g
                    key={`${dot.cx}-${dot.cy}`}
                    animate={{ x: [0, dot.dx, 0, -dot.dx, 0], y: [0, -dot.dy, 0, dot.dy, 0] }}
                    transition={{ duration: dot.period, delay: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <M.circle
                      cx={dot.cx}
                      cy={dot.cy}
                      r={dot.r}
                      fill="#7ed321"
                      // Start collapsed toward the middle of the splat, then
                      // settle out to where they belong.
                      initial={{ opacity: 0, scale: 0.2, x: (200 - dot.cx) * 0.7, y: (150 - dot.cy) * 0.7 }}
                      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                      transition={{ type: 'spring', stiffness: 210, damping: 17, delay: 0.75 + i * 0.06 }}
                    />
                  </M.g>
                ))}
              </svg>
            </M.div>
          </M.div>

          <div className="promo-friend-words">
            {FRIEND_WORDS.map((word, i) => (
              <M.span
                key={word}
                className="promo-friend-word"
                initial={{ opacity: 0, x: i % 2 === 0 ? -90 : 90 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 1 + i * 0.12 }}
              >
                <M.span className="promo-beat" {...beat(i * 0.06)}>{word}</M.span>
              </M.span>
            ))}
          </div>
        </div>

        <div className="promo-friend-foot">
          <M.span
            className={`promo-date promo-outline promo-friend-date ${tonight ? 'promo-friend-date--long' : ''}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.35, ease: 'easeOut' }}
          >
            {tonight ? 'Bring your friend to the check-in desk' : formatLongDate(promo.eventDate).toUpperCase()}
          </M.span>
          <RotatingDetail lines={detailsFor(promo)} />
        </div>
      </div>

      <CountdownChip label={promo.countdown} delay={1.4} />
    </div>
  );
}

// ── Parents' Night ───────────────────────────────────────────
// Cream ground under a rust header that undulates, a gold heart that
// beats and throws off little hearts, and the date under a gold rule.

const PARENTS_WAVE_REST = 'M0 0 H1200 V146 C980 212 220 212 0 146 Z';
const PARENTS_WAVE_SWELL = 'M0 0 H1200 V132 C980 180 220 228 0 162 Z';

const HEART_PATH = 'M100 180 C40 132 10 100 10 66 C10 36 34 14 62 14 C80 14 94 24 100 36 C106 24 120 14 138 14 C166 14 190 36 190 66 C190 100 160 132 100 180z';

// Little hearts rising out from behind the big one and fading. They end
// invisible on purpose: that is the frame low-power freezes on.
const FLOAT_HEARTS = Object.freeze([
  { left: '12%', size: 2.6, duration: 7.5, delay: 1.8, tone: 'gold' },
  { left: '26%', size: 2, duration: 6.4, delay: 3.4, tone: 'rust' },
  { left: '38%', size: 3, duration: 8.2, delay: 0.9, tone: 'gold' },
  { left: '50%', size: 2.2, duration: 6.9, delay: 2.6, tone: 'rust' },
  { left: '62%', size: 2.8, duration: 7.8, delay: 1.3, tone: 'gold' },
  { left: '74%', size: 2.1, duration: 6.1, delay: 3.9, tone: 'rust' },
  { left: '86%', size: 2.5, duration: 8.6, delay: 2.1, tone: 'gold' },
  { left: '95%', size: 1.9, duration: 7.1, delay: 4.6, tone: 'gold' },
]);

function ParentsPromo({ promo }) {
  const { tonight } = promo;

  return (
    <div className="promo-slide promo-slide--parents">
      <PosterDepth />

      <M.div
        className="promo-parents-header"
        initial={{ y: '-100%' }}
        animate={{ y: '0%' }}
        transition={{ type: 'spring', stiffness: 110, damping: 18 }}
      >
        <svg viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
          <M.path
            initial={{ d: PARENTS_WAVE_REST }}
            animate={{ d: [PARENTS_WAVE_REST, PARENTS_WAVE_SWELL, PARENTS_WAVE_REST] }}
            transition={{ duration: 9, delay: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            fill="#c85a2e"
          />
        </svg>
      </M.div>
      <Wordmark delay={0.35} />

      <div className="promo-parents-hearts" aria-hidden="true">
        {FLOAT_HEARTS.map((h) => (
          <M.svg
            key={h.left}
            className={`promo-float-heart promo-float-heart--${h.tone}`}
            style={{ left: h.left, width: `${h.size}vmin` }}
            viewBox="0 0 200 190"
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.9, 0], y: [0, '-38vh'], scale: [0.5, 1.1, 0.8] }}
            transition={{ duration: h.duration, delay: h.delay, repeat: Infinity, ease: 'easeOut' }}
          >
            <path d={HEART_PATH} fill="currentColor" />
          </M.svg>
        ))}
      </div>

      <div className="promo-parents-stack">
        <M.div
          className="promo-parents-heart"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.45 }}
        >
          {/* The beat is its own element so the scale-in above can finish
              before the loop takes over the transform. The glow swells
              with it, which is what makes it read as a heartbeat rather
              than a pulsing shape. */}
          <M.svg
            viewBox="0 0 200 190"
            aria-hidden="true"
            animate={{
              scale: [1, 1.08, 1, 1.05, 1],
              filter: [
                'drop-shadow(0 0 6px rgba(226, 164, 60, 0.35))',
                'drop-shadow(0 0 22px rgba(226, 164, 60, 0.8))',
                'drop-shadow(0 0 8px rgba(226, 164, 60, 0.4))',
                'drop-shadow(0 0 16px rgba(226, 164, 60, 0.6))',
                'drop-shadow(0 0 6px rgba(226, 164, 60, 0.35))',
              ],
            }}
            transition={{
              duration: 1.7, times: [0, 0.12, 0.28, 0.4, 1], repeat: Infinity, ease: 'easeInOut', delay: 1.1,
            }}
          >
            <path d={HEART_PATH} fill="#e2a43c" stroke="#c85a2e" strokeWidth="9" strokeLinejoin="round" />
          </M.svg>
        </M.div>

        <M.h2
          className="promo-parents-title"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: 'easeOut' }}
        >
          <M.span className="promo-beat" {...beat()}>
            {tonight ? 'Parents’ Night is tonight!' : 'Parents’ Night'}
          </M.span>
        </M.h2>

        <M.div
          className="promo-parents-rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 1, ease: 'easeOut' }}
        >
          <M.div
            className="promo-parents-rule-bar"
            animate={{ scaleX: [1, 0.85, 1] }}
            transition={{ duration: 6, delay: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </M.div>

        <M.span
          className={`promo-date promo-parents-date ${tonight ? 'promo-parents-date--long' : ''}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.15, ease: 'easeOut' }}
        >
          {tonight ? 'Welcome, parents!' : formatLongDate(promo.eventDate).toUpperCase()}
        </M.span>

        <RotatingDetail lines={detailsFor(promo)} />
      </div>

      <CountdownChip label={promo.countdown} delay={1.5} />
    </div>
  );
}

const SCENES = {
  contest: ContestPromo,
  friend: FriendPromo,
  parents: ParentsPromo,
};

/**
 * One promo, full-bleed behind the check-in banners. `promo` is a
 * descriptor from buildPromoSlot() — an unknown kind renders nothing
 * rather than a broken frame, the same "missing data shows nothing"
 * rule the rest of the background follows.
 */
export default function PromoSlide({ promo }) {
  const Scene = promo && SCENES[promo.kind];
  if (!Scene) return null;
  return <Scene promo={promo} />;
}
