import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireFirstTimer } from '../lib/confetti.js';
import { playFirstTimerChime } from '../lib/audio.js';
import { celebrationProfile, useCelebration } from '../hooks/useCelebration.js';
import BannerShell, { Eyebrow, bannerItem, bannerNameStagger } from './BannerShell.jsx';
import AnimatedName from './AnimatedName.jsx';
import ClubBadge from './ClubBadge.jsx';

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

/**
 * Golden-band banner for a kid's very first night, crowned by the red
 * "First time!" starburst sticker.
 */
export default function FirstTimerBanner({ event, audioEnabled }) {
  const club = getClubPalette(event.club);

  const calm = event.presentation === 'replay' || event.presentation === 'late';
  useCelebration(event.id, audioEnabled, celebrationProfile(event.presentation, {
    confetti: fireFirstTimer,
    chime: playFirstTimerChime,
  }));

  return (
    <BannerShell className={calm ? 'first-timer calm' : 'first-timer'} decorations={<FirstTimeBurst />}>
      <div className="banner-text">
        <Eyebrow>Welcome to Awana Clubs</Eyebrow>
        <motion.h1 variants={bannerNameStagger}>
          <AnimatedName name={`${event.firstName}!`} />
        </motion.h1>
        <motion.span variants={bannerItem} className="tagline">
          We&rsquo;re so glad you&rsquo;re here for the very first time!
        </motion.span>
      </div>
      <ClubBadge club={club} rawName={event.club} />
    </BannerShell>
  );
}
