// Themed night skins. 'auto' picks a season-appropriate skin from the
// calendar so nobody has to remember to flip it — the mapping is a
// plain table by month (pure + testable).

export const SKINS = ['none', 'autumn', 'christmas', 'summer', 'spring', 'harvest', 'snowday'];

const MONTH_SKINS = [
  'snowday', // Jan
  'snowday', // Feb
  'spring', // Mar
  'spring', // Apr
  'spring', // May
  'summer', // Jun
  'summer', // Jul
  'summer', // Aug
  'autumn', // Sep
  'autumn', // Oct
  'harvest', // Nov
  'christmas', // Dec
];

/** The skin 'auto' resolves to on `date` (defaults to today). */
export function autoSkin(date = new Date()) {
  return MONTH_SKINS[date.getMonth()] ?? 'none';
}

/** Resolve a configured nightTheme value to the skin actually applied. */
export function resolveSkin(nightTheme, date = new Date()) {
  if (nightTheme === 'auto') return autoSkin(date);
  return SKINS.includes(nightTheme) ? nightTheme : 'none';
}
