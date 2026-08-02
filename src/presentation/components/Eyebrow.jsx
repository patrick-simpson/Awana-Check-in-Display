import React from 'react';

/** The one condensed-caps label style (single tracking token app-wide). */
export const Eyebrow = ({
  tone = 'shimmer',
  color = '#FFC107',
  className = '',
  children,
}) => (
  <p
    className={`uppercase font-bold ${className}`}
    style={{
      fontFamily: 'var(--font-condensed)',
      fontWeight: 700,
      fontSize: 'var(--text-eyebrow)',
      letterSpacing: 'var(--tracking-eyebrow)',
      // letter-spacing adds a trailing gap; nudge back to optical center
      marginRight: 'calc(var(--tracking-eyebrow) * -1)',
      color: tone === 'shimmer' ? '#FFC107' : tone === 'color' ? color : undefined,
    }}
  >
    {children}
  </p>
);
