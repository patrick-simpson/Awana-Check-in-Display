import React from 'react';
import { motion } from 'framer-motion';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { ParticleField } from '../components/ParticleField.jsx';
import { SparkleDoodles } from '../components/SparkleDoodles.jsx';
import { ConfettiBurst } from '../components/ConfettiBurst.jsx';
import { Headline } from '../components/Headline.jsx';
import { Kicker } from '../components/Kicker.jsx';
import { BodyText } from '../components/BodyText.jsx';
import { StepChip } from '../components/StepChip.jsx';
import { wordCount } from '../components/Words.jsx';
import { HOUSE } from '../lib/kit.js';
import { ambientVariants, partVariants } from '../lib/landing.js';

/**
 * One slide, laid out by its explicit `layout` field, in the kit's three
 * voices: a Londrina kicker names it, a Galindo headline shouts it, Figtree
 * carries anything the room reads. Every kicker, headline word, body word
 * and chip is a PART: it inherits its slide's hidden / shown / gone state
 * from SlideshowView and lands (or leaves upward) on its own beat, in
 * reading order (lib/landing.js). `hold` is how long the slide waits before
 * its first part lands: long enough for the outgoing slide's words to leave.
 */
export const Slide = ({ slide, now, events, hold = 0, onNext }) => {
  // The ceremony ends on a deliberate blackout: no logo (App hides the mark),
  // no clock, no ambient layers. Checked before anything below reads
  // slide.title (the doodle seed) so a black slide truly renders nothing else.
  if (slide.layout === 'black') return <div className="w-full h-full" style={{ background: '#000000' }} />;

  return (
    <ScreenFrame
      layers={
        <motion.div className="absolute inset-0" variants={ambientVariants(hold)}>
          <ParticleField />
          <SparkleDoodles seed={slide.id.length + slide.title.length} count={slide.layout === 'celebration' ? 22 : 10} />
        </motion.div>
      }
    >
      <div className="pj-frame">
        <div className="pj-slide">
          <SlideBody slide={slide} now={now} events={events} hold={hold} />
        </div>
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

/** A slide headline: the mockup's 7.6u, on one line across the text block when it can. */
const HEADLINE_FIT = { maxU: 7.6, widthU: 82 };

/** "Wednesday night": the welcome's kicker, from the evening it is. */
export const nightOf = (now) => `${(now ?? new Date()).toLocaleDateString([], { weekday: 'long' })} night`;

const SlideBody = ({ slide, now, events, hold }) => {
  switch (slide.layout) {
    case 'celebration':
    case 'welcome':
      return (
        <>
          <Kicker size="var(--text-kicker)" part={{ index: 0, hold }}>{nightOf(now)}</Kicker>
          <Headline
            text={slide.title}
            fit={HEADLINE_FIT}
            parts={{ start: 1, hold }}
            style={{ marginTop: 'calc(1.4 * var(--u))' }}
          />
          {slide.subtitle && (
            <BodyText
              text={slide.subtitle}
              size="var(--text-body)"
              parts={{ start: 1 + wordCount(slide.title), hold }}
              style={{ marginTop: 'calc(2 * var(--u))' }}
            />
          )}
        </>
      );

    case 'pledge':
      return (
        <>
          <Kicker size="var(--text-kicker)" part={{ index: 0, hold }}>{slide.title}</Kicker>
          <BodyText
            text={slide.body}
            size="var(--text-body)"
            parts={{ start: 1, hold }}
            style={{ marginTop: 'calc(2 * var(--u))' }}
          />
        </>
      );

    case 'closing':
      return (
        <>
          <Headline text={slide.title} fit={HEADLINE_FIT} parts={{ start: 0, hold }} />
          {slide.body && (
            <BodyText
              text={slide.body}
              size="var(--text-body)"
              parts={{ start: wordCount(slide.title), hold }}
              style={{ marginTop: 'calc(2 * var(--u))' }}
            />
          )}
        </>
      );

    case 'coming-up':
      return (
        <>
          <Headline text={slide.title} fit={{ maxU: 5.6, widthU: 84 }} parts={{ start: 0, hold }} />
          <ComingUpList events={events ?? []} start={wordCount(slide.title)} hold={hold} />
        </>
      );
  }
};

/** "WED SEP 23": the chip label for one upcoming night. */
export const nightLabel = (date) =>
  date
    .toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(/,/g, '')
    .toUpperCase();

/**
 * Upcoming calendar nights for the closing "Coming up" slide, as stepped
 * chips: the date over the night's name. A special night (a theme night, a
 * party) gets the kit's one hot red-orange; an ordinary club night the
 * house blue.
 */
const ComingUpList = ({ events, start, hold }) => {
  const upcoming = events.slice(0, 5);
  if (upcoming.length === 0) {
    return (
      <BodyText
        text="See you next week!"
        size="var(--text-body)"
        parts={{ start, hold }}
        style={{ marginTop: 'calc(2 * var(--u))' }}
      />
    );
  }
  return (
    <div className="pj-chip-row" style={{ marginTop: 'calc(3.4 * var(--u))', maxWidth: 'calc(80 * var(--u))' }}>
      {upcoming.map((event, idx) => (
        <motion.span
          key={`${event.title}-${event.daysUntil}`}
          className="inline-block"
          variants={partVariants(start + idx, hold)}
        >
          <StepChip
            label={nightLabel(event.date)}
            value={event.title}
            size="calc(3.2 * var(--u))"
            plate={event.isSpecial ? HOUSE.hot : HOUSE.blueDeep}
          />
        </motion.span>
      ))}
    </div>
  );
};
