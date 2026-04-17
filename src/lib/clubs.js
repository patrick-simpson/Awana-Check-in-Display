// Mapping of Awana club names → color palette. Case-insensitive lookup;
// unknown or missing clubs fall back to the cheerful yellow default.

const PALETTES = {
  puggles: { primary: '#7E57C2', accent: '#D1C4E9', confetti: ['#7E57C2', '#B39DDB', '#FFFFFF'] },
  cubbies: { primary: '#1E88E5', accent: '#BBDEFB', confetti: ['#1E88E5', '#64B5F6', '#FFFFFF'] },
  sparks:  { primary: '#E53935', accent: '#FFCDD2', confetti: ['#E53935', '#FFD54F', '#FFFFFF'] },
  'truth & training': { primary: '#43A047', accent: '#C8E6C9', confetti: ['#43A047', '#A5D6A7', '#FFFFFF'] },
  't&t':   { primary: '#43A047', accent: '#C8E6C9', confetti: ['#43A047', '#A5D6A7', '#FFFFFF'] },
  trek:    { primary: '#FB8C00', accent: '#FFE0B2', confetti: ['#FB8C00', '#FFB74D', '#FFFFFF'] },
  journey: { primary: '#00897B', accent: '#B2DFDB', confetti: ['#00897B', '#4DB6AC', '#FFFFFF'] },
};

const DEFAULT_PALETTE = {
  primary: '#FFD54F',
  accent: '#FFF9C4',
  confetti: ['#FFD54F', '#FFB300', '#FFFFFF'],
};

export function getClubPalette(clubName) {
  if (!clubName || typeof clubName !== 'string') return DEFAULT_PALETTE;
  const key = clubName.trim().toLowerCase();
  return PALETTES[key] || DEFAULT_PALETTE;
}

export function getAllClubs() {
  // Used by the debug panel's "Trigger Every Club" button.
  return ['Puggles', 'Cubbies', 'Sparks', 'T&T', 'Trek', 'Journey'];
}
