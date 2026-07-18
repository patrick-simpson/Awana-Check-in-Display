import React, { useMemo } from 'react';
import { useLowPower } from '../hooks/useLowPower.js';

/** The one orb table (previously duplicated in CountdownView and Slide). */
const ORBS = [
  { color: '#E8192C', size: '70vw', top: '-22%', left: '-18%', duration: 28, delay: 0, opacity: 0.25 },
  { color: '#FFC107', size: '48vw', top: '-16%', left: '64%', duration: 36, delay: -13, opacity: 0.2 },
  { color: '#0072CE', size: '60vw', top: '58%', left: '-14%', duration: 24, delay: -8, opacity: 0.22 },
  { color: '#00A651', size: '44vw', top: '54%', left: '66%', duration: 32, delay: -19, opacity: 0.18 },
  { color: '#FFC107', size: '32vw', top: '34%', left: '36%', duration: 42, delay: -24, opacity: 0.12 },
  { color: '#E8192C', size: '24vw', top: '18%', left: '14%', duration: 27, delay: -6, opacity: 0.11 },
  { color: '#0072CE', size: '22vw', top: '43%', left: '53%', duration: 33, delay: -15, opacity: 0.1 },
  { color: '#00A651', size: '18vw', top: '10%', left: '78%', duration: 45, delay: -30, opacity: 0.09 },
];

/** Cool-weather (rain/snow/thunder/fog) recolor, kept from the old view. */
const COOL_MAP = {
  '#E8192C': '#1a3a5c',
  '#FFC107': '#2a5a8c',
  '#00A651': '#0a3a6c',
};

export const AmbientOrbs = ({ tint, dim = false, variant = 'full' }) => {
  const lowPower = useLowPower();
  const orbs = useMemo(() => {
    let list = variant === 'quiet'
      ? ORBS.slice(0, 4).map((o) => ({ ...o, opacity: o.opacity * 0.45 }))
      : ORBS;
    if (tint) {
      list = list.map((o, i) => (i % 2 === 0 ? { ...o, color: tint } : o));
    } else if (dim) {
      list = list.map((o) => ({
        ...o,
        color: COOL_MAP[o.color] ?? o.color,
        opacity: o.opacity * 0.8,
      }));
    }
    return list;
  }, [tint, dim, variant]);

  if (lowPower) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-orbit"
          style={{
            backgroundColor: orb.color,
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            filter: 'blur(80px)',
            opacity: orb.opacity,
            animationDuration: `${orb.duration}s`,
            animationDelay: `${orb.delay}s`,
          }}
        />
      ))}
    </div>
  );
};
