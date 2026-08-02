import React from 'react';
import { motion } from 'framer-motion';
import { DUR, EASE } from '../lib/motion-tokens.js';

function formatDays(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
}

/**
 * Upcoming theme nights as plain blocky text lines — no pill, glow, or
 * emoji, matching the flat white-wall countdown treatment.
 */
export const EventChips = ({ events }) => {
  const special = events.filter((e) => e.isSpecial).slice(0, 4);
  if (special.length === 0) return null;

  return (
    // data-live: content depends on the real calendar/wall clock, so
    // visual-regression tests mask this region (e2e/countdown.visual.spec.js).
    <div className="mt-8 flex flex-col items-center gap-2" data-live>
      {special.map((event, idx) => (
        <motion.p
          key={`${event.title}-${event.daysUntil}`}
          className="uppercase text-center whitespace-nowrap"
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            letterSpacing: '0.08em',
            fontSize: 'clamp(1.1rem, 1.8vw, 2.2rem)',
            color: '#FFFFFF',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.base, ease: EASE.smooth, delay: idx * 0.1 }}
        >
          {event.title}
          <span style={{ color: 'rgba(255,255,255,0.55)' }}> · {formatDays(event.daysUntil)}</span>
        </motion.p>
      ))}
    </div>
  );
};
