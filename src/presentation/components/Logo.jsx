import React, { useState } from 'react';
import { artUrl } from '../lib/shared-config.js';

/**
 * Official "Awana Clubs" brand mark in the white chip. Falls back to the
 * typographic lockup if the PNG ever fails to load (missing asset, bad
 * path, offline first paint before the shell caches it) — a projector
 * must never blank because of one image request.
 */
export const Logo = ({ size = 'md' }) => {
  const [failed, setFailed] = useState(false);
  const scale = size === 'md' ? 1 : 0.8;

  if (failed) {
    return <TypographicLogo scale={scale} />;
  }

  return (
    <div
      className="bg-white shadow-lg animate-logo-glow inline-flex items-center select-none"
      style={{
        borderRadius: 'var(--radius-card)',
        padding: `${0.35 * scale}rem ${1.1 * scale}rem ${0.45 * scale}rem`,
      }}
    >
      <img
        src={artUrl('art/awana-clubs-logo.png')}
        alt="Awana Clubs"
        draggable={false}
        onError={() => setFailed(true)}
        style={{
          height: `${2.6 * scale}rem`,
          width: 'auto',
          display: 'block',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))',
        }}
      />
    </div>
  );
};

/** The original type-drawn lockup — used only if the PNG fails to load. */
const TypographicLogo = ({ scale }) => (
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
