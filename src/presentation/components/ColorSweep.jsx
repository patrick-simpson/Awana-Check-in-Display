import React from 'react';
import { motion } from 'framer-motion';
import { WAVE } from './ClubWave.jsx';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { SWEEP_HEIGHT_U, sweepWaves } from '../lib/sweep.js';

/**
 * The club-colour sweep between two slides (the approved mockup, in place of
 * the old 3D flip): the six club waves cross the bottom edge once, youngest
 * first, and are gone, so the wall is bare black again. Mount it with a new
 * `key` for every change; it plays once and rests OFF the wall, which is
 * also where ?vr=1 and reduced motion (both skip transforms) leave it.
 * `direction` -1 (stepping back through a deck) sweeps right to left.
 *
 * @param {{ direction?: 1 | -1 }} props
 */
export const ColorSweep = ({ direction = 1 }) => (
  <div
    className="pj-sweep"
    data-sweep
    aria-hidden="true"
    style={{ height: `calc(${SWEEP_HEIGHT_U} * var(--u))` }}
  >
    {sweepWaves(direction).map((w) => (
      <motion.div
        key={w.club}
        className="pj-wave"
        style={{ height: `${w.heightPct}%`, left: 0, right: 0, bottom: 0 }}
        initial={{ x: w.from }}
        animate={{ x: w.to }}
        transition={{ duration: DUR.sweep, ease: EASE.wipe, delay: w.delay }}
      >
        <svg
          viewBox={WAVE.viewBox}
          preserveAspectRatio="none"
          style={w.flip ? { transform: 'scaleX(-1)' } : undefined}
          focusable="false"
        >
          <path d={WAVE.d} fill={w.color} />
        </svg>
      </motion.div>
    ))}
  </div>
);
