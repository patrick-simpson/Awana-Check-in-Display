/**
 * Hand-drawn birthday art in the catalog's flat sticker style — chunky
 * shapes, cream/gold accents, no outlines. These replace the OS emoji
 * the birthday banner used to lean on (🎂🎁🎈), which rendered
 * differently on every TV/stick; inline SVG looks identical everywhere
 * (the first-timer starburst set the precedent).
 *
 * Purely decorative: every piece is aria-hidden by its container.
 * Colors ride props so the falling pieces can cycle a bright kid
 * palette while the cake stays on-band cream and gold.
 */

export function CakeArt() {
  return (
    <svg viewBox="0 0 120 116" aria-hidden>
      {/* plate */}
      <ellipse cx="60" cy="106" rx="46" ry="7" fill="rgba(255,255,255,0.45)" />
      {/* bottom tier + coral icing drips */}
      <rect x="22" y="72" width="76" height="34" rx="9" fill="#fff6e3" />
      <path
        d="M22 81 q4 9 9.5 0 q5.5 9 11 0 q5.5 9 11 0 q5.5 9 11 0 q5.5 9 11 0 q5.5 9 11 0 q5.5 9 11 0 q4.5 8 9.5 0 L98 72 L22 72 Z"
        fill="#ef5350"
      />
      {/* middle tier + gold drips */}
      <rect x="32" y="46" width="56" height="28" rx="8" fill="#ffffff" />
      <path
        d="M32 54 q4 8 9 0 q5 8 10 0 q5 8 10 0 q5 8 10 0 q4.5 8 9 0 q4 7 8 0 L88 46 L32 46 Z"
        fill="#ffb81c"
      />
      {/* top tier + coral drips */}
      <rect x="42" y="24" width="36" height="24" rx="7" fill="#fff6e3" />
      <path
        d="M42 31 q3.5 7 8 0 q4.5 7 9 0 q4.5 7 9 0 q3.5 6.5 10 0 L78 24 L42 24 Z"
        fill="#ef5350"
      />
      {/* candles */}
      <rect x="49" y="8" width="5" height="18" rx="2.5" fill="#4fc3f7" />
      <rect x="66" y="8" width="5" height="18" rx="2.5" fill="#aed581" />
      {/* flames */}
      <path d="M51.5 -1 q5 5.5 0 9 q-5 -3.5 0 -9 Z" fill="#ffd257" />
      <path d="M68.5 -1 q5 5.5 0 9 q-5 -3.5 0 -9 Z" fill="#ffd257" />
      {/* sprinkles */}
      <circle cx="40" cy="94" r="3" fill="#ffd257" />
      <circle cx="60" cy="98" r="3" fill="#4fc3f7" />
      <circle cx="80" cy="93" r="3" fill="#aed581" />
      <circle cx="50" cy="64" r="2.6" fill="#ef5350" />
      <circle cx="70" cy="66" r="2.6" fill="#ffd257" />
    </svg>
  );
}

export function GiftArt({ color = '#ffd257' }) {
  return (
    <svg viewBox="0 0 96 100" aria-hidden>
      {/* bow loops + knot */}
      <path d="M48 22 C 34 2, 16 8, 26 20 C 32 26, 42 24, 48 22 Z" fill={color} />
      <path d="M48 22 C 62 2, 80 8, 70 20 C 64 26, 54 24, 48 22 Z" fill={color} />
      <circle cx="48" cy="22" r="7" fill="#fff6e3" />
      {/* lid + box */}
      <rect x="10" y="28" width="76" height="18" rx="6" fill={color} />
      <rect x="17" y="46" width="62" height="46" rx="8" fill={color} />
      {/* box shading band + ribbon */}
      <rect x="17" y="46" width="62" height="10" fill="rgba(0,0,0,0.12)" />
      <rect x="42" y="28" width="12" height="64" rx="4" fill="#fff6e3" />
    </svg>
  );
}

export function BalloonArt({ color = '#4fc3f7' }) {
  return (
    <svg viewBox="0 0 72 112" aria-hidden>
      <ellipse cx="36" cy="32" rx="25" ry="30" fill={color} />
      {/* shine */}
      <ellipse cx="27" cy="21" rx="7" ry="10" fill="rgba(255,255,255,0.55)" transform="rotate(-18 27 21)" />
      {/* knot */}
      <path d="M36 61 L30 70 L42 70 Z" fill={color} />
      {/* squiggle string, same language as the doodles */}
      <path
        d="M36 70 C 28 80, 44 86, 36 96 C 30 102, 38 108, 34 111"
        fill="none" stroke="#fff6e3" strokeWidth="3.5" strokeLinecap="round"
      />
    </svg>
  );
}

export function StarArt({ color = '#ffd257' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 0C13.1 6.9 17.1 10.9 24 12C17.1 13.1 13.1 17.1 12 24C10.9 17.1 6.9 13.1 0 12C6.9 10.9 10.9 6.9 12 0Z"
        fill={color}
      />
    </svg>
  );
}
