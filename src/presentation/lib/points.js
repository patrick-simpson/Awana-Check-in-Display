/**
 * Color-team points race — pure ranking/color helpers for the `points`
 * broadcast (contract v3, sanitized by src/lib/eventSanitizers.js
 * sanitizePoints: `{ groups: Record<string, number>, at, club? }`,
 * numbers only). Team names are church-configured free text ("Red",
 * "Blue", "House Warriors", …), never a fixed roster, so nothing here
 * assumes which teams exist — only names that are obviously a color
 * word get that color's bar; everything else gets a stable neutral
 * fallback from the catalog palette.
 */

/** Points older than this are treated as gone (feed offline) — same policy as the game-time tally. */
export const POINTS_STALE_MS = 10 * 60 * 1000;

/** Common team-name color words → an actual bar color. */
const COLOR_WORDS = {
  red: '#E8192C',
  blue: '#0072CE',
  green: '#00A651',
  yellow: '#FFC107',
  gold: '#FFC107',
  orange: '#F7941D',
  purple: '#8E44AD',
  violet: '#8E44AD',
  black: '#4A4A4A',
  white: '#F2F2F2',
  silver: '#C7CBD1',
  gray: '#8E9AAF',
  grey: '#8E9AAF',
  pink: '#FF6FA5',
  teal: '#00B4A6',
  navy: '#1F3A6E',
  maroon: '#7A1F2B',
};

/** Neutral catalog tones for a team name that isn't an obvious color word. */
const FALLBACK_COLORS = ['#FFC107', '#0072CE', '#00A651', '#E8192C', '#8E44AD', '#00B4A6'];

/** An obvious color word → its bar color, or null when the name isn't one. */
export function colorForGroup(name) {
  const key = name.trim().toLowerCase();
  return COLOR_WORDS[key] ?? null;
}

/**
 * `groups` ranked highest-first as `[{ name, points, rank, color }]`.
 * Ties share a rank (standard "competition ranking": 1, 2, 2, 4 — never
 * awarding a false 3rd place). Names that are an obvious color word get
 * that color; everything else gets a stable fallback assigned in
 * ranked order so re-renders of the same standings never flicker color.
 */
export function rankGroups(groups) {
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const ranked = [];
  let rank = 0;
  let lastPoints = null;
  let fallbackIdx = 0;
  for (const [name, points] of entries) {
    if (lastPoints === null || points !== lastPoints) {
      rank = ranked.length + 1;
      lastPoints = points;
    }
    const explicit = colorForGroup(name);
    const color = explicit ?? FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
    if (!explicit) fallbackIdx += 1;
    ranked.push({ name, points, rank, color });
  }
  return ranked;
}

/** Whether `points` (from useRealtime) exists and is recent enough to show. */
export function isPointsFresh(points, now) {
  return points != null && now.getTime() - points.at.getTime() < POINTS_STALE_MS;
}
