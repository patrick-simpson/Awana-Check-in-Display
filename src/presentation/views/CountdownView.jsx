import React, { useEffect, useRef } from 'react';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { WeatherScene } from '../components/WeatherScene.jsx';
import { ParticleField } from '../components/ParticleField.jsx';
import { SparkleDoodles } from '../components/SparkleDoodles.jsx';
import { Badge } from '../components/Badge.jsx';
import { BigTimer } from '../components/BigTimer.jsx';
import { EventChips } from '../components/EventChips.jsx';
import { GlowText } from '../components/GlowText.jsx';
import { secondsUntil } from '../lib/schedule.js';
import { playStinger } from '../lib/stingers.js';
import { useKeydown } from '../hooks/useKeydown.js';
import { useWeather } from '../hooks/useWeather.js';
import { useCalendarEvents } from '../hooks/useCalendarEvents.js';

// The five remaining-time marks that sound the optional chime. There is
// deliberately NO on-screen badge any more — the operator asked for the
// popup that read "5 MINUTES!" to be gone from the projector (2026-09).
// The chime is a SEPARATE opt-in feature (off by default, armed from
// QuickNav, which advertises it as "Chimes at 1hr/30/10/5/1min"), so
// these times and the 1-vs-0.5 intensity split must stay exactly as they
// were: removing the visual must not change whether or when audio fires.
const STINGER_TIMES = [3600, 1800, 600, 300, 60];

/**
 * The week-long countdown to Wednesday 6:00 PM. Time flows in via the
 * single app clock — this view owns no timers of its own.
 * `onSkip` is the operator skip (Space / click) — jumps to the opening
 * ceremony. `theme` is the church-authored meeting theme from a fresh
 * `schedule` broadcast (hooks/useRealtime.js, lib/scheduleAdvisory.js
 * `advisoryTitle`) — purely informational, shown only while present.
 */
export const CountdownView = ({ now, target, theme, onSkip }) => {
  const seconds = secondsUntil(target, now);
  const weather = useWeather();
  const events = useCalendarEvents();

  const soundedStingers = useRef(new Set());

  useEffect(() => {
    if (STINGER_TIMES.includes(seconds) && !soundedStingers.current.has(seconds)) {
      soundedStingers.current.add(seconds);
      // Optional synthesized chime (QuickNav toggle, off by default);
      // the final minute gets the big three-note version.
      playStinger(seconds <= 60 ? 1 : 0.5);
    }
  }, [seconds]);

  useKeydown((e) => {
    if (['Space', 'ArrowRight', 'PageDown'].includes(e.code)) {
      e.preventDefault();
      onSkip();
    }
  });

  const isShaking = seconds > 0 && seconds <= 10;

  const targetTimeStr = target.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <ScreenFrame
      shake={isShaking}
      layers={
        <>
          <WeatherScene weather={weather} />
          <ParticleField />
          <SparkleDoodles seed={3} count={14} />
        </>
      }
    >
      {/* Center stack */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 relative">
        <GlowText
          as="p"
          font="display"
          color="#FFFFFF"
          className="uppercase text-center leading-none"
          style={{ fontSize: 'clamp(2.25rem, 4.5vw, 5.5rem)' }}
        >
          Awana begins in
        </GlowText>

        <BigTimer seconds={seconds} urgencyEnabled onClick={onSkip} />

        {seconds >= 24 * 3600 && (
          <div className="flex flex-col items-center gap-1">
            <GlowText
              as="p"
              size="body-lg"
              font="body"
              color="rgba(255,255,255,0.72)"
              className="tracking-wide"
            >
              Next meeting · Wednesday · {targetTimeStr}
            </GlowText>
          </div>
        )}

        {theme && (
          <Badge color="#FFB627" size="sm" style={{ opacity: 0.9 }}>
            {theme}
          </Badge>
        )}

        <EventChips events={events} />
      </div>
    </ScreenFrame>
  );
};
