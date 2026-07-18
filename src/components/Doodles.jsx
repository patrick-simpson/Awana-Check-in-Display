import { motion } from 'framer-motion';

// The 2026–27 Awana catalog scatters little hand-drawn marks around every
// page: four-point sparkles, tiny ×'s, dots, rings, squiggles — and on the
// club divider pages, zigzags, stair-steps and loose spirals. This
// component reproduces that language around a banner. Purely decorative.

const SPARKLE = 'M12 0C13.1 6.9 17.1 10.9 24 12C17.1 13.1 13.1 17.1 12 24C10.9 17.1 6.9 13.1 0 12C6.9 10.9 10.9 6.9 12 0Z';

export function Mark({ kind, size }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true };
  switch (kind) {
    case 'sparkle':
      return <svg {...common}><path d={SPARKLE} fill="currentColor" /></svg>;
    case 'x':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
          <path d="M5 5L19 19M19 5L5 19" />
        </svg>
      );
    case 'ring':
      return <svg {...common} fill="none" stroke="currentColor" strokeWidth="3.5"><circle cx="12" cy="12" r="8" /></svg>;
    case 'squiggle':
      return (
        <svg width={size * 2} height={size} viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
          <path d="M3 14C9 4 15 4 21 12C27 20 33 20 39 10C41 7 43 6 45 6" />
        </svg>
      );
    case 'zigzag':
      return (
        <svg width={size * 2} height={size} viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 18L12 7L21 16L30 6L39 15L45 9" />
        </svg>
      );
    case 'stair':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21V14H10V7H17V1" />
        </svg>
      );
    case 'spiral':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M4 18C2 12 6 5 13 4C18 3.5 22 7 21 12C20 16 15 18 12 15C10 13 11 9 14 9" />
        </svg>
      );
    default:
      return <svg {...common}><circle cx="12" cy="12" r="6" fill="currentColor" /></svg>;
  }
}

// Positions are percentages of the banner box, spilling slightly outside
// it (the field is inset negatively in CSS) the way the catalog lets its
// doodles drift into the margins.
const LAYOUT = [
  { kind: 'sparkle', size: 34, top: '-6%', left: '-4%', delay: 0.0 },
  { kind: 'zigzag', size: 16, top: '18%', left: '-8%', delay: 0.9 },
  { kind: 'dot', size: 10, top: '42%', left: '-5%', delay: 1.7 },
  { kind: 'squiggle', size: 22, top: '88%', left: '-2%', delay: 0.4 },
  { kind: 'sparkle', size: 20, top: '104%', left: '18%', delay: 1.2 },
  { kind: 'ring', size: 16, top: '-12%', left: '30%', delay: 2.0 },
  { kind: 'sparkle', size: 26, top: '-10%', left: '78%', delay: 0.6 },
  { kind: 'x', size: 14, top: '6%', left: '102%', delay: 1.5 },
  { kind: 'sparkle', size: 38, top: '58%', left: '103%', delay: 0.2 },
  { kind: 'stair', size: 18, top: '34%', left: '106%', delay: 2.3 },
  { kind: 'spiral', size: 22, top: '-14%', left: '55%', delay: 1.0 },
  { kind: 'sparkle', size: 18, top: '96%', left: '88%', delay: 1.8 },
];

// A few tiny sparkles twinkling INSIDE the banner band (the doodle field
// above scatters around its edges) — the band itself glitters while the
// name is up.
const BAND_SPOTS = [
  { top: '24%', left: '9%', size: 16, delay: 0.2 },
  { top: '16%', left: '87%', size: 20, delay: 1.4 },
  { top: '70%', left: '79%', size: 13, delay: 0.8 },
  { top: '76%', left: '19%', size: 17, delay: 2.1 },
];

export function BandSparkles() {
  return (
    <div className="band-sparkles" aria-hidden>
      {BAND_SPOTS.map((s, i) => (
        <motion.span
          key={i}
          className="doodle"
          style={{ top: s.top, left: s.left }}
          animate={{ opacity: [0.15, 0.85, 0.15], scale: [0.7, 1.15, 0.7], rotate: [0, 18, 0] }}
          transition={{ duration: 2.8, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Mark kind="sparkle" size={s.size} />
        </motion.span>
      ))}
    </div>
  );
}

// `phase` shifts every twinkle delay (per-name accent #8) so each
// kid's banner glitters on its own rhythm.
export default function Doodles({ phase = 0 }) {
  return (
    <div className="doodle-field" aria-hidden>
      {LAYOUT.map((d, i) => (
        <motion.span
          key={i}
          className="doodle"
          style={{ top: d.top, left: d.left }}
          animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.1, 0.8], rotate: [0, 12, 0] }}
          transition={{ duration: 3.2, delay: d.delay + phase, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Mark kind={d.kind} size={d.size} />
        </motion.span>
      ))}
    </div>
  );
}
