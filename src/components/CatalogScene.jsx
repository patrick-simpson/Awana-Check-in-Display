import { useId } from 'react';

// The catalog visual language — sky, drifting sparkle doodles, and the
// big wave along the bottom — extracted from the original setup
// placeholder so typed slides and the placeholder share one scene.
// Each theme swaps the gradients while keeping the same shapes.
const THEMES = {
  sky: {
    background: 'linear-gradient(180deg, #cae0f2 0%, var(--awana-sky) 55%, #a9c9e6 100%)',
    wave: ['#FFB81C', '#F26B21'],
    doodleStroke: '#ffffff',
    doodleFill: '#ffffff',
  },
  sunset: {
    background: 'linear-gradient(180deg, #ffe9bd 0%, #ffd28a 55%, #ffb45e 100%)',
    wave: ['#E14B4B', '#F26B21'],
    doodleStroke: '#f28b21',
    doodleFill: '#ffffff',
  },
  night: {
    background: 'linear-gradient(180deg, #1e2f5c 0%, #3054a8 60%, #24418c 100%)',
    wave: ['#FFB81C', '#F26B21'],
    doodleStroke: '#b9d5ec',
    doodleFill: '#ffd98a',
  },
  meadow: {
    background: 'linear-gradient(180deg, #d9efda 0%, #c4e8c5 55%, #a5d6a7 100%)',
    wave: ['#4CAF50', '#3B8C3F'],
    doodleStroke: '#ffffff',
    doodleFill: '#ffffff',
  },
};

export default function CatalogScene({ theme = 'sky', children }) {
  // Editor thumbnails and the fullscreen slideshow render many scenes at
  // once; SVG gradient ids are document-global, so a shared id would
  // silently paint every wave with the first theme's colors.
  const gradientId = useId();
  const t = THEMES[theme] || THEMES.sky;

  return (
    <div className={`catalog-scene catalog-scene--${THEMES[theme] ? theme : 'sky'}`} style={{ background: t.background }}>
      {/* Sparkle doodles drifting in the sky. */}
      <svg className="scene-doodles" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g fill="none" stroke={t.doodleStroke} strokeWidth="4" strokeLinecap="round" opacity="0.75">
          <path d="M120 180 C160 120 210 120 250 170" />
          <path d="M1370 210 C1400 170 1450 170 1480 205" />
          <circle cx="1300" cy="520" r="14" />
          <circle cx="340" cy="120" r="6" fill={t.doodleStroke} stroke="none" />
          <circle cx="1180" cy="130" r="7" fill={t.doodleStroke} stroke="none" />
          <path d="M1445 420 l26 26 M1471 420 l-26 26" strokeWidth="6" />
          <path d="M180 430 l22 22 M202 430 l-22 22" strokeWidth="5" />
        </g>
        <g fill={t.doodleFill} opacity="0.9">
          <path d="M480 100 c3 18 13 28 31 31 c-18 3 -28 13 -31 31 c-3 -18 -13 -28 -31 -31 c18 -3 28 -13 31 -31z" />
          <path d="M1120 620 c4 22 16 34 38 38 c-22 4 -34 16 -38 38 c-4 -22 -16 -34 -38 -38 c22 -4 34 -16 38 -38z" />
          <path d="M200 760 c2.5 15 11 23.5 26 26 c-15 2.5 -23.5 11 -26 26 c-2.5 -15 -11 -23.5 -26 -26 c15 -2.5 23.5 -11 26 -26z" />
          <path d="M1490 700 c3 18 13 28 31 31 c-18 3 -28 13 -31 31 c-3 -18 -13 -28 -31 -31 c18 -3 28 -13 31 -31z" />
        </g>
      </svg>

      {children}

      {/* The big catalog wave along the bottom. */}
      <svg className="scene-wave" viewBox="0 0 1600 420" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={t.wave[0]} />
            <stop offset="1" stopColor={t.wave[1]} />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${gradientId})`}
          d="M0 190 C220 80 420 80 640 160 C880 250 1120 250 1330 150 C1430 105 1530 100 1600 130 L1600 420 L0 420 Z"
        />
      </svg>
    </div>
  );
}
