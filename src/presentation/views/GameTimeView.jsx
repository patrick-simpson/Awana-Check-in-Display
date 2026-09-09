import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CLUBS } from '../config.js';
import { THEME, artUrl } from '../lib/shared-config.js';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { ParticleField } from '../components/ParticleField.jsx';
import { SparkleDoodles } from '../components/SparkleDoodles.jsx';
import { ClubWave } from '../components/ClubWave.jsx';
import { ConfettiBurst } from '../components/ConfettiBurst.jsx';
import { Badge } from '../components/Badge.jsx';
import { BigTimer, URGENT_COLOR } from '../components/BigTimer.jsx';
import { GlowText } from '../components/GlowText.jsx';
import { useLowPower } from '../hooks/useLowPower.js';
import { CakeArt } from '../../components/BirthdayArt.jsx';
import { secondsUntil } from '../lib/schedule.js';
import {
  WARNING_LABELS,
  WARNING_STINGER_INTENSITY,
  warningFor,
} from '../lib/gameWarning.js';
import { playStinger } from '../lib/stingers.js';
import { birthdaysThisWeek, listNames } from '../lib/birthdays.js';
import { countForClub } from '../lib/tally.js';
import { mulberry32 } from '../lib/color.js';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { useBirthdays } from '../hooks/useBirthdays.js';

/** Tally older than this is treated as gone (print server offline). */
const TALLY_STALE_MS = 10 * 60 * 1000;

/** Amber for the two-minute heads-up; the final call reuses the timer's
 *  own urgent red so the two screens speak one colour language. */
const WARNING_COLORS = {
  'two-minute': '#FFB627',
  'final-thirty': URGENT_COLOR,
};

/**
 * Per-club game-time screen: catalog waves in the club color(s), the
 * club emblem (official logo art when available, typographic badge
 * otherwise), a timer to the window's end, official character art in
 * the lower corners, and a subtle live "checked in" count per club fed
 * by the print server's tally broadcast.
 * Combined windows (Puggles & Cubbies) get one wave per club.
 *
 * `tally` arrives as a prop (from useRealtime, via the display's
 * sanctioned sanitized socket) instead of the original repo's own
 * useTally hook — the view itself is unchanged.
 */
export const GameTimeView = ({ now, window: gameWindow, endsAt, tally }) => {
  // Held still under ?vr=1 / OS reduced-motion, where every ambient layer stops.
  const lowPower = useLowPower();
  const clubs = gameWindow.clubs.map((id) => CLUBS[id]);
  const primary = clubs[0];
  const secondary = clubs[1];

  // This week's (Sun–Sat) birthdays for the club(s) on screen.
  const roster = useBirthdays();
  const celebrants = birthdaysThisWeek(roster, now).filter((b) => gameWindow.clubs.includes(b.club));

  // Live check-in tally (hidden when absent or stale — judged against
  // the ticking clock so it self-hides if the print server goes quiet).
  const tallyFresh = tally != null && now.getTime() - tally.at.getTime() < TALLY_STALE_MS;
  const clubCounts = clubs
    .map((club) => ({ club, count: tallyFresh ? countForClub(tally, club.id) : null }))
    .filter((c) => c.count !== null);

  const seconds = secondsUntil(endsAt, now);

  // Wrap-up warning for the rotation boundary (lib/gameWarning.js). The
  // treatment is deliberately restrained — a recoloured clock and one
  // small badge, in the same register as the countdown screen, which no
  // longer pops milestone cards at all.
  const warning = warningFor(seconds);
  const warnColor = WARNING_COLORS[warning];

  // The last state we ANNOUNCED, not the last state rendered: a
  // re-render (a tally arriving, a birthday resolving) must never
  // re-fire the cue, and the clock re-renders every second.
  const announced = useRef('none');
  useEffect(() => {
    if (warning === announced.current) return;
    announced.current = warning;
    const intensity = WARNING_STINGER_INTENSITY[warning];
    // No-op unless the operator armed countdown sounds in QuickNav —
    // a projector in a quiet room must never surprise anyone.
    if (intensity != null) playStinger(intensity);
  }, [warning]);

  const endTimeStr = endsAt.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <ScreenFrame
      layers={
        <>
          <ClubWave color={primary.color} position="bottom" variant={0} height={36} />
          <ClubWave
            color={(secondary ?? primary).color}
            position="top"
            variant={1}
            height={24}
            intensity={secondary ? 0.8 : 0.45}
          />
          <ParticleField />
          <SparkleDoodles
            seed={gameWindow.startMin}
            colors={[...clubs.map((c) => c.color), '#FFFFFF', '#FFC107']}
            count={16}
          />
          <CharacterArt clubs={clubs} seed={gameWindow.startMin} />
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-7">
        {/* Club emblems — official art when we have it, badge otherwise */}
        <div className="flex gap-6 flex-wrap justify-center items-center">
          {clubs.map((club) => (
            <ClubEmblem key={club.id} club={club} />
          ))}
        </div>

        {/* "GAME TIME!" with the catalog's playful tilt */}
        <GlowText
          as="h1"
          size="h1"
          font="display"
          color={primary.color}
          className="leading-none text-center select-none"
          style={{ transform: 'rotate(-2deg)' }}
        >
          GAME TIME!
        </GlowText>

        {warning !== 'none' && (
          <motion.div
            key={warning}
            data-warning={warning}
            initial={lowPower ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.base, ease: EASE.pop }}
          >
            {/* Motionless under low power (?vr=1 / reduced motion): the
                warning is content, so it still renders — it just doesn't
                animate in. No pulse or repeat loop in either case. */}
            <Badge color={warnColor} size="md">
              {WARNING_LABELS[warning]}
            </Badge>
          </motion.div>
        )}

        <BigTimer seconds={seconds} color={primary.color} warnColor={warnColor} />

        <GlowText
          as="p"
          size="body-lg"
          font="body"
          color="rgba(255,255,255,0.72)"
          className="tracking-wide"
        >
          Game ends at {endTimeStr}
        </GlowText>

        {/* Subtle live check-in counts (print server tally broadcast) */}
        <AnimatePresence>
          {clubCounts.length > 0 && (
            <motion.div
              className="flex gap-3 justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: DUR.base, ease: EASE.pop, delay: 0.4 }}
            >
              {clubCounts.map(({ club, count }) => (
                <Badge key={club.id} color={club.color} size="sm" style={{ opacity: 0.85 }}>
                  {clubCounts.length > 1 ? `${club.name}: ` : ''}
                  {/* Remount on each increment: leaders see the arrival
                      land as a little pop, same trick as the signage tally. */}
                  <motion.span
                    key={count}
                    className="inline-block"
                    initial={{ scale: 1.45, rotate: -6 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 15 }}
                  >
                    {count}
                  </motion.span>
                  {' checked in'}
                </Badge>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* This week's birthdays for the club(s) on screen */}
        {celebrants.length > 0 && (
          <motion.div
            className="flex flex-col items-center mt-2"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.base, ease: EASE.pop, delay: 0.25 }}
          >
            {/* A cake above the greeting. This side of the app knows each
                birthday's month and day but still NOT a year, so there is no
                candle count and no age — same constraint as the signage banner.
                Held still under low power (?vr=1 / reduced motion), where the
                whole ambient layer is expected to stop. */}
            <motion.span
              className="block w-16 sm:w-20 mb-1"
              aria-hidden
              initial={{ y: 18, scale: 0.85, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ duration: DUR.base, ease: EASE.pop, delay: 0.15 }}
            >
              <motion.span
                className="block"
                animate={lowPower ? undefined : { rotate: [0, -5, 5, 0], scale: [1, 1.06, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
              >
                <CakeArt />
              </motion.span>
            </motion.span>
            <GlowText
              as="p"
              size="script"
              font="script"
              color="#FFC107"
              style={{ fontWeight: 600, transform: 'rotate(-2deg)' }}
            >
              happy birthday
            </GlowText>
            <GlowText
              as="p"
              size="script"
              font="display"
              color="#FFFFFF"
              className="text-center max-w-6xl leading-tight"
            >
              {listNames(celebrants.map((b) => b.name))}
            </GlowText>
          </motion.div>
        )}
      </div>

      {celebrants.length > 0 && <ConfettiBurst />}
    </ScreenFrame>
  );
};

/**
 * The club's official logo art (from shared/theme.json); a failed load
 * falls back to the typographic badge so a missing PNG can never blank
 * the screen. A crisp thin white halo (die-cut edge) plus a plain soft
 * ground shadow keep it grounded without any glow.
 */
const ClubEmblem = ({ club }) => {
  const [failed, setFailed] = useState(false);
  const logo = THEME.clubs[club.id]?.art.logo;

  if (!logo || failed) {
    return (
      <Badge color={club.color} size="md" sparkle>
        {club.name}
      </Badge>
    );
  }
  return (
    <motion.img
      src={artUrl(logo)}
      alt={club.name}
      onError={() => setFailed(true)}
      draggable={false}
      className="select-none"
      style={{
        height: 'clamp(4rem, 11vh, 9rem)',
        width: 'auto',
        filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
      }}
      initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: DUR.base, ease: EASE.pop }}
    />
  );
};

/**
 * Official club character art in the lower corners — one per side,
 * seed-picked (stable per window) from the characters the theme ships.
 * Decorative layer only; sits with the waves behind the content.
 */
const CharacterArt = ({ clubs, seed }) => {
  const pool = clubs.flatMap(
    (club) => THEME.clubs[club.id]?.art.characters?.map((path) => ({ club, path })) ?? [],
  );
  if (pool.length === 0) return null;

  const rand = mulberry32(seed);
  const first = pool[Math.floor(rand() * pool.length)];
  const rest = pool.filter((c) => c !== first);
  const second = rest.length > 0 ? rest[Math.floor(rand() * rest.length)] : null;

  const corners = [
    { char: first, className: 'left-[3%]', rotate: -6, x: -40 },
    ...(second ? [{ char: second, className: 'right-[3%]', rotate: 6, x: 40 }] : []),
  ];

  return (
    <>
      {corners.map(({ char, className, rotate, x }) => (
        <motion.img
          key={char.path}
          src={artUrl(char.path)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`absolute bottom-[4%] ${className} select-none pointer-events-none`}
          style={{
            height: 'clamp(9rem, 26vh, 20rem)',
            width: 'auto',
            filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.55))',
          }}
          initial={{ opacity: 0, y: 60, x, rotate: 0 }}
          animate={{ opacity: 0.95, y: 0, x: 0, rotate }}
          transition={{ duration: DUR.slow, ease: EASE.pop, delay: 0.5 }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ))}
    </>
  );
};
