import { M } from '../lib/motion.jsx';
import { getClubPalette } from '../lib/clubs.js';
import { fireStandard } from '../lib/confetti.js';
import { playChime } from '../lib/audio.js';
import { celebrationProfile, useCelebration } from '../hooks/useCelebration.js';
import BannerShell, { Eyebrow, bannerItem, bannerNameStagger } from './BannerShell.jsx';
import AnimatedName from './AnimatedName.jsx';
import ClubBadge from './ClubBadge.jsx';

// A round rosette seal — the "returning champion" cousin of the first-timer
// starburst. Scalloped edge (16 lobes) rather than spikes: familiar and warm
// where the starburst is loud and new.
const SEAL_POINTS = Array.from({ length: 64 }, (_, i) => {
  const r = 54 + 6 * Math.sin((i * Math.PI) / 4);
  const a = (i * Math.PI) / 32;
  return `${(64 + r * Math.cos(a)).toFixed(1)},${(64 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

function WelcomeBackSeal() {
  return (
    <M.div
      className="welcome-back-seal"
      aria-hidden
      initial={{ scale: 0, rotate: 20 }}
      animate={{ scale: 1, rotate: 6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 13, delay: 0.55 }}
    >
      <M.div
        className="welcome-back-seal-inner"
        animate={{ rotate: [3, -3, 3] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg viewBox="0 0 128 128" aria-hidden>
          <polygon points={SEAL_POINTS} fill="var(--awana-blue, #1d4ed8)" />
        </svg>
        <span>Welcome<br />back!</span>
      </M.div>
    </M.div>
  );
}

/**
 * Banner for a RETURNING kid's first night of the season (#9) — the sealed
 * `welcomeBack` flag from the printer. First-ever kids get FirstTimerBanner
 * instead; the producer guarantees the flags never overlap.
 */
export default function WelcomeBackBanner({ event, audioEnabled }) {
  const club = getClubPalette(event.club);

  const calm = event.presentation === 'replay' || event.presentation === 'late';
  useCelebration(event.id, audioEnabled, celebrationProfile(event.presentation, {
    confetti: fireStandard,
    chime: playChime,
  }));

  return (
    <BannerShell className={calm ? 'welcome-back calm' : 'welcome-back'} decorations={<WelcomeBackSeal />}>
      <div className="banner-text">
        <Eyebrow>Great to see you again</Eyebrow>
        <M.h1 variants={bannerNameStagger}>
          <AnimatedName name={`${event.firstName}!`} />
        </M.h1>
        <M.span variants={bannerItem} className="tagline">
          Welcome back for a brand-new season!
        </M.span>
      </div>
      <ClubBadge club={club} rawName={event.club} />
    </BannerShell>
  );
}
