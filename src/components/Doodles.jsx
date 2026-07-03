import { motion } from 'framer-motion';

// The 2026–27 Awana catalog scatters little hand-drawn marks around every
// page: four-point sparkles, tiny ×'s, dots, rings and squiggles. This
// component reproduces that language around a banner. Purely decorative.

const SPARKLE = 'M12 0C13.1 6.9 17.1 10.9 24 12C17.1 13.1 13.1 17.1 12 24C10.9 17.1 6.9 13.1 0 12C6.9 10.9 10.9 6.9 12 0Z';

function Mark({ kind, size }) {
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
    default:
      return <svg {...common}><circle cx="12" cy="12" r="6" fill="currentColor" /></svg>;
  }
}

// Positions are percentages of the banner box, spilling slightly outside
// it (the field is inset negatively in CSS) the way the catalog lets its
// doodles drift into the margins.
const LAYOUT = [
  { kind: 'sparkle', size: 34, top: '-6%', left: '-4%', delay: 0.0 },
  { kind: 'x', size: 15, top: '18%', left: '-8%', delay: 0.9 },
  { kind: 'dot', size: 10, top: '42%', left: '-5%', delay: 1.7 },
  { kind: 'squiggle', size: 22, top: '88%', left: '-2%', delay: 0.4 },
  { kind: 'sparkle', size: 20, top: '104%', left: '18%', delay: 1.2 },
  { kind: 'ring', size: 16, top: '-12%', left: '30%', delay: 2.0 },
  { kind: 'sparkle', size: 26, top: '-10%', left: '78%', delay: 0.6 },
  { kind: 'x', size: 14, top: '6%', left: '102%', delay: 1.5 },
  { kind: 'sparkle', size: 38, top: '58%', left: '103%', delay: 0.2 },
  { kind: 'dot', size: 9, top: '34%', left: '106%', delay: 2.3 },
  { kind: 'squiggle', size: 20, top: '-14%', left: '55%', delay: 1.0 },
  { kind: 'sparkle', size: 18, top: '96%', left: '88%', delay: 1.8 },
];

export default function Doodles() {
  return (
    <div className="doodle-field" aria-hidden>
      {LAYOUT.map((d, i) => (
        <motion.span
          key={i}
          className="doodle"
          style={{ top: d.top, left: d.left }}
          animate={{ opacity: [0.35, 1, 0.35], scale: [0.8, 1.1, 0.8], rotate: [0, 12, 0] }}
          transition={{ duration: 3.2, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Mark kind={d.kind} size={d.size} />
        </motion.span>
      ))}
    </div>
  );
}
