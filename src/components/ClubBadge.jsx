import { motion, useReducedMotion } from 'framer-motion';

/**
 * The club identity on a banner: the official catalog logo when we have
 * one (white-on-transparent, extracted via scripts/extract-club-logos.py),
 * otherwise a styled club-title pill so Trek/Journey/unknown clubs still
 * look intentional. Pops in like a sticker being slapped on (low damping
 * for a visible wobble), then floats gently for as long as the banner is
 * up — unless the viewer prefers reduced motion.
 */
const logoPop = {
  hidden: { opacity: 0, scale: 0.3, rotate: -12 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 12 } },
};

export default function ClubBadge({ club, rawName }) {
  const reduced = useReducedMotion();
  const title = club.name || rawName || '';
  if (!club.logo && !title) return null;

  return (
    <motion.span className="club-logo-slot" variants={logoPop}>
      {club.logo ? (
        <motion.img
          className="club-logo"
          src={club.logo}
          alt={`${title || 'Club'} logo`}
          animate={reduced ? undefined : { y: [0, -7, 0], rotate: [-1.5, 1.5, -1.5] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <span className="club-title-fallback">{title}</span>
      )}
    </motion.span>
  );
}
