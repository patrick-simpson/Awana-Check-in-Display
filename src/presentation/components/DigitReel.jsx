import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DUR, EASE } from '../lib/motion-tokens.js';

/**
 * Width of one digit cell, in em. Galindo has no tabular figures and its
 * digits run from 0.42em ("1") to 0.76em ("0") of advance, so every digit
 * gets the same cell or the whole clock would twitch each second. 0.70em
 * holds the widest ink (the zero's 0.688em) with nothing clipped, and keeps
 * the familiar digits close to their natural spacing.
 */
export const DIGIT_CELL_EM = 0.7;

/**
 * One odometer digit: a fixed-width cell, the new figure rolling in from
 * above as the old one rolls out below (settle in, exit out). The cell clips
 * only top and bottom (clip-path), so a figure's ink is never shaved at the
 * sides; its 1.12em line leaves Galindo's figures (-0.05em to 0.75em about
 * the baseline) clear of both edges at rest.
 */
export const DigitReel = ({ value }) => (
  <span className="pj-reel" style={{ width: `${DIGIT_CELL_EM}em` }}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        className="pj-reel__digit"
        initial={{ y: '-0.9em', opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { duration: DUR.settle, ease: EASE.settle } }}
        exit={{ y: '0.9em', opacity: 0, transition: { duration: DUR.exit, ease: EASE.exit } }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  </span>
);
