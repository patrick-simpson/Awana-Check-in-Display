import { motion } from 'framer-motion';
import { Mark } from './Doodles.jsx';

/**
 * Catalog "sticker tab" — the chrome treatment lifted from the catalog's
 * AGES/GRADES badges: a dark rounded tab with a chunky cream die-cut
 * border, a small condensed label tab overlapping its top edge, and an
 * occasional sparkle winking from a corner. Every fixed widget (clock,
 * weather, status, tally) renders inside one so the chrome reads as a
 * set of hand-placed stickers instead of generic glass pills.
 *
 * The root is a motion.div so the tilt rides framer-motion's transform
 * (never CSS transform — the two would fight), letting each sticker pop
 * on with a springy little slap. `...rest` forwards role/aria-* straight
 * to the root, so consumers keep their accessibility contracts.
 */
const pop = {
  hidden: { opacity: 0, scale: 0.5 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 15 },
  },
};

export default function StickerChip({
  label,
  tilt = 0,
  sparkle = false,
  sparkleDelay = 0,
  className = '',
  children,
  ...rest
}) {
  return (
    <motion.div
      className={`sticker-chip ${className}`.trim()}
      style={{ rotate: tilt }}
      variants={pop}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {label && (
        <span className="sticker-chip-label" aria-hidden>
          {label}
        </span>
      )}
      {children}
      {sparkle && (
        <motion.span
          className="sticker-chip-spark"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 0], scale: [0.5, 0.5, 1.2, 0.5], rotate: [0, 0, 24, 0] }}
          transition={{
            duration: 8,
            delay: sparkleDelay,
            times: [0, 0.82, 0.91, 1],
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Mark kind="sparkle" size={18} />
        </motion.span>
      )}
    </motion.div>
  );
}
