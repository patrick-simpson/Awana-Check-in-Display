import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireStandard } from '../lib/confetti.js';
import { playChime } from '../lib/audio.js';
import { celebrationProfile, useCelebration } from '../hooks/useCelebration.js';
import BannerShell, { Eyebrow, bannerNameStagger } from './BannerShell.jsx';
import AnimatedName from './AnimatedName.jsx';
import ClubBadge from './ClubBadge.jsx';

/**
 * The standard check-in banner: club-colored wave band, "Welcome",
 * the kid's name letter by letter, then the club wordmark (and mascot
 * sticker, for clubs that have one) popping in on the right.
 */
export default function WelcomeBanner({ event, audioEnabled }) {
  const club = getClubPalette(event.club);
  const calm = event.presentation === 'replay' || event.presentation === 'late';

  useCelebration(event.id, audioEnabled, celebrationProfile(event.presentation, {
    confetti: () => fireStandard(club.confetti),
    chime: playChime,
  }));

  return (
    <BannerShell
      className={calm ? 'calm' : ''}
      style={{
        '--club-primary': club.primary,
        '--club-deep': club.deep,
        '--club-accent': club.accent,
      }}
    >
      <div className="banner-text">
        <Eyebrow>{event.presentation === 'replay' ? 'Also joined us tonight' : 'Welcome'}</Eyebrow>
        <motion.h1 variants={bannerNameStagger}>
          <AnimatedName name={`${event.firstName}!`} />
        </motion.h1>
      </div>
      <ClubBadge club={club} rawName={event.club} />
    </BannerShell>
  );
}
