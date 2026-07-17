// Shared theme consumption (#3) — the countdown repo's Pages site
// publishes shared/theme.json (per-club catalog colors + official art)
// as the single source of truth for the whole Awana app family. This
// module strict-parses it into per-club overrides that clubs.js merges
// field-by-field over its baked values, so a bad deploy of the shared
// file can never break banner colors.

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function darken(hex, factor) {
  const to2 = (v) => Math.round(v).toString(16).padStart(2, '0');
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) * factor);
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function lighten(hex, amount) {
  const to2 = (v) => Math.round(v).toString(16).padStart(2, '0');
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return c + (255 - c) * amount;
  });
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function safeArtUrl(baseUrl, rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('..')) return null;
  try {
    const url = new URL(rel, baseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Strict-parse a fetched shared theme.json into
 *   { [clubKey]: { name, primary, deep, accent, confetti, logoUrl, aliases } }
 * Returns null when the payload is unusable; individual bad clubs are
 * dropped rather than poisoning the rest.
 */
export function sanitizeTheme(raw, baseUrl) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!raw.clubs || typeof raw.clubs !== 'object') return null;
  const out = {};
  for (const [key, club] of Object.entries(raw.clubs)) {
    if (!club || typeof club !== 'object') continue;
    const color = typeof club.color === 'string' && HEX_RE.test(club.color) ? club.color : null;
    if (!color) continue;
    const entry = {
      name: typeof club.name === 'string' ? club.name.slice(0, 30) : undefined,
      primary: color,
      deep: darken(color, 0.78),
      accent: lighten(color, 0.65),
      confetti: [color, lighten(color, 0.45), '#FFFFFF'],
      aliases: Array.isArray(club.aliases)
        ? club.aliases.filter((a) => typeof a === 'string').map((a) => a.toLowerCase()).slice(0, 8)
        : [],
    };
    const logo = club.art && safeArtUrl(baseUrl, club.art.logo);
    if (logo) entry.logoUrl = logo;
    out[key.toLowerCase()] = entry;
  }
  return Object.keys(out).length ? out : null;
}
