import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from '../components/icons.jsx';
import { DECKS } from '../config.js';
import { useCalendarEvents } from '../hooks/useCalendarEvents.js';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { LEAVE_TOTAL, holdThen } from '../lib/landing.js';
import { HOUSE } from '../lib/kit.js';
import { useKeydown } from '../hooks/useKeydown.js';
import { ColorSweep } from '../components/ColorSweep.jsx';
import { StepChip } from '../components/StepChip.jsx';
import { Slide } from './Slide.jsx';

/**
 * A slide carries no animation of its own: its parts (kicker, headline
 * words, body words, chips) inherit these three labels and each runs its
 * own beat (lib/landing.js). The slide itself only has to stay mounted until
 * the last of its parts has left, which framer-motion does by waiting on the
 * children's exit.
 */
const SLIDE_VARIANTS = { hidden: {}, shown: {}, gone: {} };

/** The deck's first slide lands just after the view has begun to fade in. */
const FIRST_HOLD = 0.15;
/** Later slides wait for the outgoing slide's words to leave first. */
const CHANGE_HOLD = LEAVE_TOTAL + 0.02;

/**
 * Slide deck. A change is the approved mockup's, in place of the old 3D
 * flip: the outgoing lines leave upward one after another, the six club
 * colours sweep once along the bottom edge and are gone, and the next title
 * and text land. The Awana Clubs mark (App.jsx) and the pledge slides' clock
 * stay put through it, like a broadcast logo. No setTimeout state machine,
 * and keypresses are never dropped mid-transition: every press moves the
 * index and restarts the sweep.
 */
export const SlideshowView = ({ deck, now, onExit, onFinish, onBareChange }) => {
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
  // Every change bumps `n` (the sweep's key, so it replays) and records the
  // direction it swept in.
  const [change, setChange] = useState({ n: 0, dir: 1 });
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
    setChange((c) => ({ n: c.n + 1, dir }));
    setIndex(next);
  };
  const goNext = () => goTo(index + 1, 1);
  const goPrev = () => goTo(index - 1, -1);

  // The closing blackout is a bare wall: tell App to take the mark away.
  const bare = slide.layout === 'black';
  useEffect(() => {
    onBareChange?.(bare);
  }, [bare, onBareChange]);
  useEffect(() => () => onBareChange?.(false), [onBareChange]);

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
    <div className="w-full h-full relative group" style={{ background: '#000000' }}>
      <AnimatePresence>
        <motion.div
          key={slide.id}
          className="absolute inset-0"
          variants={SLIDE_VARIANTS}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          <Slide
            slide={slide}
            now={now}
            events={events}
            hold={change.n > 0 ? CHANGE_HOLD : FIRST_HOLD}
            onNext={index < slides.length - 1 || onFinish ? goNext : undefined}
          />
        </motion.div>
      </AnimatePresence>

      {/* The pledge slides' clock: it belongs to the deck, not the slide, so
          it holds still while the words around it change. */}
      <AnimatePresence>
        {slide.showClock && (
          <motion.div
            key="clock"
            className="pj-slide-clock"
            initial={{ opacity: 0 }}
            animate={holdThen(change.n > 0 ? CHANGE_HOLD : FIRST_HOLD, DUR.settle, { opacity: 0 }, { opacity: 1 }, EASE.settle)}
            exit={{ opacity: 0, transition: { duration: DUR.exit, ease: EASE.exit } }}
          >
            <SlideClock now={now} />
          </motion.div>
        )}
      </AnimatePresence>

      {change.n > 0 && <ColorSweep key={change.n} direction={change.dir} />}

      {/* Exit confirmation toast */}
      <AnimatePresence>
        {escArmed && (
          <motion.div
            className="absolute left-1/2 z-50"
            style={{ bottom: 'calc(3 * var(--u))', x: '-50%' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: DUR.pop, ease: EASE.pop } }}
            exit={{ opacity: 0, y: 12, transition: { duration: DUR.exit, ease: EASE.exit } }}
          >
            <StepChip label="Exit slides" value="Press ESC again" size="calc(2.2 * var(--u))" plate={HOUSE.hot} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover navigation */}
      <div className="fixed bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50">
        <div className="pj-panel flex gap-1 p-1">
          <NavPill disabled={index === 0} onClick={goPrev}>
            <ChevronLeft size={16} strokeWidth={2.5} />
            Prev
          </NavPill>
          <NavPill disabled={index === slides.length - 1 && !onFinish} onClick={goNext}>
            Next
            <ChevronRight size={16} strokeWidth={2.5} />
          </NavPill>
        </div>
      </div>
    </div>
  );
};

/**
 * "6:00:33 PM" in the label voice. Londrina has no tabular figures, so each
 * digit sits in its own fixed cell and the clock never twitches as the
 * seconds tick.
 */
const SlideClock = ({ now }) => {
  const text = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return (
    <span className="pj-kicker" aria-label={text}>
      {[...text].map((ch, i) =>
        /[0-9]/.test(ch)
          ? <span key={i} className="pj-fig" aria-hidden="true">{ch}</span>
          : <span key={i} aria-hidden="true">{ch}</span>,
      )}
    </span>
  );
};

const NavPill = ({ disabled, onClick, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="pj-kicker flex items-center gap-1.5 px-4 py-2 rounded-full text-white text-sm disabled:opacity-25 hover:bg-white/15 transition-all"
    style={{ letterSpacing: '0.1em', marginRight: 0 }}
  >
    {children}
  </button>
);
