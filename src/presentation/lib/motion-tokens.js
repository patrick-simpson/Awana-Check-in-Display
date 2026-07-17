/**
 * Motion timing tokens — the JS mirror of the CSS custom properties
 * declared in index.css (:root). Keep the two in sync; there is no
 * runtime bridge on purpose (values are needed before styles resolve).
 */
export const DUR = {
  /** --dur-fast */
  fast: 0.15,
  /** --dur-base */
  base: 0.3,
  /** --dur-slow (slide-to-slide flips) */
  slow: 0.6,
  /** --dur-mode (top-level view crossfade) */
  mode: 0.8,
};

export const EASE = {
  /** --ease-pop: playful overshoot */
  pop: [0.34, 1.56, 0.64, 1],
  /** --ease-smooth */
  smooth: [0.4, 0, 0.2, 1],
};
