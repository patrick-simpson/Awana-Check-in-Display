import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireStandard } from '../lib/confetti.js';
import { playChime } from '../lib/audio.js';
import Doodles from './Doodles.jsx';
import AnimatedName from './AnimatedName.jsx';
import ClubBadge from './ClubBadge.jsx';
import BannerWave from './BannerWave.jsx';

// Lower-third wave band: rises from the bottom edge like the catalog's
// orange wave, so the top two-thirds of the background slides stay
// visible. The band lands first, then the eyebrow, name (letter by
// letter), and club logo follow. Transform/opacity only, so it stays
// smooth on low-power signage hardware.
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
      variants={container}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <BannerWave />
      <Doodles />
      <div className="banner-content">
        <div className="banner-text">
          <motion.span variants={item} className="eyebrow">Welcome</motion.span>
          <motion.h1 variants={nameStagger}>
            <AnimatedName name={`${event.firstName}!`} />
          </motion.h1>
        </div>
        <ClubBadge club={club} rawName={event.club} />
      </div>
    </motion.div>
  );
}
