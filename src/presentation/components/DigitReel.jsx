import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DUR, EASE } from '../lib/motion-tokens.js';

/**
 * One odometer digit. Fixed-width cell so timers never jiggle (Lilita
 * One has no tabular figures); motion handles the roll, so the JS/CSS
 * duration duplication of the old FlipDigit is gone.
 */
export const DigitReel = ({ value }) => (
  <span
    className="relative inline-flex justify-center overflow-hidden"
    style={{ width: '0.62em', height: '1.12em', lineHeight: '1.12em', verticalAlign: 'bottom' }}
  >
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ y: '-0.9em', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '0.9em', opacity: 0 }}
        transition={{ duration: DUR.base, ease: EASE.smooth }}
        className="inline-block"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  </span>
);
