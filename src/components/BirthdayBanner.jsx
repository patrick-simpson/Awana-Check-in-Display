import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { fireBirthday } from '../lib/confetti.js';
import { playBirthdayChime } from '../lib/audio.js';

const GIFTS = ['🎁', '🎈', '🎉', '🎊', '⭐'];

export default function BirthdayBanner({ event, audioEnabled }) {
  useEffect(() => {
    fireBirthday();
    if (audioEnabled) playBirthdayChime();
  }, [event.id, audioEnabled]);

  // Pre-compute the falling gift positions so they don't reshuffle every render.
  const gifts = useMemo(
    () => Array.from({ length: 18 }, (_, i) => ({
      emoji: GIFTS[i % GIFTS.length],
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 4 + Math.random() * 3,
      rotation: Math.random() * 360,
    })),
    [event.id],
  );

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
