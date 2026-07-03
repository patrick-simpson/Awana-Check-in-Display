import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireFirstTimer } from '../lib/confetti.js';
import { playFirstTimerChime } from '../lib/audio.js';
import Doodles from './Doodles.jsx';

export default function FirstTimerBanner({ event, audioEnabled }) {
  const club = getClubPalette(event.club);

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
      <Doodles />
      <span className="eyebrow">Welcome to Awana Clubs</span>
      <h1>{event.firstName}!</h1>
      {club.name && (
        <span className="club-chip">
          <strong>{club.name}</strong>
          {club.ages && <span className="chip-ages">{club.ages}</span>}
        </span>
      )}
      <span className="tagline">We&rsquo;re so glad you&rsquo;re here for the very first time!</span>
    </motion.div>
  );
}
