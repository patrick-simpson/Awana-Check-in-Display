import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { isFresh } from '../lib/freshness.js';
import { NOTICE_MAX_AGE_MS } from '../lib/constants.js';

// Same coarse cadence as TonightTicker — expiry is measured in hours,
// so a 30s re-check is more than fine-grained enough.
const FRESHNESS_CHECK_MS = 30000;

const EYEBROW = { critical: 'Attention', warn: 'Notice', info: 'FYI' };

/**
 * Church-authored announcement banner for the `onNotice` broadcast
 * ('info' | 'warn' | 'critical'). One component, three weights, so the
 * severity is always rendered consistently instead of leaving each
 * caller to reinvent "how urgent does this look":
 *
 *   - critical — full-width bar pinned to the very top of the stage at
 *     the app's highest z-index, above even an active check-in banner.
 *     "CLUB CANCELLED TONIGHT" must never lose the fight with a
 *     birthday banner for a parent's attention.
 *   - warn — a smaller centered strip, still well above idle content.
 *   - info — the quietest: a small corner chip, tucked opposite the
 *     status dot so it never competes with the corner widgets.
 *
 * `message` is bounded plain text by the sanitizer (src/lib/eventSanitizers.js)
 * before it ever reaches this component, but it is rendered here as an
 * ordinary React text child — never `dangerouslySetInnerHTML` — so the
 * render path itself can't reopen a markup-injection hole even if a
 * future change to the sanitizer slipped.
 *
 * Expires on its own after NOTICE_MAX_AGE_MS so a forgotten cancellation
 * notice can't haunt the screen into next week's club night.
 */
export default function NoticeBanner({ notice }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), FRESHNESS_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  const show = Boolean(notice?.message) && isFresh(notice?.at, NOTICE_MAX_AGE_MS, now);
  const level = show ? notice.level : null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={`${notice.at}-${notice.level}`}
          className={`notice-banner notice-banner--${level}`}
          role={level === 'critical' ? 'alert' : 'status'}
          aria-live={level === 'critical' ? 'assertive' : 'polite'}
          initial={{ opacity: 0, y: level === 'info' ? 12 : -32 }}
          animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          <span className="notice-banner-eyebrow">{EYEBROW[level]}</span>
          <span className="notice-banner-message">{notice.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
