import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireStandard } from '../lib/confetti.js';
import { playChime } from '../lib/audio.js';

export default function WelcomeBanner({ event, audioEnabled }) {
  const palette = getClubPalette(event.club);

  // Read audio state through a ref so toggling sound mid-banner doesn't
  // re-fire the confetti effect.
  const audioRef = useRef(audioEnabled);
  useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);

  useEffect(() => {
    fireStandard(palette.confetti);
    if (audioRef.current) playChime();
  }, [event.id, palette.confetti]);

  return (
    <motion.div
      className="banner"
      style={{ '--club-primary': palette.primary, '--club-accent': palette.accent }}
      initial={{ opacity: 0, scale: 0.6, y: 60 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 180, damping: 16 },
      }}
      exit={{ opacity: 0, scale: 0.85, y: -40, transition: { duration: 0.35 } }}
    >
      <span className="eyebrow">Welcome</span>
      <h1>{event.firstName}!</h1>
      {event.club && <span className="club-label">{event.club}</span>}
    </motion.div>
  );
}
