import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { fireBirthday } from '../lib/confetti.js';
import { playBirthdayChime } from '../lib/audio.js';
import { celebrationProfile, useCelebration } from '../hooks/useCelebration.js';
import BannerShell, { Eyebrow, bannerItem, bannerNameStagger } from './BannerShell.jsx';
import AnimatedName from './AnimatedName.jsx';
import { CakeArt, GiftArt, BalloonArt, StarArt } from './BirthdayArt.jsx';

// The falling pieces cycle chunky SVG art in a bright kid palette —
// identical on every TV, unlike the OS emoji this replaced.
const PIECES = [
  (key) => <GiftArt key={key} color="#ffd257" />,
  (key) => <BalloonArt key={key} color="#4fc3f7" />,
  (key) => <StarArt key={key} color="#fff6e3" />,
  (key) => <GiftArt key={key} color="#aed581" />,
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
        <motion.span
          className="cake"
          aria-hidden
          animate={{ scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <CakeArt />
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
