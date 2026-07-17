import React from 'react';

// Deterministic particles — no randomization on each render
const PARTICLES = Array.from({ length: 45 }, (_, i) => ({
  id: i,
  left: `${(i * 31 + 13) % 96 + 2}%`,
  bottom: `${(i * 19 + 3) % 18}%`,
  size: `${1.2 + (i % 4) * 0.7}px`,
  duration: `${11 + (i % 9) * 1.8}s`,
  delay: `${-((i * 2.3) % 18)}s`,
  opacity: 0.10 + (i % 6) * 0.055,
  color: ['#FFFFFF', '#FFC107', '#E8192C', '#0072CE', '#00A651'][i % 5],
}));

export const ParticleField = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {PARTICLES.map(p => (
      <div
        key={p.id}
        className="absolute rounded-full animate-particle-float"
        style={{
          left: p.left,
          bottom: p.bottom,
          width: p.size,
          height: p.size,
          backgroundColor: p.color,
          opacity: p.opacity,
          animationDuration: p.duration,
          animationDelay: p.delay,
        }}
      />
    ))}
  </div>
);
