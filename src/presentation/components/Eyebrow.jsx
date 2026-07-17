import React from 'react';
import { rgbTriple } from '../lib/color.js';

/** The one condensed-caps label style (single tracking token app-wide). */
export const Eyebrow = ({
  tone = 'shimmer',
  color = '#FFC107',
  className = '',
  children,
}) => (
  <p
    className={`uppercase font-bold ${tone === 'shimmer' ? 'text-shimmer' : ''} ${className}`}
    style={{
      fontFamily: 'var(--font-condensed)',
      fontWeight: 700,
      fontSize: 'var(--text-eyebrow)',
      letterSpacing: 'var(--tracking-eyebrow)',
      // letter-spacing adds a trailing gap; nudge back to optical center
      marginRight: 'calc(var(--tracking-eyebrow) * -1)',
      ...(tone === 'color'
        ? {
            color,
            ['--glow-color']: rgbTriple(color),
            textShadow: 'var(--glow-sm)',
          }
        : {}),
    }}
  >
    {children}
  </p>
);
