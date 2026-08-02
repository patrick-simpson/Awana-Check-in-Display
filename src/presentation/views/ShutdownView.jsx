import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from '../components/icons.jsx';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { ParticleField } from '../components/ParticleField.jsx';
import { SparkleDoodles } from '../components/SparkleDoodles.jsx';
import { ClubWave } from '../components/ClubWave.jsx';
import { Eyebrow } from '../components/Eyebrow.jsx';
import { GlowText } from '../components/GlowText.jsx';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { useKeydown } from '../hooks/useKeydown.js';

/** End-of-night screen, now at full production value like every other view. */
export const ShutdownView = ({ onRestart }) => {
  useKeydown((e) => {
    if (['Space', 'Enter', 'ArrowRight', 'PageDown'].includes(e.code)) {
      e.preventDefault();
      onRestart();
    }
  });

  return (
    <ScreenFrame
      layers={
        <>
          <ClubWave color="#F7941D" intensity={0.4} height={26} animate={false} />
          <ParticleField />
          <SparkleDoodles seed={9} count={8} />
        </>
      }
    >
      <div
        className="flex-1 flex flex-col items-center justify-center cursor-pointer gap-4"
        onClick={onRestart}
      >
        <Eyebrow className="mb-2">Awana Night</Eyebrow>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DUR.slow, ease: EASE.pop }}
        >
          <GlowText
            as="h1"
            size="h1"
            font="display"
            color="#FFFFFF"
            className="text-center leading-tight"
          >
            SEE YOU NEXT WEEK!
          </GlowText>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.smooth, delay: 0.4 }}
        >
          <GlowText
            as="p"
            size="script"
            font="script"
            color="#FFB627"
            style={{ fontWeight: 600 }}
          >
            have a safe drive home!
          </GlowText>
        </motion.div>

        <button
          className="mt-14 flex items-center gap-2 px-8 py-3 rounded-full border-2 border-white/20 text-white/40 uppercase hover:text-white hover:border-white/60 transition-all duration-300"
          style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, letterSpacing: '0.15em' }}
          onClick={(e) => {
            e.stopPropagation();
            onRestart();
          }}
        >
          <RotateCcw size={16} strokeWidth={2.5} />
          Start Over
        </button>
        <p
          className="text-white/25 uppercase text-xs"
          style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.2em' }}
        >
          or press Space
        </p>
      </div>
    </ScreenFrame>
  );
};
