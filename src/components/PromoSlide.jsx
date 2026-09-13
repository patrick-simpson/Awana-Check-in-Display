import { useState } from 'react';
import { M } from '../lib/motion.jsx';
import { formatLongDate } from '../lib/calendarLogic.js';
import { PARENTS_DATE } from '../lib/promos.js';

// ─────────────────────────────────────────────────────────────
// The fall 2026 event promos: animated lobby-TV recreations of the
// church's three printed posters (DEFEND poster contest, BARF Night,
// Parents' Night). Which one shows, and what its countdown says, is
// decided in the pure src/lib/promos.js — this file is only the art.
//
// Two things to keep true of anything added here:
//   • Every animated element is M.* from src/lib/motion.jsx, never
//     `motion` from framer-motion, so ?lowPower=1 freezes it. Ambient
//     `repeat: Infinity` loops are fine for the same reason, as long as
//     the LAST keyframe is the resting value: zero-animation mode jumps
//     straight to it and that is the frame the kiosk sits on.
//   • Every transition is spelled out (duration/spring, delay), so the
//     choreography reads the same if framer-motion's defaults move.
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

const PARENTS_LONG = formatLongDate(PARENTS_DATE);

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

/** The live counter, popped in last so it reads as the newest thing. */
function CountdownChip({ label, delay = 1.6 }) {
  if (!label) return null;
  return (
    <M.div
      className="promo-chip"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 14, delay }}
    >
      {label}
    </M.div>
  );
}

// A four-point catalog sparkle that breathes. First and last keyframe are
// fully lit, so the frozen low-power frame shows a sparkle, not a ghost.
function Sparkle({ className, size, duration, delay }) {
  return (
    <M.svg
      className={`promo-sparkle ${className}`}
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      animate={{ opacity: [1, 0.3, 1], scale: [1, 0.82, 1] }}
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
// Navy ground, a taped-up white sign that drops in with DEFEND
// spelling itself out, and the orange "posters due" band sweeping up
// from the bottom-right.

const DEFEND = ['D', 'E', 'F', 'E', 'N', 'D'];
const TAPE_CORNERS = ['tl', 'tr', 'bl', 'br'];

function ContestPromo({ promo }) {
  const { tonight } = promo;
  return (
    <div className="promo-slide promo-slide--contest">
      <Wordmark />

      <div className="promo-contest-left">
        <M.span
          className="promo-eyebrow"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        >
          Poster Contest
        </M.span>
        <M.span
          className="promo-contest-theme"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
        >
          This year&rsquo;s theme
        </M.span>

        <M.div
          className="promo-sign"
          initial={{ opacity: 0, y: -120, rotate: -10 }}
          animate={{ opacity: 1, y: 0, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 130, damping: 11, delay: 0.4 }}
        >
          {TAPE_CORNERS.map((corner) => (
            <span key={corner} className={`promo-tape promo-tape--${corner}`} aria-hidden="true" />
          ))}
          <span className="promo-sign-word">
            {DEFEND.map((letter, i) => (
              <M.span
                // Fixed copy, so the index is a stable identity here.
                key={`${letter}-${i}`}
                className="promo-sign-letter"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 15, delay: 0.95 + i * 0.08 }}
              >
                {letter}
              </M.span>
            ))}
          </span>
        </M.div>

        <M.span
          className="promo-contest-verse"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.55, ease: 'easeOut' }}
        >
          1 Peter 3:15 NKJV
        </M.span>
      </div>

      <Sparkle className="promo-sparkle--a" size="3.4vmin" duration={3.4} delay={1.2} />
      <Sparkle className="promo-sparkle--b" size="2.2vmin" duration={4.6} delay={1.9} />
      <Sparkle className="promo-sparkle--c" size="2.7vmin" duration={5.2} delay={0.6} />
      <Sparkle className="promo-sparkle--d" size="3.1vmin" duration={4.1} delay={2.4} />

      {tonight ? null : (
        <M.p
          className="promo-contest-chain"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.75, ease: 'easeOut' }}
        >
          Voting happens at Parents&rsquo; Night &middot; {PARENTS_LONG}
        </M.p>
      )}

      <M.div
        className="promo-contest-band"
        initial={{ opacity: 0, y: 200, rotate: -9 }}
        animate={{ opacity: 1, y: 0, rotate: -3 }}
        transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.6 }}
      >
        <div className="promo-band-copy">
          <span className="promo-band-kicker">
            {tonight ? 'Posters due tonight' : 'Posters due'}
          </span>
          <span className={`promo-band-head ${tonight ? 'promo-band-head--long' : ''}`}>
            {tonight ? 'Hand yours in at the check-in desk' : formatLongDate(promo.eventDate).toUpperCase()}
          </span>
          <span className="promo-band-foot">
            {tonight ? 'Voting at Parents’ Night, Nov 4' : 'Open to all clubbers'}
          </span>
        </div>
      </M.div>

      <CountdownChip label={promo.countdown} />
    </div>
  );
}

// ── BARF Night ───────────────────────────────────────────────
// Purple ground, a lime splat that lands with a squish, dots flying
// out of its middle and drips growing off its underside.

const SPLAT_DOTS = [
  { cx: 66, cy: 74, r: 13 },
  { cx: 336, cy: 62, r: 10 },
  { cx: 358, cy: 172, r: 15 },
  { cx: 42, cy: 186, r: 9 },
  { cx: 128, cy: 30, r: 8 },
  { cx: 288, cy: 22, r: 11 },
  { cx: 20, cy: 128, r: 7 },
];
const SPLAT_DRIPS = [
  'M128 230 c14 0 16 34 8 44 c-9 11 -22 6 -22 -10 c0 -12 4 -34 14 -34z',
  'M206 240 c16 0 18 46 8 58 c-11 13 -26 6 -26 -14 c0 -15 5 -44 18 -44z',
  'M288 222 c12 0 14 26 7 34 c-8 9 -19 5 -19 -8 c0 -9 3 -26 12 -26z',
];
const FRIEND_WORDS = ['BRING', 'A REAL', 'FRIEND'];

function FriendPromo({ promo }) {
  const { tonight } = promo;
  return (
    <div className="promo-slide promo-slide--friend">
      <Wordmark />

      <div className="promo-friend-stack">
        <M.h2
          className="promo-friend-title"
          initial={{ opacity: 0, y: -26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }}
        >
          {tonight ? 'BARF Night is tonight!' : 'BARF Night!'}
        </M.h2>

        <div className="promo-friend-splat-area">
          {/* Ambient wobble on the whole splat, separate from the squish
              landing below it so the two never fight over one transform. */}
          <M.div
            className="promo-friend-wobble"
            animate={{ rotate: [-1, 1, -1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
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
                {SPLAT_DRIPS.map((d, i) => (
                  <M.path
                    key={d}
                    d={d}
                    fill="#7ed321"
                    style={{ transformBox: 'fill-box', transformOrigin: 'center top' }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 1.15 + i * 0.1 }}
                  />
                ))}
                {SPLAT_DOTS.map((dot, i) => (
                  <M.circle
                    key={`${dot.cx}-${dot.cy}`}
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
                {word}
              </M.span>
            ))}
          </div>
        </div>

        <div className="promo-friend-foot">
          <M.span
            className={`promo-friend-date ${tonight ? 'promo-friend-date--long' : ''}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.35, ease: 'easeOut' }}
          >
            {tonight ? 'Bring your friend to the check-in desk' : formatLongDate(promo.eventDate).toUpperCase()}
          </M.span>
          <M.span
            className="promo-friend-reward"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.5, ease: 'easeOut' }}
          >
            {tonight ? '10 Awana Shares per friend' : 'Earn 10 Awana Shares per friend'}
          </M.span>
          <M.span
            className="promo-friend-bag"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 1.7 }}
          >
            + a BARF bag!
          </M.span>
        </div>
      </div>

      <CountdownChip label={promo.countdown} delay={1.9} />
    </div>
  );
}

// ── Parents' Night ───────────────────────────────────────────
// Cream ground under a rust header band, a gold heart that beats, and
// the pill that says what the evening is actually for.

function ParentsPromo({ promo }) {
  const { tonight, afterContest } = promo;
  const pill = tonight
    ? 'Vote for your favorite DEFEND poster tonight!'
    : afterContest
      ? 'While you’re here, vote for your favorite DEFEND poster!'
      : 'DEFEND poster voting happens that night · posters due Oct 14';

  return (
    <div className="promo-slide promo-slide--parents">
      <M.div
        className="promo-parents-header"
        initial={{ y: '-100%' }}
        animate={{ y: '0%' }}
        transition={{ type: 'spring', stiffness: 110, damping: 18 }}
      >
        <svg viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0 H1200 V146 C980 212 220 212 0 146 Z" fill="#c85a2e" />
        </svg>
      </M.div>
      <Wordmark delay={0.35} />

      <div className="promo-parents-stack">
        <M.div
          className="promo-parents-heart"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.45 }}
        >
          {/* The beat is its own element so the scale-in above can finish
              before the loop takes over the transform. */}
          <M.svg
            viewBox="0 0 200 190"
            aria-hidden="true"
            animate={{ scale: [1, 1.08, 1, 1.05, 1] }}
            transition={{
              duration: 1.6, times: [0, 0.12, 0.28, 0.4, 1], repeat: Infinity, ease: 'easeInOut', delay: 1.1,
            }}
          >
            <path
              d="M100 180 C40 132 10 100 10 66 C10 36 34 14 62 14 C80 14 94 24 100 36 C106 24 120 14 138 14 C166 14 190 36 190 66 C190 100 160 132 100 180z"
              fill="#e2a43c"
              stroke="#c85a2e"
              strokeWidth="9"
              strokeLinejoin="round"
            />
          </M.svg>
        </M.div>

        <M.h2
          className="promo-parents-title"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: 'easeOut' }}
        >
          {tonight ? 'Parents’ Night is tonight!' : 'Parents’ Night'}
        </M.h2>

        <M.p
          className="promo-parents-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8, ease: 'easeOut' }}
        >
          {tonight
            ? 'Welcome, parents. Spend the evening with your clubber.'
            : 'Spend the evening with your clubber.'}
        </M.p>

        <M.div
          className="promo-parents-rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 1, ease: 'easeOut' }}
        />

        <M.span
          className="promo-parents-date"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.15, ease: 'easeOut' }}
        >
          {formatLongDate(promo.eventDate).toUpperCase()}
        </M.span>

        <M.p
          className="promo-parents-pill"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 1.4 }}
        >
          {pill}
        </M.p>
      </div>

      <CountdownChip label={promo.countdown} delay={1.7} />
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
