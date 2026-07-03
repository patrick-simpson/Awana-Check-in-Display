import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireStandard } from '../lib/confetti.js';
import { playChime } from '../lib/audio.js';
import Doodles from './Doodles.jsx';

export default function WelcomeBanner({ event, audioEnabled }) {
  const club = getClubPalette(event.club);

  // Read audio state through a ref so toggling sound mid-banner doesn't
  // re-fire the confetti effect.
  const audioRef = useRef(audioEnabled);
  useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);

  useEffect(() => {
    fireStandard(club.confetti);
    if (audioRef.current) playChime();
  }, [event.id, club.confetti]);

  return (
    <motion.div
      className="banner"
      style={{
        '--club-primary': club.primary,
        '--club-deep': club.deep,
        '--club-accent': club.accent,
      }}
      initial={{ opacity: 0, scale: 0.6, y: 60 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 180, damping: 16 },
      }}
      exit={{ opacity: 0, scale: 0.85, y: -40, transition: { duration: 0.35 } }}
    >
      <Doodles />
      <span className="eyebrow">Welcome</span>
      <h1>{event.firstName}!</h1>
      {(club.name || event.club) && (
        <span className="club-chip">
          <strong>{club.name || event.club}</strong>
          {club.ages && <span className="chip-ages">{club.ages}</span>}
        </span>
      )}
      <span className="tagline">{club.tagline}</span>
    </motion.div>
  );
}
