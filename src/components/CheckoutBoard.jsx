import { M } from '../lib/motion.jsx';
import { getClubPalette } from '../lib/clubs.js';
import {
  BOARD_ANONYMOUS,
  BOARD_EMPTY,
  BOARD_NAMES,
  BOARD_STALE,
  groupByClub,
} from '../lib/checkoutBoard.js';

// Who is still waiting to be picked up.
//
// All of the "should this be visible at all" judgement lives in
// src/lib/checkoutBoard.js as a pure, heavily-tested function — this component
// only renders the decision it is handed. That split is deliberate: the
// visibility rules are the safety-relevant part of this feature, and they should
// not be tangled up with JSX.
//
// The wording here matters as much as the logic. The list comes from whether
// volunteers PERFORMED checkout in TwoTimTwo, not from whether children actually
// left, so it can be freshly and confidently wrong during a pickup rush. Every
// string below is chosen so a volunteer reads it as "who has not been checked
// out yet" and never as "the building is clear" — because acting on the second
// meaning when the first is what we know is how a child gets left behind.

/**
 * @param {object} props
 * @param {{state: string, reason?: string, ageMin?: number}} props.decision
 * @param {{entries: {firstName: string, club: string}[], printed?: number}|null} props.checkout
 * @param {boolean} [props.calm] Panic/simplified mode — no entrance animation.
 *   OS-level reduced-motion is already handled globally by App's
 *   <MotionConfig reducedMotion="user">, so this only covers the operator's own
 *   "simplified mode" switch.
 */
export default function CheckoutBoard({ decision, checkout, calm }) {
  const state = decision?.state;
  if (state !== BOARD_NAMES && state !== BOARD_ANONYMOUS
      && state !== BOARD_EMPTY && state !== BOARD_STALE) {
    return null;
  }

  const entries = checkout?.entries || [];
  const groups = state === BOARD_NAMES ? groupByClub(entries) : [];
  const count = entries.length;

  const anim = calm
    ? {}
    : {
        initial: { opacity: 0, y: 16, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { type: 'spring', stiffness: 260, damping: 24 },
      };

  return (
    <M.section className={`checkout-board ${state}`} aria-live="polite" {...anim}>
      <h2 className="checkout-title">Still to be picked up</h2>

      {state === BOARD_EMPTY && (
        <p className="checkout-line good">
          Everyone has been checked out. Thanks for a great night!
        </p>
      )}

      {state === BOARD_ANONYMOUS && (
        // Deliberately no names and no exact number. At this point in the
        // evening a count of one or two, on a public wall, is a statement about
        // specific unattended children — and their first names were already on
        // this same screen earlier tonight.
        <p className="checkout-line">
          Almost everyone has been picked up. Please see the check-in desk.
        </p>
      )}

      {state === BOARD_STALE && (
        <p className="checkout-line warn">
          This list stopped updating about {decision.ageMin} min ago
          {' '}— please check with the check-in desk rather than relying on it.
        </p>
      )}

      {state === BOARD_NAMES && (
        <>
          <ul className="checkout-clubs">
            {/* Each club row eases in on a slight stagger — quiet, no
                springs: this is a reference list a volunteer scans, not a
                celebration. Club labels take the palette's pale accent so
                the board speaks the same color-coding as the banners. */}
            {groups.map((g, i) => (
              <M.li
                key={g.club}
                className="checkout-club"
                style={{ '--club-accent': getClubPalette(g.club).accent }}
                initial={calm ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 + i * 0.07, ease: 'easeOut' }}
              >
                <span className="checkout-club-name">{g.club}</span>
                <span className="checkout-names">{g.names.join(' · ')}</span>
              </M.li>
            ))}
          </ul>
          <p className="checkout-foot">
            {/* "not checked out yet", never "still in the building" — the data
                cannot support the stronger claim, and the weaker one is what a
                volunteer needs to act on anyway. */}
            {count} not checked out yet
            {typeof checkout?.printed === 'number' && ` · ${checkout.printed} labels printed tonight`}
            {decision.ageMin > 1 && ` · updated ${decision.ageMin} min ago`}
          </p>
        </>
      )}
    </M.section>
  );
}
