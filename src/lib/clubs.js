// Club identity data — colors and official logos sourced from the Awana
// Clubs 2026–27 catalog (logos extracted as white-on-transparent PNGs via
// scripts/extract-club-logos.py). Lookup is case-insensitive and
// alias-aware; unknown or missing clubs fall back to the warm Awana-orange
// default so a typo in the check-in system still produces a joyful banner.
//
// Trek and Journey have no logo art in the catalog (logo: null) — banners
// show a styled club-title pill for them instead.

import pugglesLogo from '../assets/clubs/puggles.png';
import cubbiesLogo from '../assets/clubs/cubbies.png';
import sparksLogo from '../assets/clubs/sparks.png';
import tntLogo from '../assets/clubs/tnt.png';

const CLUBS = {
  puggles: {
    name: 'Puggles',
    logo: pugglesLogo,
    primary: '#F79420',
    deep: '#E07C0A',
    accent: '#FFDCA8',
    confetti: ['#F79420', '#FFC24B', '#FFFFFF'],
  },
  cubbies: {
    name: 'Cubbies',
    logo: cubbiesLogo,
    primary: '#3054A8',
    deep: '#24418C',
    accent: '#AEC4F2',
    confetti: ['#3054A8', '#6C8FD8', '#E4572E', '#FFFFFF'],
  },
  sparks: {
    name: 'Sparks',
    logo: sparksLogo,
    primary: '#E14B4B',
    deep: '#C43737',
    accent: '#FFC9C4',
    confetti: ['#E14B4B', '#FFB300', '#FFFFFF'],
  },
  't&t': {
    name: 'T&T',
    logo: tntLogo,
    primary: '#4CAF50',
    deep: '#3B8C3F',
    accent: '#C4E8C5',
    confetti: ['#4CAF50', '#8BC34A', '#FFFFFF'],
  },
  trek: {
    name: 'Trek',
    logo: null,
    primary: '#0083C9',
    deep: '#00679F',
    accent: '#B3E2F7',
    confetti: ['#0083C9', '#4FC3F7', '#FFFFFF'],
  },
  journey: {
    name: 'Journey',
    logo: null,
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
  logo: null,
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
