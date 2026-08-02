import { M } from '../lib/motion.jsx';

/**
 * The kid's name with a joyful staggered bounce — each letter springs in
 * with a little overshoot, then settles into a gentle rolling bob (a
 * staggered ±3px wave across the letters) so the name keeps dancing for
 * the whole time the banner is up. Rendered inside a banner's M.h1,
 * so the outer spans pick up the container's variant orchestration
 * automatically; the bob runs on an inner span so the two transforms
 * never fight over the same element.
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

// Entrance springs finish around here; the bob starts after so the
// overshoot never collides with the loop.
const BOB_START_DELAY = 1.1;

const letterVariant = {
  hidden: { opacity: 0, y: 34, rotate: -8 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 500, damping: 18 } },
};

const wordVariant = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } },
};

function Bob({ index, amount, children }) {
  return (
    <M.span
      style={{ display: 'inline-block' }}
      animate={{ y: [0, -amount, 0] }}
      transition={{
        duration: 2.6,
        delay: BOB_START_DELAY + index * 0.09,
        repeat: Infinity,
        repeatDelay: 0.4,
        ease: 'easeInOut',
      }}
    >
      {children}
    </M.span>
  );
}

export default function AnimatedName({ name }) {
  const text = typeof name === 'string' ? name : '';
  const words = text.split(' ').filter(Boolean);
  const perLetter = text.length <= PER_LETTER_MAX;

  // Letters are staggered by their position in the whole name, not the
  // word, so the bob rolls across the name as one continuous wave.
  let letterIndex = 0;

  return words.map((word, w) => (
    // A trailing space after each word (outside the inline-block spans)
    // preserves natural line wrapping for long names.
    <span key={w} className="name-word">
      {perLetter
        ? Array.from(word).map((ch, i) => (
            <M.span key={i} className="name-letter" variants={letterVariant}>
              <Bob index={letterIndex++} amount={4}>{ch}</Bob>
            </M.span>
          ))
        : (
            <M.span className="name-letter" variants={wordVariant}>
              <Bob index={w * 2} amount={3}>{word}</Bob>
            </M.span>
          )}
      {w < words.length - 1 ? ' ' : ''}
    </span>
  ));
}
