import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireFirstTimer } from '../lib/confetti.js';
import { playFirstTimerChime } from '../lib/audio.js';
import Doodles from './Doodles.jsx';

// Staggered reveal like WelcomeBanner — card first, then each line.
const container = {
  hidden: { opacity: 0, scale: 0.5 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring', stiffness: 160, damping: 15,
      delayChildren: 0.12, staggerChildren: 0.09,
    },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.4 } },
};

const item = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } },
};

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
      variants={container}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <div className="halo" aria-hidden />
      <Doodles />
      <motion.span variants={item} className="eyebrow">Welcome to Awana Clubs</motion.span>
      <motion.h1 variants={item}>{event.firstName}!</motion.h1>
      {club.name && (
        <motion.span variants={item} className="club-chip">
          <strong>{club.name}</strong>
          {club.ages && <span className="chip-ages">{club.ages}</span>}
        </motion.span>
      )}
      <motion.span variants={item} className="tagline">We&rsquo;re so glad you&rsquo;re here for the very first time!</motion.span>
    </motion.div>
  );
}
