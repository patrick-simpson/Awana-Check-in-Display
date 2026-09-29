import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import { DUR, EASE, beats } from '../lib/brand.js';
import { holdThenLand } from '../lib/lobbyMotion.js';
import { isBigMilestone, ordinalNight } from '../lib/milestones.js';
import { OVERLAY, bandRoom, fitShout, plateChrome } from '../lib/overlayFit.js';
import { useFontsReady } from '../hooks/useFontsReady.js';
import StepPlate from './brand/StepPlate.jsx';
import DoodleCluster from './brand/DoodleCluster.jsx';
import ClubBadge from './ClubBadge.jsx';

/**
 * One celebration at a time (useCelebrationQueue), as a kit chip in the top
 * band: the catalog's stepped chip with a Londrina kicker on its pill and a
 * Paytone One line on its block, three sparkles popping on its shoulder. It sits
 * between the corner tab and the top-right stack, above the highest the
 * slide copy can rise, so it never covers the headline, and far above the
 * check-in wave, so it never covers a name (src/lib/overlayFit.js OVERLAY).
 *
 * The plate says what kind of moment it is:
 *   - a club's own milestone, or one child's Nth night: the club's colour,
 *     carrying the club's white wordmark (#332; the events e2e pins it);
 *   - the room's attendance (the doors opening, a night threshold, the
 *     every-Nth tally): the kit's one hot colour, the catalog's "this is
 *     special";
 *   - handbook progress (books, awards): Awana blue, so "10 books" reads
 *     apart from "100 kids" at a glance.
 * On a seasonal night the room-wide plates wear the skin (an echo of the
 * plate in --skin-a behind it, sparkles in --skin-b; app.css), and a club's
 * plate keeps the club's colours, the same rule the confetti follows.
 *
 * The line is fitted to the band by measurement (toastFit): one line from
 * 3.2u down to 2.1u, then the two most balanced lines, sized so the plate still
 * ends where the band ends; a first name too long even for that wraps
 * inside the band rather than running out of it. `compact` is the band with
 * the flag strip hanging over it.
 *
 * The band is one at a time. With a band notice up (`afterNotice`) the toast
 * holds out of sight until the notice has lifted away, then pops; the notice
 * waits for the toast's exit in turn (NoticeBanner). A critical notice never
 * moves, so on an OBS feed, where it keeps to the band, the toast drops below
 * it (`below`); over the pickup board there is no room below, so App holds
 * the queue and a toast already up steps aside (`yielding`).
 */

// Band geometry for the fit, in u (app.css .milestone-toast carries the same).
const LABEL = 1.45;
const PAD_X = 1.2;
const PAD_Y = 1.2;
const LOGO = 7.4;
// Stage 4b-2 set the line in Galindo (3u down to 2u, two lines 2.2u down to
// 1.4u, at 1.02); Paytone One's caps stand 5.7% shorter at one size, so each
// size is that times 1.057 and the line height 1.02 / 1.057 (app.css
// .milestone-count carries it), which holds the caps and the plate.
export const LINE = { max: 3.2, min: 2.1, twoLineMax: 2.3, twoLineMin: 1.5, lineHeight: 0.97 };
// The plate's out-of-register offset and keyline reach a little past its box.
const PLATE_SPILL = 0.3;

/** The pill's inset under the block, per the kit's chip (brand.js PLATE). */
const INSET = LABEL * 2.05 * 0.73;

/**
 * The line's fit for one toast. Pure and exported for tests: it never lets
 * the plate end below the band's bottom (bandRoom) while the line can still
 * be read at twoLineMin.
 * @param {string} line
 * @param {{ compact?: boolean, logo?: boolean }} [opts]
 */
export function toastFit(line, { compact = false, logo = false } = {}) {
  const width = OVERLAY.band.width - INSET - PAD_X * 2 - (logo ? LOGO + 1 : 0);
  const room = bandRoom(compact) - plateChrome(LABEL) - PAD_Y - PLATE_SPILL;
  const tenth = (/** @type {number} */ v) => Math.floor(v * 10 + 1e-9) / 10;
  return fitShout(line, {
    width,
    max: Math.min(LINE.max, tenth(room / LINE.lineHeight)),
    min: LINE.min,
    twoLineMax: Math.min(LINE.twoLineMax, tenth(room / (2 * LINE.lineHeight))),
    twoLineMin: LINE.twoLineMin,
  });
}

/**
 * The words and the look for one celebration. Pure and exported for tests.
 * @param {any} c the celebration (useCelebrationQueue's current item)
 */
export function toastFor(c) {
  const kind = c.kind;
  const ofClub = kind === 'club' || kind === 'kid';
  const label = kind === 'club' ? c.club
    : kind === 'kid' ? `${c.firstName}’s`
      : c.label ? c.label
        : 'Checked in tonight';
  const line = kind === 'club' ? `${c.count} kids strong!`
    : kind === 'kid' ? `${ordinalNight(c.count)} club night!`
      : c.headline ? c.headline
        : `${c.count} kids!`;
  const className = kind === 'club' ? 'milestone-toast club-milestone'
    : kind === 'night' ? 'milestone-toast night-milestone'
      : kind === 'kid' ? 'milestone-toast kid-milestone'
        // Handbook progress (#358) is a room-wide occasion like a night
        // threshold, in its own colour so the room can tell "ten books"
        // from "a hundred kids".
        : kind === 'books' || kind === 'awards'
          ? `milestone-toast night-milestone handbook-milestone ${kind}-milestone`
          // The night's opening moment (#335).
          : kind === 'first' ? 'milestone-toast first-milestone'
            : 'milestone-toast';
  const tone = ofClub ? 'club' : kind === 'books' || kind === 'awards' ? 'handbook' : 'hot';
  return { label, line, className, tone, big: kind === 'first' || isBigMilestone(c.count) };
}

const SPARKLES = [
  { kind: 'sparkle', x: 'calc(100% - 1.2 * var(--u))', y: 'calc(-1.4 * var(--u))', size: 'calc(2.4 * var(--u))' },
  { kind: 'dot', x: 'calc(100% + 1.1 * var(--u))', y: 'calc(-0.2 * var(--u))', size: 'calc(0.9 * var(--u))' },
  { kind: 'sparkleX', x: 'calc(100% + 0.5 * var(--u))', y: 'calc(1.6 * var(--u))', size: 'calc(1.5 * var(--u))', rotate: 12 },
];

/**
 * @param {{
 *   celebration: any,
 *   club: any,
 *   compact?: boolean,
 *   below?: boolean,
 *   yielding?: boolean,
 *   afterNotice?: boolean,
 * }} props
 */
export default function MilestoneToast({ celebration, club, compact = false, below = false, yielding = false, afterNotice = false }) {
  useFontsReady();
  return (
    <AnimatePresence>
      {celebration != null && (
        <Toast
          key={`celebration-${celebration.kind}-${celebration.club ?? ''}-${celebration.firstName ?? ''}-${celebration.count}`}
          celebration={celebration}
          club={club}
          compact={compact}
          below={below}
          yielding={yielding}
          afterNotice={afterNotice}
        />
      )}
    </AnimatePresence>
  );
}

const FROM = { opacity: 0, y: '-35%', scale: 0.85 };
const TO = { opacity: 1, y: '0%', scale: 1 };
const AWAY = { opacity: 0, y: '-30%', scale: 0.96, transition: { duration: DUR.exit, ease: EASE.exit } };

function Toast({ celebration, club, compact, below, yielding, afterNotice }) {
  const t = toastFor(celebration);
  const logo = t.tone === 'club' && club?.logo;
  const fit = toastFit(t.line, { compact: compact && !below, logo: Boolean(logo) });
  // The beat sheet is fixed when the toast appears: with a band notice up
  // it waits out the notice's exit, so the two never share the band.
  const [beat] = useState(() => {
    const hold = afterNotice ? DUR.exit : 0;
    return {
      hold,
      plate: holdThenLand(hold, DUR.pop, FROM, TO, EASE.pop),
      line: holdThenLand(hold + beats(1.5), DUR.settle, { opacity: 0, y: '0.35em' }, { opacity: 1, y: '0em' }, EASE.settle),
    };
  });
  const plate = t.tone === 'club' ? (club?.primary || 'var(--brand-orange)')
    : t.tone === 'handbook' ? 'var(--brand-blue)'
      : 'var(--brand-hot)';
  const style = {
    '--toast-line': `calc(${fit.size} * var(--u))`,
    ...(t.tone === 'club' && club ? { '--club-deep': club.deep || 'rgba(3, 4, 4, 0.35)' } : null),
  };
  const lines = fit.lines.length > 1 && fit.fits;
  return (
    <M.div
      className={`${t.className} milestone-toast--${t.tone}${t.big ? ' milestone-toast--big' : ''}${below ? ' milestone-toast--below' : ''}${compact && !below ? ' milestone-toast--compact' : ''}`}
      style={style}
      initial={beat.plate.initial}
      animate={yielding ? AWAY : { ...beat.plate.animate, transition: beat.plate.transition }}
      exit={AWAY}
    >
      <StepPlate
        label={t.label}
        plate={plate}
        labelClassName="milestone-label"
        bodyClassName="milestone-body"
      >
        {/* The club's own wordmark. `rawName` is deliberately NOT passed: an
            unknown club would otherwise render ClubBadge's title pill,
            duplicating the label. The wrapper supplies the variant
            orchestration ClubBadge's own variants expect. */}
        {logo && (
          <M.span className="milestone-badge" initial="hidden" animate="show">
            <ClubBadge club={club} />
          </M.span>
        )}
        <M.span
          className={`milestone-count${lines ? ' milestone-count--two' : ''}${fit.fits ? '' : ' milestone-count--wrap'}`}
          initial={beat.line.initial}
          animate={beat.line.animate}
          transition={beat.line.transition}
        >
          {/* Two lines keep a real space between them, so the toast's text
              still reads as one sentence to anything that reads it. A line
              too long for even two (fits false) is left to wrap. */}
          {lines
            ? fit.lines.map((l, i) => <span key={i} className="milestone-count__line">{i ? ' ' : ''}{l}</span>)
            : t.line}
        </M.span>
      </StepPlate>
      <DoodleCluster className="milestone-doodles" items={SPARKLES} color="var(--toast-doodle, #fff)" delay={beat.hold + beats(3)} twinkle />
    </M.div>
  );
}
