// Club identity data — colors, age ranges, and taglines sourced from the
// official Awana Clubs 2026–27 catalog. Lookup is case-insensitive and
// alias-aware; unknown or missing clubs fall back to the warm Awana-orange
// default so a typo in the check-in system still produces a joyful banner.

const CLUBS = {
  puggles: {
    name: 'Puggles',
    ages: 'Ages 2–3',
    tagline: 'A strong first impression of God’s love',
    primary: '#F79420',
    deep: '#E07C0A',
    accent: '#FFDCA8',
    confetti: ['#F79420', '#FFC24B', '#FFFFFF'],
  },
  cubbies: {
    name: 'Cubbies',
    ages: 'Ages 3–5',
    tagline: 'Celebrating the spiritual potential of preschoolers',
    primary: '#3054A8',
    deep: '#24418C',
    accent: '#AEC4F2',
    confetti: ['#3054A8', '#6C8FD8', '#E4572E', '#FFFFFF'],
  },
  sparks: {
    name: 'Sparks',
    ages: 'Grades K–2',
    tagline: 'Igniting curiosity and a foundation for knowing Christ',
    primary: '#E14B4B',
    deep: '#C43737',
    accent: '#FFC9C4',
    confetti: ['#E14B4B', '#FFB300', '#FFFFFF'],
  },
  't&t': {
    name: 'T&T',
    ages: 'Grades 3–6',
    tagline: 'A deeper understanding of God’s grace',
    primary: '#4CAF50',
    deep: '#3B8C3F',
    accent: '#C4E8C5',
    confetti: ['#4CAF50', '#8BC34A', '#FFFFFF'],
  },
  trek: {
    name: 'Trek',
    ages: 'Grades 6–8',
    tagline: 'Owning faith in the middle school years',
    primary: '#0083C9',
    deep: '#00679F',
    accent: '#B3E2F7',
    confetti: ['#0083C9', '#4FC3F7', '#FFFFFF'],
  },
  journey: {
    name: 'Journey',
    ages: 'Grades 9–12',
    tagline: 'Following Christ into adulthood',
    primary: '#46566B',
    deep: '#354355',
    accent: '#C3CFDE',
    confetti: ['#46566B', '#90A4AE', '#FFC24B', '#FFFFFF'],
  },
};

// Common spellings the check-in system might send for the same club.
const ALIASES = {
  'truth & training': 't&t',
  'truth and training': 't&t',
  'tnt': 't&t',
  't & t': 't&t',
  'puggle': 'puggles',
  'cubbie': 'cubbies',
  'spark': 'sparks',
};

const DEFAULT_CLUB = {
  name: '',
  ages: '',
  tagline: 'So glad you’re here tonight',
  primary: '#F7A41C',
  deep: '#E08E00',
  accent: '#FFE3A3',
  confetti: ['#F7A41C', '#FFB300', '#FFFFFF'],
};

export function getClubPalette(clubName) {
  if (!clubName || typeof clubName !== 'string') return DEFAULT_CLUB;
  const key = clubName.trim().toLowerCase();
  return CLUBS[ALIASES[key] || key] || DEFAULT_CLUB;
}

export function getAllClubs() {
  // Used by the debug panel's "Trigger Every Club" button.
  return Object.values(CLUBS).map((c) => c.name);
}
