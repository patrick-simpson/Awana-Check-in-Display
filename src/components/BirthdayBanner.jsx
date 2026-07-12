import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { fireBirthday } from '../lib/confetti.js';
import { playBirthdayChime } from '../lib/audio.js';
import Doodles, { BandSparkles } from './Doodles.jsx';
import AnimatedName from './AnimatedName.jsx';
import BannerWave from './BannerWave.jsx';

const GIFTS = ['🎁', '🎈', '🎉', '🎊', '⭐'];

// Lower-third wave band like WelcomeBanner — rises from the bottom,
// then each line staggers in. The cake keeps its own looping wiggle
// animation outside the stagger.
const container = {
  hidden: { y: '115%' },
  show: {
    y: 0,
    transition: {
      type: 'spring', stiffness: 150, damping: 19,
      delayChildren: 0.12, staggerChildren: 0.09,
    },
  },
  exit: { y: '115%', transition: { duration: 0.4, ease: 'easeIn' } },
};

const item = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } },
};

// The h1 rides the normal stagger slot, then staggers its own letters.
const nameStagger = {
  hidden: item.hidden,
  show: { ...item.show, transition: { ...item.show.transition, staggerChildren: 0.035 } },
};

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

export default function BirthdayBanner({ event, audioEnabled }) {
  // Read audio state through a ref so toggling sound mid-banner doesn't
  // re-fire the confetti effect.
  const audioRef = useRef(audioEnabled);
  useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);

  useEffect(() => {
    fireBirthday();
    if (audioRef.current) playBirthdayChime();
  }, [event.id]);

  // Pre-compute the falling gift positions so they don't reshuffle every render.
  const gifts = useMemo(() => {
    const rand = seededRandom(event.id);
    return Array.from({ length: 18 }, (_, i) => ({
      emoji: GIFTS[i % GIFTS.length],
      left: rand() * 100,
      delay: rand() * 1.5,
      duration: 4 + rand() * 3,
      rotation: rand() * 360,
    }));
  }, [event.id]);

  return (
    <>
      <div className="gift-rain" aria-hidden>
        {gifts.map((g, i) => (
          <motion.span
            key={i}
            className="gift"
            style={{ left: `${g.left}%` }}
            initial={{ y: -120, rotate: g.rotation, opacity: 0 }}
            animate={{
              y: '110vh',
              rotate: g.rotation + 720,
              opacity: [0, 1, 1, 0],
              transition: { delay: g.delay, duration: g.duration, ease: 'linear' },
            }}
          >
            {g.emoji}
          </motion.span>
        ))}
      </div>

      <motion.div
        className="banner birthday"
        variants={container}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <BannerWave />
        <div className="band-blob-clip" aria-hidden>
          <motion.div
            className="band-blob"
            animate={{ x: [0, 28, 0], rotate: [0, 5, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <BandSparkles />
        <Doodles />
        <div className="banner-content">
          <motion.span
            className="cake"
            aria-hidden
            animate={{ scale: [1, 1.22, 1], rotate: [0, -7, 7, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            🎂
          </motion.span>
          <div className="banner-text">
            <motion.span variants={item} className="eyebrow">
              <motion.span
                animate={{ opacity: [0.82, 1, 0.82] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                Happy Birthday
              </motion.span>
            </motion.span>
            <motion.h1 variants={nameStagger}>
              <AnimatedName name={`${event.firstName}!`} />
            </motion.h1>
            <motion.span variants={item} className="tagline">Hip hip hooray — it&rsquo;s your special day!</motion.span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
