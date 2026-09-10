import { M } from '../lib/motion.jsx';
import { NAME_ENTRANCES } from '../lib/nameAccent.js';

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

/**
 * Per-letter entrance styles, keyed by the ids in lib/nameAccent.js (#336).
 * Each child is dealt one from their own seeded stream, so "their" banner
 * flies in the same way every week — the same personal touch the tilt and the
 * sparkle already were, but visible from across the lobby.
 *
 * `hidden` may be a function of the letter's index (framer-motion passes the
 * `custom` prop), which is what lets `wave` shape its start heights along a
 * sine instead of starting every letter from the same place.
 */
const ENTRANCES = {
  // The original entrance, unchanged — up from below with a little overshoot
  // and a twist. Still the default for any caller that passes no entrance.
  pop: {
    hidden: { opacity: 0, y: 34, rotate: -8 },
    show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 500, damping: 18 } },
  },
  // A rolling wave: neighbouring letters start at different heights (some
  // above the line, some below), so the name unfurls rather than arriving as
  // one row. Softer spring, because the offsets are already doing the work.
  wave: {
    hidden: (index = 0) => ({ opacity: 0, y: 26 * Math.sin(index * 0.9 + 0.4), rotate: 0 }),
    show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 330, damping: 20 } },
  },
  // Straight down from above and heavily damped, so the letters LAND rather
  // than bounce — the calmest of the three.
  drop: {
    hidden: { opacity: 0, y: -46, rotate: 0 },
    show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 420, damping: 30 } },
  },
};

// Belt and braces: the id list lives in nameAccent.js (it is the seeded draw's
// contract) and the variants live here, so a new id added there without a
// variant here would silently fall back to `pop`. Fail loudly in dev instead.
if (import.meta.env?.DEV) {
  for (const id of NAME_ENTRANCES) {
    if (!ENTRANCES[id]) console.warn(`AnimatedName: no variant for entrance '${id}'`);
  }
}

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

export default function AnimatedName({ name, entrance = 'pop' }) {
  const text = typeof name === 'string' ? name : '';
  const words = text.split(' ').filter(Boolean);
  const perLetter = text.length <= PER_LETTER_MAX;
  // An unknown id (an old cached accent, a typo) reads as the original
  // entrance rather than as a name that never appears.
  const letterVariant = ENTRANCES[entrance] ?? ENTRANCES.pop;

  // Letters are staggered by their position in the whole name, not the
  // word, so the bob rolls across the name as one continuous wave.
  let letterIndex = 0;

  return words.map((word, w) => (
    // A trailing space after each word (outside the inline-block spans)
    // preserves natural line wrapping for long names.
    <span key={w} className="name-word">
      {perLetter
        ? Array.from(word).map((ch, i) => {
            // Captured before the increment: `custom` and the bob's phase are
            // the same position in the whole name, so the entrance wave and
            // the idle bob roll in the same direction.
            const at = letterIndex++;
            return (
              <M.span key={i} className="name-letter" variants={letterVariant} custom={at}>
                <Bob index={at} amount={4}>{ch}</Bob>
              </M.span>
            );
          })
        : (
            <M.span className="name-letter" variants={wordVariant}>
              <Bob index={w * 2} amount={3}>{word}</Bob>
            </M.span>
          )}
      {w < words.length - 1 ? ' ' : ''}
    </span>
  ));
}
