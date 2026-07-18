// Deterministic per-name banner accents (#8): the same kid gets the
// same little flourish every week — a personal touch with zero new
// data (seeded from the first name alone, same mulberry32 the birthday
// art uses).

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashName(name) {
  let h = 2166136261;
  for (const ch of String(name ?? '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Accent recipe for a first name:
 *   tilt        — gentle name rotation, −1.6°…+1.6°
 *   doodlePhase — seconds added to the doodle twinkle delays, so each
 *                 kid's banner glitters on its own rhythm
 *   sparkle     — whether the name gets an extra wandering sparkle
 */
export function nameAccent(firstName) {
  const rand = mulberry32(hashName(firstName));
  return {
    tilt: Math.round((rand() * 3.2 - 1.6) * 10) / 10,
    doodlePhase: Math.round(rand() * 20) / 10,
    sparkle: rand() > 0.5,
  };
}
