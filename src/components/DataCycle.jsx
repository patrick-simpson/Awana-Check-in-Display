import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { formatClock } from './WallClock.jsx';
import { WeatherGlyph } from './WeatherGlyphs.jsx';
import { weatherPresentation } from '../lib/weather.js';
import { Mark } from './Doodles.jsx';

/**
 * Bottom-right animated data cycle — the 'cycle' widget display mode.
 * One data point holds the corner at a time (time, tonight's tally,
 * weather), then hands
 * off to the next with its own playful entrance and exit. No sticker
 * chrome: just big floating catalog type over whatever slide is up.
 *
 * Every variant animates opacity too, so <MotionConfig
 * reducedMotion="user"> degrades each handoff to a plain crossfade;
 * the infinite idle loops are gated off entirely for those viewers.
 */

// Each item enters, idles and leaves in character: the clock springs up
// like it bounced off the floor, the tally slaps on like a sticker, the
// weather drifts through like a passing cloud, and items drop
// in from above. Tilt lives in the variants (declared in every state)
// so framer-motion owns the transform end to end — a CSS rotate would
// be clobbered the moment x/y/scale animate.
const VARIANTS = {
  clock: {
    hidden: { opacity: 0, y: 56, scale: 0.7, rotate: 4 },
    show: {
      opacity: 1, y: 0, scale: 1, rotate: -1.5,
      transition: { type: 'spring', stiffness: 300, damping: 15 },
    },
    exit: {
      opacity: 0, y: -28, scale: 0.92, rotate: -1.5,
      transition: { duration: 0.35, ease: 'easeIn' },
    },
  },
  tally: {
    hidden: { opacity: 0, y: 0, scale: 0.25, rotate: -14 },
    show: {
      opacity: 1, y: 0, scale: 1, rotate: 1.5,
      transition: { type: 'spring', stiffness: 420, damping: 15 },
    },
    // Squash, hop, and dive off the bottom.
    exit: {
      opacity: [1, 1, 0], y: [0, -12, 36], scale: [1, 1.12, 0.4], rotate: 1.5,
      transition: { duration: 0.45, times: [0, 0.35, 1], ease: 'easeIn' },
    },
  },
  weather: {
    hidden: { opacity: 0, x: 72, rotate: 10 },
    show: {
      opacity: 1, x: 0, rotate: -1,
      transition: { type: 'spring', stiffness: 200, damping: 18 },
    },
    exit: {
      opacity: 0, x: -56, rotate: -6,
      transition: { duration: 0.4, ease: 'easeIn' },
    },
  },
};

// Pure so the cycling order is unit-testable. Tracks the active item by
// id, not index — items appear and vanish (countdown ends, first
// check-in lands) and an index would silently point at the wrong one.
export function nextActiveId(ids, activeId) {
  if (!ids.length) return null;
  const i = ids.indexOf(activeId);
  return i === -1 ? ids[0] : ids[(i + 1) % ids.length];
}

// The pre-club countdown card retired in favor of the presentation
// tool (countdown.html), which owns countdown duty for the program —
// see MIGRATION.md. The clock/tally/weather rotation is unchanged.
export default function DataCycle({
  count,
  weather,
  showClock,
  showTally,
  showWeather,
  intervalSec,
}) {
  const reduced = useReducedMotion();

  // One shared 1-second tick drives the clock face.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Booleans only in the deps — a weather refresh or tally bump must
  // not rebuild the list and restart the hold timer mid-item.
  const hasTally = showTally && count > 0;
  const hasWeather = showWeather && Boolean(weather);
  const ids = useMemo(
    () => [
      showClock && 'clock',
      hasTally && 'tally',
      hasWeather && 'weather',
    ].filter(Boolean),
    [showClock, hasTally, hasWeather]
  );

  const [activeId, setActiveId] = useState(() => ids[0] ?? null);

  // The stored id can go stale when items appear or vanish (countdown
  // hits zero mid-hold, a toggle flips off) — resolve the one actually
  // shown during render instead of waiting on an effect (the
  // ManualSlideshow `safe` index pattern).
  const active = ids.includes(activeId) ? activeId : nextActiveId(ids, activeId);

  // Advance on a timer — but a lone item just holds the corner. Its
  // AnimatePresence key never changes, so it never churns out and back.
  useEffect(() => {
    if (ids.length < 2 || active == null) return undefined;
    const timer = setTimeout(
      () => setActiveId(nextActiveId(ids, active)),
      intervalSec * 1000
    );
    return () => clearTimeout(timer);
  }, [ids, active, intervalSec]);

  if (active == null) return null;

  return (
    <div className="data-cycle" aria-live="off">
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          className={`data-cycle-item data-cycle-${active}`}
          variants={VARIANTS[active]}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {active === 'clock' && <ClockFace now={now} reduced={reduced} />}
          {active === 'tally' && <TallyFace count={count} reduced={reduced} />}
          {active === 'weather' && <WeatherFace weather={weather} reduced={reduced} />}
          {/* One sparkle winks just after each item lands. */}
          <motion.span
            className="data-cycle-spark"
            aria-hidden
            initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1.15, 0.6], rotate: [0, 18, 0] }}
            transition={{ delay: 0.45, duration: 1.1, ease: 'easeInOut' }}
          >
            <Mark kind="sparkle" size={26} />
          </motion.span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// The faces are inner elements so their idle loops never fight the
// entry spring animating transform on the outer item (the WeatherChip
// glyph/chip split).

function ClockFace({ now, reduced }) {
  const { time, meridiem } = formatClock(now);
  const [hours, minutes] = time.split(':');
  return (
    <>
      <span className="data-cycle-eyebrow">Right now</span>
      <motion.span
        className="data-cycle-value"
        role="timer"
        aria-label={`Current time ${time} ${meridiem}`}
        animate={reduced ? undefined : { y: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {hours}
        <motion.span
          className="data-cycle-colon"
          aria-hidden
          animate={reduced ? undefined : { opacity: [1, 0.25, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          :
        </motion.span>
        {minutes}
        <span className="data-cycle-unit">{meridiem}</span>
      </motion.span>
    </>
  );
}

function TallyFace({ count, reduced }) {
  return (
    <>
      <span className="data-cycle-eyebrow">Tonight</span>
      <motion.span
        className="data-cycle-value"
        animate={reduced ? undefined : { scale: [1, 1.045, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Remounting on every increment gives the number a joyful
            little pop-and-twist as each kid checks in. */}
        <motion.span
          key={count}
          className="data-cycle-pop"
          initial={{ scale: 1.5, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 15 }}
        >
          {count}
        </motion.span>
      </motion.span>
      <span className="data-cycle-sub">checked in</span>
    </>
  );
}

function WeatherFace({ weather, reduced }) {
  const { label, icon } = weatherPresentation(weather.code, weather.isDay);
  const unit = weather.units === 'celsius' ? 'C' : 'F';
  return (
    <>
      <span className="data-cycle-eyebrow">Outside</span>
      <span
        className="data-cycle-row"
        role="status"
        aria-label={`${weather.temp} degrees, ${label}`}
      >
        {/* The glyph bobs and sways like it's happy to be here. */}
        <motion.span
          className="data-cycle-glyph"
          aria-hidden
          animate={reduced ? undefined : { y: [0, -3, 0], rotate: [-3, 3, -3] }}
          transition={{
            y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
            rotate: { duration: 5.4, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <WeatherGlyph icon={icon} stroke="#ffffff" fill="#ffe6a3" />
        </motion.span>
        <span className="data-cycle-value">
          {weather.temp}°<span className="data-cycle-unit">{unit}</span>
        </span>
      </span>
      <span className="data-cycle-sub">{label}</span>
    </>
  );
}

