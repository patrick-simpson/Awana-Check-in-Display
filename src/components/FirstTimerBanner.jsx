import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { fireFirstTimer } from '../lib/confetti.js';
import { playFirstTimerChime } from '../lib/audio.js';

export default function FirstTimerBanner({ event, audioEnabled }) {
  // Read audio state through a ref so toggling sound mid-banner doesn't
  // re-fire the confetti effect.
  const audioRef = useRef(audioEnabled);
  useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);

  useEffect(() => {
    fireFirstTimer();
    if (audioRef.current) playFirstTimerChime();
  }, [event.id]);

  return (
    <motion.div
      className="banner first-timer"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{
        opacity: 1, scale: 1,
        transition: { type: 'spring', stiffness: 160, damping: 15 },
      }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.4 } }}
    >
      <div className="halo" aria-hidden />
      <span className="eyebrow">Welcome to Awana</span>
      <h1>{event.firstName}!</h1>
      <span className="club-label">So glad you're here</span>
    </motion.div>
  );
}
