import { motion } from 'framer-motion';

/**
 * The kid's name with a joyful staggered bounce — each letter springs in
 * with a little overshoot. Rendered inside a banner's motion.h1, so the
 * spans pick up the container's variant orchestration automatically.
 *
 * Long names (or many-word names) animate per word instead of per letter:
 * a 40-char name at per-letter stagger would take well over a second and
 * run dozens of springs per frame on a cheap signage stick.
 *
 * No exit variants on purpose — the banner card's container-level exit
 * animates the whole banner out; per-letter exits would delay unmount and
 * stutter back-to-back banners during a check-in rush.
 */
const PER_LETTER_MAX = 14;

const letterVariant = {
  hidden: { opacity: 0, y: 34, rotate: -8 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 500, damping: 18 } },
};

const wordVariant = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } },
};

export default function AnimatedName({ name }) {
  const text = typeof name === 'string' ? name : '';
  const words = text.split(' ').filter(Boolean);
  const perLetter = text.length <= PER_LETTER_MAX;

  return words.map((word, w) => (
    // A trailing space after each word (outside the inline-block spans)
    // preserves natural line wrapping for long names.
    <span key={w} className="name-word">
      {perLetter
        ? Array.from(word).map((ch, i) => (
            <motion.span key={i} className="name-letter" variants={letterVariant}>
              {ch}
            </motion.span>
          ))
        : <motion.span className="name-letter" variants={wordVariant}>{word}</motion.span>}
      {w < words.length - 1 ? ' ' : ''}
    </span>
  ));
}
