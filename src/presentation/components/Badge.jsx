import React from 'react';
import { rgbTriple } from '../lib/color.js';

const SIZES = {
  sm: { pad: '0.35em 1em', font: 'clamp(0.85rem, 1.3vw, 1.5rem)' },
  md: { pad: '0.4em 1.2em', font: 'var(--text-eyebrow)' },
  lg: { pad: '0.4em 1.1em', font: 'clamp(1.75rem, 3.2vw, 4rem)' },
};

/**
 * Catalog-style rounded chip (like the "AGES 2–3" tabs): dark pill,
 * colored border glow, condensed caps, optional sparkle icon.
 * The near-black fill is a component surface — the page background
 * behind it stays #000000.
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
        color: '#FFFFFF',
        background: 'rgba(10, 10, 10, 0.72)',
        border: `2px solid ${color}`,
        ['--glow-color']: rgbTriple(color),
        boxShadow: `0 0 18px rgb(var(--glow-color) / 0.45), inset 0 0 14px rgb(var(--glow-color) / 0.12)`,
        backdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      {sparkle && <SparkleIcon color={color} />}
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
