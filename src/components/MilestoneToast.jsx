import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import { DUR, EASE, beats } from '../lib/brand.js';
import { isBigMilestone, ordinalNight } from '../lib/milestones.js';
import { OVERLAY, fitShout } from '../lib/overlayFit.js';
import { useFontsReady } from '../hooks/useFontsReady.js';
import StepPlate from './brand/StepPlate.jsx';
import DoodleCluster from './brand/DoodleCluster.jsx';
import ClubBadge from './ClubBadge.jsx';

/**
 * One celebration at a time (useCelebrationQueue), as a kit chip in the top
 * band: the catalog's stepped chip with a Londrina kicker on its pill and a
 * Galindo line on its block, three sparkles popping on its shoulder. It sits
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
 * The line is fitted to the band by measurement (fitShout): one line from
 * 3u down to 2u, then two balanced lines, so a 40-character first name on
 * the doors-open flourish shrinks instead of spilling onto the headline.
 * `compact` is the band with the demo / rehearsal tab hanging over it.
 */

// Band geometry for the fit, in u (app.css .milestone-toast carries the same).
const LABEL = 1.45;
const PAD_X = 1.2;
const LOGO = 7.4;
const LINE = { max: 3, min: 2 };

/** The pill's inset under the block, per the kit's chip (brand.js PLATE). */
const INSET = LABEL * 2.05 * 0.73;

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
 * }} props
 */
export default function MilestoneToast({ celebration, club, compact = false }) {
  useFontsReady();
  return (
    <AnimatePresence>
      {celebration != null && (
        <Toast
          key={`celebration-${celebration.kind}-${celebration.club ?? ''}-${celebration.firstName ?? ''}-${celebration.count}`}
          celebration={celebration}
          club={club}
          compact={compact}
        />
      )}
    </AnimatePresence>
  );
}

function Toast({ celebration, club, compact }) {
  const t = toastFor(celebration);
  const logo = t.tone === 'club' && club?.logo;
  const bandW = OVERLAY.band.width;
  const width = bandW - INSET - PAD_X * 2 - (logo ? LOGO + 1 : 0);
  // With the flag tab hanging over the band there is less height: two
  // lines must come down a size so the pair still ends above the copy.
  const fit = fitShout(t.line, { width, max: LINE.max, min: LINE.min, twoLineMax: compact ? 1.8 : 2.2 });
  const plate = t.tone === 'club' ? (club?.primary || 'var(--brand-orange)')
    : t.tone === 'handbook' ? 'var(--brand-blue)'
      : 'var(--brand-hot)';
  const style = {
    '--toast-line': `calc(${fit.size} * var(--u))`,
    ...(t.tone === 'club' && club ? { '--club-primary': club.primary, '--club-deep': club.deep || 'rgba(3, 4, 4, 0.35)' } : null),
  };
  return (
    <M.div
      className={`${t.className} milestone-toast--${t.tone}${t.big ? ' milestone-toast--big' : ''}`}
      style={style}
      initial={{ opacity: 0, y: '-35%', scale: 0.85 }}
      animate={{ opacity: 1, y: '0%', scale: 1 }}
      exit={{ opacity: 0, y: '-30%', scale: 0.96, transition: { duration: DUR.exit, ease: EASE.exit } }}
      transition={{ duration: DUR.pop, ease: EASE.pop }}
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
          className={`milestone-count${fit.lines.length > 1 ? ' milestone-count--two' : ''}`}
          initial={{ opacity: 0, y: '0.35em' }}
          animate={{ opacity: 1, y: '0em' }}
          transition={{ duration: DUR.settle, delay: beats(1.5), ease: EASE.settle }}
        >
          {/* Two lines keep a real space between them, so the toast's text
              still reads as one sentence to anything that reads it. */}
          {fit.lines.length > 1
            ? fit.lines.map((l, i) => <span key={i} className="milestone-count__line">{i ? ' ' : ''}{l}</span>)
            : t.line}
        </M.span>
      </StepPlate>
      <DoodleCluster className="milestone-doodles" items={SPARKLES} color="var(--toast-doodle, #fff)" delay={beats(3)} twinkle />
    </M.div>
  );
}
