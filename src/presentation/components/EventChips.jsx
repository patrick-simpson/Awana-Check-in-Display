import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from './Badge.jsx';
import { DUR, EASE } from '../lib/motion-tokens.js';

const CHIP_COLORS = ['#E8192C', '#FFC107', '#0072CE', '#00A651'];

function getEventEmoji(title) {
  const lower = title.toLowerCase();
  if (lower.includes('mission')) return '🌍';
  if (lower.includes('verse') || lower.includes('scripture')) return '📖';
  if (lower.includes('movie')) return '🎬';
  if (lower.includes('western') || lower.includes('cowboy')) return '🤠';
  if (lower.includes('superhero') || lower.includes('hero')) return '🦸';
  if (lower.includes('pajama') || lower.includes('pj')) return '😴';
  if (lower.includes('carnival') || lower.includes('fair')) return '🎡';
  if (lower.includes('christmas') || lower.includes('holiday')) return '🎄';
  if (lower.includes('sport') || lower.includes('game')) return '⚽';
  if (lower.includes('space') || lower.includes('galaxy')) return '🚀';
  return '⭐';
}

function formatDays(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
}

/** Upcoming theme-night chips, rebuilt on the catalog Badge. */
export const EventChips = ({ events }) => {
  const special = events.filter((e) => e.isSpecial).slice(0, 4);
  if (special.length === 0) return null;

  return (
    // data-live: content depends on the real calendar/wall clock, so
    // visual-regression tests mask this region (e2e/countdown.visual.spec.js).
    <div className="mt-8 flex justify-center" data-live>
      <div className="flex gap-4 flex-wrap justify-center max-w-4xl">
        {special.map((event, idx) => (
          <motion.div
            key={`${event.title}-${event.daysUntil}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.base, ease: EASE.smooth, delay: idx * 0.1 }}
          >
            <Badge color={CHIP_COLORS[idx % CHIP_COLORS.length]} size="sm" sparkle>
              <span style={{ letterSpacing: 0 }}>{getEventEmoji(event.title)}</span>
              {event.title} · {formatDays(event.daysUntil)}
            </Badge>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
