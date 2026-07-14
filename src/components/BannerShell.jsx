import { motion } from 'framer-motion';
import Doodles, { BandSparkles } from './Doodles.jsx';
import BannerWave from './BannerWave.jsx';

/**
 * Shared lower-third wave band all three banner variants ride: rises
 * from the bottom edge like the catalog's orange wave (so the top
 * two-thirds of the background slides stay visible), then staggers its
 * children in. Transform/opacity only, so it stays smooth on low-power
 * signage hardware.
 *
 * Owns everything the variants used to copy-paste: the container spring
 * and its exit, the wave crest, the drifting tone-on-tone blob, the band
 * sparkles and the doodle field. Each banner supplies its own band class
 * (club colors / birthday / first-timer), any `decorations` that must be
 * positioned against the band itself (e.g. the first-timer starburst),
 * and the `.banner-content` children.
 */
export const bannerContainer = {
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

export const bannerItem = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } },
};

// The h1 rides the normal stagger slot, then staggers its own letters.
export const bannerNameStagger = {
  hidden: bannerItem.hidden,
  show: {
    ...bannerItem.show,
    transition: { ...bannerItem.show.transition, staggerChildren: 0.035 },
  },
};

/** The pulsing condensed line above the name ("Welcome", "Happy Birthday"…). */
export function Eyebrow({ children }) {
  return (
    <motion.span variants={bannerItem} className="eyebrow">
      <motion.span
        animate={{ opacity: [0.82, 1, 0.82] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

export default function BannerShell({ className = '', style, decorations, children }) {
  return (
    <motion.div
      className={`banner ${className}`.trim()}
      style={style}
      variants={bannerContainer}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <BannerWave />
      {/* A soft accent blob drifting inside the band — the catalog's
          tone-on-tone depth — plus sparkles glittering in the color. */}
      <div className="band-blob-clip" aria-hidden>
        <motion.div
          className="band-blob"
          animate={{ x: [0, 28, 0], rotate: [0, 5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <BandSparkles />
      <Doodles />
      {decorations}
      <div className="banner-content">{children}</div>
    </motion.div>
  );
}
