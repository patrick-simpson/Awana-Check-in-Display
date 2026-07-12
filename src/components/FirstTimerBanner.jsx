import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireFirstTimer } from '../lib/confetti.js';
import { playFirstTimerChime } from '../lib/audio.js';
import Doodles from './Doodles.jsx';
import AnimatedName from './AnimatedName.jsx';
import ClubBadge from './ClubBadge.jsx';
import BannerWave from './BannerWave.jsx';

// Lower-third wave band like WelcomeBanner — rises from the bottom,
// then each line staggers in.
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
      <BannerWave />
      <Doodles />
      <div className="banner-content">
        <div className="banner-text">
          <motion.span variants={item} className="eyebrow">Welcome to Awana Clubs</motion.span>
          <motion.h1 variants={nameStagger}>
            <AnimatedName name={`${event.firstName}!`} />
          </motion.h1>
          <motion.span variants={item} className="tagline">We&rsquo;re so glad you&rsquo;re here for the very first time!</motion.span>
        </div>
        <ClubBadge club={club} rawName={event.club} />
      </div>
    </motion.div>
  );
}
