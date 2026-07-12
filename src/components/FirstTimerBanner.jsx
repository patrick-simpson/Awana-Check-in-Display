import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireFirstTimer } from '../lib/confetti.js';
import { playFirstTimerChime } from '../lib/audio.js';
import Doodles, { BandSparkles } from './Doodles.jsx';
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

// 16-spike starburst polygon — the catalog's "Looking for something
// else?" badge shape. Red so it pops off the golden first-timer band
// (the catalog reserves its red circle badges for exactly this kind of
// "look here!" moment).
const BURST_POINTS = Array.from({ length: 32 }, (_, i) => {
  const r = i % 2 ? 50 : 62;
  const a = (i * Math.PI) / 16;
  return `${(64 + r * Math.cos(a)).toFixed(1)},${(64 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

function FirstTimeBurst() {
  return (
    // Pops in like a sticker after the text lands, then keeps slowly
    // seesawing so it never goes still.
    <motion.div
      className="first-time-burst"
      aria-hidden
      initial={{ scale: 0, rotate: -24 }}
      animate={{ scale: 1, rotate: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 13, delay: 0.55 }}
    >
      <motion.div
        className="first-time-burst-inner"
        animate={{ rotate: [-4, 4, -4] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg viewBox="0 0 128 128" aria-hidden>
          <polygon points={BURST_POINTS} fill="var(--awana-red)" />
        </svg>
        <span>First<br />time!</span>
      </motion.div>
    </motion.div>
  );
}

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
      <div className="band-blob-clip" aria-hidden>
        <motion.div
          className="band-blob"
          animate={{ x: [0, 28, 0], rotate: [0, 5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <BandSparkles />
      <Doodles />
      <FirstTimeBurst />
      <div className="banner-content">
        <div className="banner-text">
          <motion.span variants={item} className="eyebrow">
            <motion.span
              animate={{ opacity: [0.82, 1, 0.82] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              Welcome to Awana Clubs
            </motion.span>
          </motion.span>
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
