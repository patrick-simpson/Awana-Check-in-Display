import { createContext, forwardRef, useContext } from 'react';
import { motion } from 'framer-motion';

// Whether every animation should render instantly — no fades, no
// transforms, no repeating/looping motion — regardless of what any
// individual component asks for. Provided once near the app root in
// App.jsx, driven by config.reduceMotion (which the Journey Display
// kiosk embed forces on via ?lowPower=1; see CLAUDE.md).
//
// This is the enforcement mechanism for "zero animations in the Journey
// embed, guaranteed for future components too": `M.div`/`M.span`/etc.
// below read this context directly and override `transition`
// unconditionally, so a component built with `M.*` instead of importing
// `motion` from 'framer-motion' directly is automatically covered — no
// per-component opt-in, and no way to forget it when adding a new
// animation later. `MotionConfig`'s own `reducedMotion="always"` prop
// (still set in App.jsx) only ever gates transform/positional values
// (x, y, scale, rotate, width, height, top/left/right/bottom — see
// framer-motion's own `positionalKeys` set), never opacity or anything
// else, which is why it alone can't reach true zero animation.
export const ZeroAnimationContext = createContext(false);

// framer-motion's own "jump straight to the target, no animation, no
// repeat" transition mode — the same mechanism its built-in reducedMotion
// support uses internally for the values it does gate. Using it here
// (rather than merely `{ duration: 0 }`) is what actually stops a
// `repeat: Infinity` loop from spinning forever at zero duration.
const INSTANT_TRANSITION = { type: false };

function makeZeroAnimationAware(Component, displayName) {
  const Wrapped = forwardRef(function ZeroAnimationAware({ transition, ...props }, ref) {
    const zeroAnimation = useContext(ZeroAnimationContext);
    return <Component ref={ref} {...props} transition={zeroAnimation ? INSTANT_TRANSITION : transition} />;
  });
  Wrapped.displayName = displayName;
  return Wrapped;
}

const cache = new Map();

// `M.div`, `M.span`, `M.path`, etc. — a drop-in replacement for
// `motion.*` that additionally honors ZeroAnimationContext. Proxied so
// any tag framer-motion itself supports works here too without this
// file needing to enumerate every one by hand.
export const M = new Proxy(
  {},
  {
    get(_target, tag) {
      if (typeof tag !== 'string') return undefined;
      if (!cache.has(tag)) {
        cache.set(tag, makeZeroAnimationAware(motion[tag], `M.${tag}`));
      }
      return cache.get(tag);
    },
  }
);
