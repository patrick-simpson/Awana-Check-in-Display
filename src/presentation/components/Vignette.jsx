import React from 'react';

/** One vignette for every view (previously two slightly different copies). */
export const Vignette = ({ strength = 'soft' }) => (
  <div
    className="absolute inset-0 pointer-events-none z-[2]"
    aria-hidden="true"
    style={{
      background:
        strength === 'deep'
          ? 'radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(0,0,0,0.55) 100%)'
          : 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)',
    }}
  />
);

export const Scanlines = () => (
  <div
    className="absolute inset-0 pointer-events-none z-[2] opacity-[0.05]"
    aria-hidden="true"
    style={{
      background: 'repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.35) 2px 3px)',
    }}
  />
);
