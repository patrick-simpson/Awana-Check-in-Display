import React from 'react';

const SIZES = {
  sm: { pad: '0.35em 1em', font: 'clamp(0.85rem, 1.3vw, 1.5rem)' },
  md: { pad: '0.4em 1.2em', font: 'var(--text-eyebrow)' },
  lg: { pad: '0.4em 1.1em', font: 'clamp(1.75rem, 3.2vw, 4rem)' },
};

/** Perceived luminance (0–255) — picks readable ink for a solid fill. */
function luminance(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Die-cut sticker chip (like a construction-paper cutout): solid brand
 * fill, a chunky white die-cut outline, dark or light ink chosen by
 * contrast, a hand-placed tilt, and an optional sparkle icon. Flat and
 * crisp on purpose — no glow, no glass, projected on a white wall.
 */
export const Badge = ({
  color = '#FFC107',
  size = 'md',
  sparkle = false,
  className = '',
  style,
  children,
}) => {
  const s = SIZES[size];
  const ink = luminance(color) > 150 ? '#1a1a1a' : '#FFFFFF';
  return (
    <span
      className={`inline-flex items-center gap-[0.5em] uppercase whitespace-nowrap ${className}`}
      style={{
        fontFamily: 'var(--font-condensed)',
        fontWeight: 800,
        letterSpacing: '0.08em',
        fontSize: s.font,
        padding: s.pad,
        borderRadius: 'var(--radius-chip)',
        color: ink,
        background: color,
        border: '3px solid #FFFFFF',
        transform: 'rotate(-2deg)',
        ...style,
      }}
    >
      {sparkle && <SparkleIcon color={ink} />}
      {children}
    </span>
  );
};

export const SparkleIcon = ({
  color = 'currentColor',
  size = '0.8em',
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      d="M12 0C13.1 6.9 17.1 10.9 24 12C17.1 13.1 13.1 17.1 12 24C10.9 17.1 6.9 13.1 0 12C6.9 10.9 10.9 6.9 12 0Z"
      fill={color}
    />
  </svg>
);
