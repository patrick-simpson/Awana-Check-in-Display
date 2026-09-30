// @ts-check
import { useSyncExternalStore } from 'react';

// Touch-first devices (phones and tablets) on the projector page (owner,
// 2026-09-30: "I want this website to fully work on mobile ... couldn't push
// B"). The page was built for the projector PC, a mouse and a keyboard: the
// operator menu opens on hover, the Bracelet Time controls on B, a slide
// changes on an arrow key. A phone has none of those, so every touch
// behaviour asks this one question, and the desktop keeps exactly what it had.
//
// The question is the PRIMARY pointer's, never the window's width: a phone in
// landscape is as wide as a small laptop, and the projector PC's window can be
// any size. `(hover: none) and (pointer: coarse)` is true on phones and
// tablets and false on a mouse-and-keyboard PC, including a touchscreen laptop
// whose primary pointer is its trackpad. index.css gates its touch and
// portrait blocks on these same two strings (touch.test.js pins them), so the
// CSS and the components can never disagree about which page they are on.

export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
/** A phone or tablet held upright: the wall re-lays itself on a tall frame. */
export const PORTRAIT_QUERY = `${TOUCH_QUERY} and (orientation: portrait)`;

/** @type {Map<string, MediaQueryList>} */
const lists = new Map();

/** @param {string} query */
function listFor(query) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  let list = lists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    lists.set(query, list);
  }
  return list;
}

/** @param {string} query */
const matches = (query) => Boolean(listFor(query)?.matches);

/**
 * A change listener on one query (a tablet turned on its side, a mouse
 * plugged into a tablet). Safari before 14 only has addListener.
 * @param {string} query
 */
const subscriberFor = (query) => (/** @type {() => void} */ onChange) => {
  /** @type {{ addEventListener?: Function, removeEventListener?: Function, addListener?: Function, removeListener?: Function } | null} */
  const list = listFor(query);
  if (!list) return () => {};
  if (typeof list.addEventListener === 'function') {
    list.addEventListener('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }
  list.addListener?.(onChange);
  return () => list.removeListener?.(onChange);
};

const subscribeTouch = subscriberFor(TOUCH_QUERY);
const subscribePortrait = subscriberFor(PORTRAIT_QUERY);

/** True on a phone or tablet (touch is its primary pointer). */
export const isTouch = () => matches(TOUCH_QUERY);
/** True on a phone or tablet held upright. */
export const isPortrait = () => matches(PORTRAIT_QUERY);
const desktop = () => false;

/** Re-renders when the device's primary pointer changes. */
export function useTouch() {
  return useSyncExternalStore(subscribeTouch, isTouch, desktop);
}

/** Re-renders when a phone or tablet turns. */
export function usePortrait() {
  return useSyncExternalStore(subscribePortrait, isPortrait, desktop);
}
