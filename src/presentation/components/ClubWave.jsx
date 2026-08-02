import React from 'react';

const PATHS = {
  0: [
    'M0,300 C180,210 360,330 560,280 C760,230 900,320 1100,270 C1260,230 1360,280 1440,250 L1440,560 L0,560 Z',
    'M0,360 C220,280 420,390 640,340 C860,290 1040,380 1240,330 C1330,308 1400,330 1440,315 L1440,560 L0,560 Z',
    'M0,430 C260,370 480,460 720,415 C960,370 1180,445 1440,400 L1440,560 L0,560 Z',
  ],
  1: [
    'M0,260 C200,320 420,220 640,280 C860,340 1080,240 1280,300 C1360,322 1410,300 1440,310 L1440,560 L0,560 Z',
    'M0,330 C240,390 460,300 700,350 C940,400 1160,320 1440,370 L1440,560 L0,560 Z',
    'M0,420 C280,470 520,390 780,435 C1040,480 1240,410 1440,450 L1440,560 L0,560 Z',
  ],
};

const LAYER_OPACITY = [0.1, 0.2, 0.42];

/**
 * The signature 2026–27 catalog element: an organic wave sweeping in
 * from a screen edge in the club color. Three stacked translucent
 * layers over pure black read like the catalog's section-opener waves.
 */
export const ClubWave = ({
  color,
  position = 'bottom',
  variant = 0,
  height = 34,
  intensity = 1,
  animate = true,
}) => (
  <div
    className={`absolute inset-x-0 pointer-events-none overflow-hidden ${animate ? 'animate-wave-drift' : ''}`}
    style={{
      [position]: 0,
      height: `${height}vh`,
      transform: position === 'top' ? 'scaleY(-1)' : undefined,
    }}
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 1440 560"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
    >
      {PATHS[variant].map((d, i) => (
        <path key={i} d={d} fill={color} opacity={LAYER_OPACITY[i] * intensity} />
      ))}
    </svg>
  </div>
);
