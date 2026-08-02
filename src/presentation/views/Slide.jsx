import React from 'react';
import { motion } from 'framer-motion';
import { DUR, EASE } from '../lib/motion-tokens.js';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { AmbientOrbs } from '../components/AmbientOrbs.jsx';
import { ParticleField } from '../components/ParticleField.jsx';
import { SparkleDoodles } from '../components/SparkleDoodles.jsx';
import { ConfettiBurst } from '../components/ConfettiBurst.jsx';
import { Logo } from '../components/Logo.jsx';
import { Badge } from '../components/Badge.jsx';
import { Eyebrow } from '../components/Eyebrow.jsx';
import { GlowText } from '../components/GlowText.jsx';
import { rgbTriple } from '../lib/color.js';

/**
 * One slide, laid out by its explicit `layout` field (the old version
 * guessed from slide id and body length).
 */
export const Slide = ({ slide, now, events, onNext }) => {
  // The ceremony ends on a deliberate blackout: no logo, no clock, no
  // divider, no ambient layers — checked before anything below reads
  // slide.title (the doodle seed) so a black slide truly renders nothing else.
  if (slide.layout === 'black') return <div className="w-full h-full" style={{ background: '#000000' }} />;

  const timeString = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <ScreenFrame
      layers={
        <>
          <AmbientOrbs variant="quiet" />
          <ParticleField />
          <SparkleDoodles seed={slide.id.length + slide.title.length} count={slide.layout === 'celebration' ? 22 : 10} />
        </>
      }
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-10 py-5 flex-shrink-0">
        <Logo size="sm" />
        {slide.showClock && (
          <div
            className="text-slate-200 tabular-nums select-none"
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 700,
              fontSize: 'clamp(1.25rem, 1.8vw, 2.25rem)',
              letterSpacing: '0.08em',
              textShadow: '0 0 20px rgba(255,255,255,0.3)',
            }}
          >
            {timeString}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative mx-10 flex-shrink-0">
        <div className="h-px bg-white/10" />
        <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mt-px" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-16 pb-10 min-h-0">
        <SlideBody slide={slide} events={events} />
      </div>

      {slide.layout === 'celebration' && <ConfettiBurst />}

      {/* Invisible right-edge next-slide click zone */}
      {onNext && (
        <button
          onClick={onNext}
          className="absolute inset-y-0 right-0 w-24 cursor-pointer z-50 focus:outline-none opacity-0"
          aria-label="Next Slide"
        />
      )}
    </ScreenFrame>
  );
};

const SlideBody = ({ slide, events }) => {
  switch (slide.layout) {
    case 'celebration':
      return (
        <>
          <GlowHeadline text={slide.title} gradient="rainbow" size="display" />
          {slide.subtitle && <ScriptLine text={slide.subtitle} color="#FFC107" />}
        </>
      );

    case 'welcome':
      return (
        <>
          <Eyebrow className="mb-6">{slide.title}</Eyebrow>
          <GlowHeadline text={slide.title} gradient="rainbow" size="display" />
          {slide.subtitle && <ScriptLine text={slide.subtitle} color="#FFFFFF" />}
        </>
      );

    case 'pledge':
      return (
        <>
          <p
            className="text-white text-center max-w-[90rem] leading-snug"
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 700,
              fontSize: 'var(--text-pledge)',
              '--glow-color': '255 255 255',
              textShadow: 'var(--glow-sm)',
            }}
          >
            {slide.body}
          </p>
        </>
      );

    case 'closing':
      return (
        <>
          <GlowHeadline text={slide.title} gradient="amber" size="h1" />
          {slide.body && <ScriptLine text={slide.body} color="#FFC107" />}
        </>
      );

    case 'coming-up':
      return (
        <>
          <GlowHeadline text={slide.title} gradient="amber" size="h1" />
          <ComingUpList events={events ?? []} />
        </>
      );
  }
};

/** Upcoming calendar events for the closing "Coming up" slide. */
const COMING_UP_COLORS = ['#FFC107', '#E8192C', '#0072CE', '#00A651', '#F7941D'];

const ComingUpList = ({ events }) => {
  const upcoming = events.slice(0, 5);
  if (upcoming.length === 0) {
    return <ScriptLine text="See you next week!" color="#FFC107" />;
  }
  return (
    <div className="mt-10 flex flex-col items-center gap-4">
      {upcoming.map((event, idx) => (
        <motion.div
          key={`${event.title}-${event.daysUntil}`}
          initial={{ opacity: 0, x: idx % 2 === 0 ? -24 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: DUR.base, ease: EASE.smooth, delay: 0.15 + idx * 0.12 }}
        >
          <Badge color={COMING_UP_COLORS[idx % COMING_UP_COLORS.length]} size="md" sparkle={event.isSpecial}>
            <span style={{ letterSpacing: 0 }}>{event.isSpecial ? '⭐' : '📅'}</span>
            {event.title}
            <span className="opacity-70">
              · {event.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </Badge>
        </motion.div>
      ))}
    </div>
  );
};

/** Display headline with the blurred glow layer behind gradient text. */
const GlowHeadline = ({ text, gradient, size }) => (
  <div className="relative">
    <h1
      className="leading-none text-center absolute inset-0"
      aria-hidden="true"
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: `var(--text-${size})`,
        color: '#ffffff',
        filter: 'blur(35px)',
        opacity: 0.4,
      }}
    >
      {text}
    </h1>
    <h1
      className={`leading-none text-center relative ${
        gradient === 'rainbow' ? 'gradient-text-animated' : 'gradient-text-amber'
      }`}
      style={{ fontFamily: 'var(--font-display)', fontSize: `var(--text-${size})` }}
    >
      {text}
    </h1>
  </div>
);

/** Casual handwritten accent line (catalog script labels). */
const ScriptLine = ({ text, color }) => (
  <GlowText
    as="p"
    size="script"
    font="script"
    color={color}
    glow="sm"
    className="mt-8 text-center"
    style={{ '--glow-color': rgbTriple(color), fontWeight: 600 }}
  >
    {text}
  </GlowText>
);
