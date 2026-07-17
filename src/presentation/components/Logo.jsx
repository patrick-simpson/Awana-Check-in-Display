import React from 'react';

/**
 * Typographic Awana lockup in the white chip. The old code pointed at
 * a PNG that was never committed (an onError handler silently hid the
 * chip), so the wordmark is drawn in type; swap in an <img> here if an
 * official asset lands in public/.
 */
export const Logo = ({ size = 'md' }) => {
  const scale = size === 'md' ? 1 : 0.8;
  return (
    <div
      className="bg-white shadow-lg animate-logo-glow inline-flex items-baseline gap-2 select-none"
      style={{
        borderRadius: 'var(--radius-card)',
        padding: `${0.35 * scale}rem ${1.1 * scale}rem ${0.45 * scale}rem`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: `${1.9 * scale}rem`,
          lineHeight: 1,
          color: '#0A0A0A',
          letterSpacing: '0.01em',
        }}
      >
        Awana
      </span>
      <span
        style={{
          fontFamily: 'var(--font-condensed)',
          fontWeight: 800,
          fontSize: `${0.85 * scale}rem`,
          letterSpacing: '0.18em',
          color: '#E8192C',
          textTransform: 'uppercase',
        }}
      >
        Clubs
      </span>
    </div>
  );
};
