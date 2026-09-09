import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from '../components/icons.jsx';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { ParticleField } from '../components/ParticleField.jsx';
import { SparkleDoodles } from '../components/SparkleDoodles.jsx';
import { ClubWave } from '../components/ClubWave.jsx';
import { Eyebrow } from '../components/Eyebrow.jsx';
import { GlowText } from '../components/GlowText.jsx';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { FLAGS } from '../lib/flags.js';
import { shouldBlackout } from '../lib/idleBlackout.js';
import { useKeydown } from '../hooks/useKeydown.js';

const RESTART_KEYS = ['Space', 'Enter', 'ArrowRight', 'PageDown'];

/**
 * End-of-night screen, at full production value like every other view —
 * until nobody has touched the room for twenty minutes, at which point
 * it drops to solid black to save the projector's lamp (the shutdown
 * window runs 19:35 to midnight). Any key or mouse move brings it back.
 *
 * This lives HERE and nowhere else on purpose: shutdown is the one mode
 * guaranteed to be facing an empty room. A countdown, a ceremony or a
 * game clock going black on an idle keyboard would be a bug, not a
 * feature — people watch those without touching anything.
 */
export const ShutdownView = ({ now, onRestart }) => {
  // Idle is measured against the app's own ticking clock, so `?now=`
  // time travel can't make the screen believe it has been idle for
  // hours. A missing `now` just means "never idle".
  const nowMs = now ? now.getTime() : null;
  const nowRef = useRef(nowMs);
  const [lastActivity, setLastActivity] = useState(nowMs);
  useEffect(() => {
    nowRef.current = nowMs;
  }, [nowMs]);

  // The idle clock starts at mount. With no clock at all (`now` absent)
  // the reference point tracks the tick, so idle is always zero and the
  // screen simply never blacks out — the safe direction to fail in.
  const idleSince = lastActivity ?? nowMs;

  // ?vr=1 screenshot runs never black out — a visual-regression capture
  // of this view must be the view.
  const blackout = !FLAGS.vr && nowMs != null && shouldBlackout(nowMs - idleSince);

  // Mirrors `blackout` for the key handler, which needs to know whether
  // the operator could actually see the screen they just pressed at.
  const blackedRef = useRef(false);
  useEffect(() => {
    blackedRef.current = blackout;
  }, [blackout]);

  // Activity is only tracked to whole clock ticks: a volunteer walking
  // past generates hundreds of mousemove events, and re-rendering the
  // screen for each of them would be worse than the lamp hours this
  // saves. Same value in, no state change, no re-render.
  const wake = useCallback(() => {
    setLastActivity((prev) => (nowRef.current === prev ? prev : nowRef.current));
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', wake, { passive: true });
    return () => window.removeEventListener('mousemove', wake);
  }, [wake]);

  useKeydown((e) => {
    const wasBlack = blackedRef.current;
    wake();
    if (!RESTART_KEYS.includes(e.code)) return;
    e.preventDefault();
    // A press against a black screen only wakes it: nobody presses a
    // key at a black wall meaning "restart the whole evening".
    if (!wasBlack) onRestart();
  });

  if (blackout) {
    // Deliberately bare — every ambient layer unmounts with it, so the
    // idle screen costs nothing to run. Pure black is the house
    // background anyway; this is the degenerate case of it.
    return (
      <div
        data-blackout="1"
        className="w-full h-full"
        style={{ background: '#000000' }}
        onClick={wake}
      />
    );
  }

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
