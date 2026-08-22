import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from '../components/icons.jsx';
import { DECKS } from '../config.js';
import { useCalendarEvents } from '../hooks/useCalendarEvents.js';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { useKeydown } from '../hooks/useKeydown.js';
import { Badge } from '../components/Badge.jsx';
import { GlassPanel } from '../components/GlassPanel.jsx';
import { Slide } from './Slide.jsx';

const flipVariants = {
  enter: (dir) => ({ rotateY: dir === 1 ? 90 : -90, opacity: 0 }),
  center: { rotateY: 0, opacity: 1 },
  exit: (dir) => ({ rotateY: dir === 1 ? -90 : 90, opacity: 0 }),
};

/**
 * Slide deck with the 3D flip rebuilt on AnimatePresence — no
 * setTimeout state machine, and keypresses are never dropped
 * mid-transition.
 */
export const SlideshowView = ({ deck, now, onExit, onFinish }) => {
  // "Upcoming Awana Nights": when the calendar knows about upcoming
  // events (same calendar-feed.json the lobby display reads), the
  // closing deck ENDS on a slide announcing them — goodnight plays
  // first, then the deck settles on the events and holds: parents in
  // the room at pickup are exactly the audience for it.
  const events = useCalendarEvents();
  const slides = useMemo(() => {
    const base = DECKS[deck];
    if (deck !== 'closing' || events.length === 0) return base;
    const comingUp = {
      id: 'coming-up',
      layout: 'coming-up',
      title: 'Upcoming Awana Nights',
      // No duration: the deck remains here for the rest of the window.
    };
    // Goodnight gains a duration so the deck auto-settles on the events
    // even when nobody touches the keyboard.
    return [...base.map((s) => (s.duration ? s : { ...s, duration: 20 })), comingUp];
  }, [deck, events]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [escArmed, setEscArmed] = useState(false);

  const slide = slides[Math.min(index, slides.length - 1)];

  const goTo = (next, dir) => {
    if (next < 0) return;
    if (next >= slides.length) {
      // Past the end of the deck: the opening ceremony hands off to the
      // first game window (onFinish, wired in App.jsx) — one more press
      // of the same arrow key on the final blackout starts T&T games.
      // Decks without a hand-off (closing) simply hold their last slide.
      onFinish?.();
      return;
    }
    setDirection(dir);
    setIndex(next);
  };
  const goNext = () => goTo(index + 1, 1);
  const goPrev = () => goTo(index - 1, -1);

  // Auto-advance (leader can always advance manually first)
  useEffect(() => {
    if (!slide.duration || index >= slides.length - 1) return;
    const timer = setTimeout(goNext, slide.duration * 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, slide.duration, slides.length]);

  // Escape is press-twice (replaces the old window.confirm dialog)
  useEffect(() => {
    if (!escArmed) return;
    const timer = setTimeout(() => setEscArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [escArmed]);

  useKeydown((e) => {
    if (['Space', 'ArrowRight', 'PageDown'].includes(e.code)) {
      e.preventDefault();
      goNext();
    } else if (['ArrowLeft', 'PageUp'].includes(e.code)) {
      e.preventDefault();
      goPrev();
    } else if (e.code === 'Escape') {
      if (escArmed) onExit();
      else setEscArmed(true);
    }
  });

  return (
    <div className="w-full h-full relative group" style={{ background: '#000000', perspective: '1200px' }}>
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={slide.id}
          className="absolute inset-0"
          custom={direction}
          variants={flipVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: DUR.slow, ease: EASE.smooth }}
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
        >
          <Slide slide={slide} now={now} events={events} onNext={index < slides.length - 1 || onFinish ? goNext : undefined} />
        </motion.div>
      </AnimatePresence>

      {/* Exit confirmation toast */}
      <AnimatePresence>
        {escArmed && (
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: DUR.fast, ease: EASE.smooth }}
          >
            <Badge color="#FFC107" size="sm" sparkle>
              Press ESC again to exit
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover navigation */}
      <div className="fixed bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50">
        <GlassPanel className="flex gap-1 p-1">
          <NavPill disabled={index === 0} onClick={goPrev}>
            <ChevronLeft size={16} strokeWidth={2.5} />
            Prev
          </NavPill>
          <NavPill disabled={index === slides.length - 1 && !onFinish} onClick={goNext}>
            Next
            <ChevronRight size={16} strokeWidth={2.5} />
          </NavPill>
        </GlassPanel>
      </div>
    </div>
  );
};

const NavPill = ({ disabled, onClick, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-xs uppercase disabled:opacity-25 hover:bg-white/15 transition-all"
    style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, letterSpacing: '0.12em' }}
  >
    {children}
  </button>
);
