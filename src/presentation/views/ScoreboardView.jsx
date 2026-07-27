import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { AmbientOrbs } from '../components/AmbientOrbs.jsx';
import { ParticleField } from '../components/ParticleField.jsx';
import { SparkleDoodles } from '../components/SparkleDoodles.jsx';
import { Logo } from '../components/Logo.jsx';
import { Badge } from '../components/Badge.jsx';
import { GlowText } from '../components/GlowText.jsx';
import { rgbTriple } from '../lib/color.js';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { isPointsFresh, rankGroups } from '../lib/points.js';
import { useKeydown } from '../hooks/useKeydown.js';

/**
 * Color-team points race, fed by the print server's `points` broadcast
 * (src/lib/eventSanitizers.js sanitizePoints — numbers only; team
 * names are church-configured strings, never a fixed roster). Reached
 * only by an operator QuickNav pick — there is no schedule.json window
 * for it, since a points program is optional and church-run — so it
 * must degrade cleanly with no data yet and age itself out exactly
 * like the game-time tally (`points` arrives as a prop from
 * hooks/useRealtime.js). `onExit` (Space/Escape, like the other
 * manually-invoked views) hands the screen straight back to the
 * schedule instead of waiting out the QuickNav watchdog.
 */
export const ScoreboardView = ({ now, points, onExit }) => {
  const fresh = isPointsFresh(points, now);
  const ranked = fresh ? rankGroups(points.groups) : [];
  const max = ranked.reduce((m, g) => Math.max(m, g.points), 0) || 1;
  const leader = ranked[0];

  useKeydown((e) => {
    if (!onExit) return;
    if (['Space', 'Escape', 'ArrowRight', 'PageDown'].includes(e.code)) {
      e.preventDefault();
      onExit();
    }
  });

  return (
    <ScreenFrame
      vignette="deep"
      layers={
        <>
          <AmbientOrbs tint={leader?.color} />
          <ParticleField />
          <SparkleDoodles seed={11} colors={[...ranked.map((g) => g.color), '#FFFFFF']} count={14} />
        </>
      }
    >
      <div className="absolute top-6 left-8 z-20">
        <Logo />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full px-8 md:px-16">
        <GlowText
          as="h1"
          size="h1"
          font="display"
          color="#FFC107"
          glow="lg"
          className="leading-none text-center select-none"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          POINTS RACE
        </GlowText>

        <AnimatePresence mode="wait">
          {ranked.length === 0 ? (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: DUR.base, ease: EASE.smooth }}
            >
              <Badge color="#FFC107" size="lg" sparkle>
                Waiting for scores…
              </Badge>
            </motion.div>
          ) : (
            <motion.div
              key="board"
              className="w-full max-w-5xl flex flex-col gap-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.base, ease: EASE.smooth }}
            >
              <AnimatePresence initial={false}>
                {ranked.map((group) => (
                  <ScoreBar key={group.name} group={group} max={max} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {onExit && (
        <p
          className="absolute bottom-6 right-8 z-20 text-white/25 uppercase text-xs select-none"
          style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.2em' }}
        >
          Press Space to return
        </p>
      )}
    </ScreenFrame>
  );
};

const ScoreBar = ({ group, max }) => {
  const pct = Math.max(6, Math.round((group.points / max) * 100));
  return (
    <motion.div
      layout
      className="flex items-center gap-5"
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: DUR.slow, ease: EASE.pop }}
    >
      <div
        className="w-16 text-center flex-shrink-0 select-none"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.75rem, 3.2vw, 4rem)',
          color: group.color,
          opacity: 0.9,
        }}
      >
        #{group.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-4 mb-1.5">
          <span
            className="uppercase truncate"
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              letterSpacing: '0.08em',
              fontSize: 'var(--text-body-lg)',
              color: '#FFFFFF',
            }}
          >
            {group.name}
          </span>
          <GlowText as="span" size="body-lg" font="display" color={group.color} glow="sm">
            {group.points}
          </GlowText>
        </div>
        <div className="h-7 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: group.color,
              ['--glow-color']: rgbTriple(group.color),
              boxShadow: '0 0 18px rgb(var(--glow-color) / 0.6)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: DUR.slow, ease: EASE.smooth }}
          />
        </div>
      </div>
    </motion.div>
  );
};
