import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CHURCH } from '../church.config.js';
import { secondsUntil } from '../lib/schedule.js';
import { DUR, EASE } from '../lib/motion-tokens.js';

/**
 * Watchdog warning pill (bottom-center, like the ESC toast): appears in
 * the final `warningSec` seconds of a QuickNav override, counting down
 * to auto-resume with a "Stay" escape hatch. Broadcast-clean: glass
 * chip, amber glow, motion in/out.
 */
export const ResumePill = ({ now, resumeAt, onStay }) => {
  const seconds = resumeAt ? secondsUntil(resumeAt, now) : null;
  const visible = seconds !== null && seconds <= CHURCH.watchdog.warningSec;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute bottom-8 left-1/2 z-50 flex items-center gap-3"
          style={{
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-condensed)',
            letterSpacing: '0.1em',
            padding: '0.5rem 1.1rem',
            borderRadius: 'var(--radius-chip)',
            background: 'rgba(10,10,10,0.78)',
            border: '2px solid #FFC107',
            boxShadow: '0 0 18px rgba(255,193,7,0.4)',
            backdropFilter: 'blur(8px)',
          }}
          initial={{ opacity: 0, y: 16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 16, x: '-50%' }}
          transition={{ duration: DUR.base, ease: EASE.pop }}
        >
          <span className="uppercase text-white text-sm" style={{ fontWeight: 800 }}>
            Back to schedule in {seconds}s
          </span>
          <button
            onClick={onStay}
            className="uppercase text-xs px-3 py-1 rounded-full text-amber-300 hover:text-black hover:bg-amber-300 transition-colors border border-amber-300/60"
            style={{ fontWeight: 800, letterSpacing: '0.12em' }}
          >
            Stay
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
