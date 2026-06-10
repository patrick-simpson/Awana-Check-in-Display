import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { fireBirthday } from '../lib/confetti.js';
import { playBirthdayChime } from '../lib/audio.js';

const GIFTS = ['🎁', '🎈', '🎉', '🎊', '⭐'];

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
        initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
        animate={{
          opacity: 1, scale: 1, rotate: 0,
          transition: { type: 'spring', stiffness: 140, damping: 14 },
        }}
        exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.4 } }}
      >
        <motion.span
          className="cake"
          aria-hidden
          animate={{ scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          🎂
        </motion.span>
        <span className="eyebrow">Happy Birthday</span>
        <h1>{event.firstName}!</h1>
      </motion.div>
    </>
  );
}
