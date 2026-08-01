import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { fireBirthday } from '../lib/confetti.js';
import { playBirthdayChime } from '../lib/audio.js';
import { celebrationProfile, useCelebration } from '../hooks/useCelebration.js';
import BannerShell, { Eyebrow, bannerItem, bannerNameStagger } from './BannerShell.jsx';
import AnimatedName from './AnimatedName.jsx';
import {
  CakeArt, GiftArt, BalloonArt, StarArt, StreamerArt, PartyHatArt, GarlandArt,
} from './BirthdayArt.jsx';

// The falling pieces cycle chunky SVG art in a bright kid palette —
// identical on every TV, unlike the OS emoji this replaced.
const PIECES = [
  (key) => <GiftArt key={key} color="#ffd257" />,
  (key) => <BalloonArt key={key} color="#4fc3f7" />,
  (key) => <StreamerArt key={key} color="#f48fb1" />,
  (key) => <StarArt key={key} color="#fff6e3" />,
  (key) => <PartyHatArt key={key} color="#4fc3f7" />,
  (key) => <GiftArt key={key} color="#aed581" />,
  (key) => <StreamerArt key={key} color="#ffd257" />,
  (key) => <BalloonArt key={key} color="#f48fb1" />,
];

// Small deterministic PRNG (mulberry32). Seeding it with the event id
// keeps render pure — the same event always yields the same gift layout,
// while different events still get fresh-looking randomness.
function seededRandom(seed) {
  let t = (seed * 2654435761) >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Birthday banner: coral→raspberry band, a wiggling three-tier cake,
 * and a full-screen rain of gifts, balloons and stars. The rain lives
 * outside the band so it can fall over the whole display.
 */
export default function BirthdayBanner({ event, audioEnabled }) {
  const calm = event.presentation === 'replay' || event.presentation === 'late';
  useCelebration(event.id, audioEnabled, celebrationProfile(event.presentation, {
    confetti: fireBirthday,
    chime: playBirthdayChime,
  }));

  // Pre-compute the falling pieces so they don't reshuffle every render.
  const gifts = useMemo(() => {
    const rand = seededRandom(event.id);
    return Array.from({ length: 18 }, (_, i) => ({
      piece: PIECES[i % PIECES.length],
      left: rand() * 100,
      delay: rand() * 1.5,
      duration: 4 + rand() * 3,
      rotation: rand() * 360,
      scale: 0.7 + rand() * 0.5,
    }));
  }, [event.id]);

  return (
    <>
      {!calm && <div className="gift-rain" aria-hidden>
        {gifts.map((g, i) => (
          <motion.span
            key={i}
            className="gift"
            style={{ left: `${g.left}%`, scale: g.scale }}
            initial={{ y: -120, rotate: g.rotation, opacity: 0 }}
            animate={{
              y: '110vh',
              rotate: g.rotation + 720,
              opacity: [0, 1, 1, 0],
              transition: { delay: g.delay, duration: g.duration, ease: 'linear' },
            }}
          >
            {g.piece(i)}
          </motion.span>
        ))}
      </div>}

      <BannerShell className={calm ? 'birthday calm' : 'birthday'}>
        {/* Bunting strung across the top of the band. Hung even in calm mode —
            it is static decoration, not a celebration effect, and a late
            arrival's banner should still look like a birthday. */}
        <span className="birthday-garland" aria-hidden>
          <GarlandArt />
        </span>

        <motion.span
          className="cake"
          aria-hidden
          /* Rise and settle on entry, THEN the wiggle — a spring landing reads
             as the cake being set down, where the old loop-only version just
             started shaking. Kept still in calm mode. */
          initial={{ y: 26, scale: 0.86, rotate: -4 }}
          animate={calm
            ? { y: 0, scale: 1, rotate: 0 }
            : {
                y: [26, 0, 0],
                scale: [0.86, 1.06, 1],
                rotate: [-4, 2, 0],
              }}
          transition={calm
            ? { duration: 0.5, ease: 'easeOut' }
            : { duration: 0.75, times: [0, 0.65, 1], ease: 'easeOut' }}
        >
          <motion.span
            className="cake-wiggle"
            animate={calm ? undefined : { scale: [1, 1.14, 1], rotate: [0, -5, 5, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.75 }}
          >
            <CakeArt />
            {/* Candle flames. Two small flickers, offset so they don't pulse in
                lockstep. There is deliberately no candle COUNT: the privacy
                contract carries no birth year, so the display cannot know an
                age and must never imply one. */}
            {!calm && (
              <span className="cake-flames" aria-hidden>
                <motion.span
                  className="cake-flame cake-flame--a"
                  animate={{ scaleY: [1, 1.35, 0.9, 1.2, 1], opacity: [0.85, 1, 0.8, 1, 0.85] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.span
                  className="cake-flame cake-flame--b"
                  animate={{ scaleY: [1, 0.9, 1.3, 0.95, 1], opacity: [0.9, 0.8, 1, 0.85, 0.9] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                />
              </span>
            )}
          </motion.span>
        </motion.span>
        <div className="banner-text">
          <Eyebrow>Happy Birthday</Eyebrow>
          <motion.h1 variants={bannerNameStagger}>
            <AnimatedName name={`${event.firstName}!`} />
          </motion.h1>
          <motion.span variants={bannerItem} className="tagline">
            Hip hip hooray &mdash; it&rsquo;s your special day!
          </motion.span>
        </div>
      </BannerShell>
    </>
  );
}
