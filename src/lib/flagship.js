// @ts-check
// The flagship slide: one permanent, built-in "Welcome to Awana!" piece of
// motion design that leads every pass through the typed slideshow.
//
// It is not stored, published or editable: like the calendar slides and the
// promo slot it is derived (here, a constant) and added at the head of the
// deck the slideshow rotates, so an operator's own slides, a published deck
// and the calendar's auto-slides all come after it. Unlike a promo it never
// HOLDS check-ins (holdsCheckIns is false for it): names play over it like
// over any typed slide, and it steps back for them.

export const FLAGSHIP_ID = 'flagship_welcome';

/** How long it holds; its beat sheet (FlagshipSlide.jsx) is written against this. */
export const FLAGSHIP_DURATION_SEC = 10;

/** The clubs on its parade, in the catalog's order. Keys of clubs.js. */
export const FLAGSHIP_CLUBS = Object.freeze(['Puggles', 'Cubbies', 'Sparks', 'T&T', 'Trek', 'Journey']);

export const FLAGSHIP_SLIDE = Object.freeze({
  id: FLAGSHIP_ID,
  type: 'flagship',
  durationSec: FLAGSHIP_DURATION_SEC,
});

/**
 * @param {any} slide
 * @returns {boolean}
 */
export function isFlagshipSlide(slide) {
  return slide?.type === 'flagship';
}

/**
 * The deck with the flagship slide first. Any flagship already in it (there
 * should never be one: nothing else makes them, and the wire's slide
 * allowlist drops the type) is dropped so it can only ever appear once.
 *
 * @template T
 * @param {T[] | null | undefined} deck
 * @returns {Array<T | typeof FLAGSHIP_SLIDE>}
 */
export function withFlagship(deck) {
  return [FLAGSHIP_SLIDE, ...(deck || []).filter((s) => !isFlagshipSlide(s))];
}
