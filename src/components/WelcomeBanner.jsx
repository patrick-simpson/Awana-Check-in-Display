import { motion } from 'framer-motion';
import { getClubPalette } from '../lib/clubs.js';
import { fireStandard } from '../lib/confetti.js';
import { playChime } from '../lib/audio.js';
import { nameAccent } from '../lib/nameAccent.js';
import { celebrationProfile, useCelebration } from '../hooks/useCelebration.js';
import BannerShell, { Eyebrow, bannerItem, bannerNameStagger } from './BannerShell.jsx';
import AnimatedName from './AnimatedName.jsx';
import ClubBadge from './ClubBadge.jsx';
import { Mark } from './Doodles.jsx';

/**
 * The standard check-in banner: club-colored wave band, "Welcome",
 * the kid's name letter by letter, then the club wordmark (and mascot
 * sticker, for clubs that have one) popping in on the right.
 *
 * Each name gets a deterministic accent (gentle tilt, twinkle phase,
 * maybe an extra sparkle) seeded from the name itself — the same kid
 * sees the same flourish every week (#8). An optional per-club phrase
 * from config renders under the name (#15).
 */
export default function WelcomeBanner({ event, audioEnabled, clubPhrases }) {
  const club = getClubPalette(event.club);
  const calm = event.presentation === 'replay' || event.presentation === 'late';
  const accent = nameAccent(event.firstName);
  const phrase = clubPhrases?.[String(event.club ?? '').trim().toLowerCase()];

  useCelebration(event.id, audioEnabled, celebrationProfile(event.presentation, {
    confetti: () => fireStandard(club.confetti),
    chime: playChime,
  }));

  return (
    <BannerShell
      className={calm ? 'calm' : ''}
      doodlePhase={accent.doodlePhase}
      style={{
        '--club-primary': club.primary,
        '--club-deep': club.deep,
        '--club-accent': club.accent,
      }}
    >
      <div className="banner-text">
        <Eyebrow>{event.presentation === 'replay' ? 'Also joined us tonight' : 'Welcome'}</Eyebrow>
        <motion.h1 variants={bannerNameStagger} style={{ rotate: accent.tilt }}>
          <AnimatedName name={`${event.firstName}!`} />
          {accent.sparkle && (
            <motion.span
              className="name-sparkle"
              aria-hidden
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.7, 1.2, 0.7], rotate: [0, 20, 0] }}
              transition={{ duration: 2.4, delay: accent.doodlePhase, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Mark kind="sparkle" size={28} />
            </motion.span>
          )}
        </motion.h1>
        {phrase && (
          <motion.span className="club-phrase" variants={bannerItem}>
            {phrase}
          </motion.span>
        )}
      </div>
      <ClubBadge club={club} rawName={event.club} />
    </BannerShell>
  );
}
