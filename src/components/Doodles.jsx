// The 2026–27 Awana catalog scatters little hand-drawn marks around every
// page: four-point sparkles, tiny ×'s, dots, rings, squiggles — and on the
// club divider pages, zigzags, stair-steps and loose spirals. `Mark` draws
// one of them for the corner chips and the milestone toast. (The check-in
// moment uses the brand kit's own doodles: src/components/brand/.)

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
