import { M } from '../lib/motion.jsx';
import { DUR, EASE, SHAPES, beats } from '../lib/brand.js';
import { getClubPalette } from '../lib/clubs.js';
import { OVERLAY, fitBoard } from '../lib/overlayFit.js';
import { useFontsReady } from '../hooks/useFontsReady.js';
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
//
// The look (rebrand stage 4b-2) is the kit's card, the printer dashboard's:
// a white card with a hard offset shadow and a wavy corner tab carrying its
// title, each name a chip in its club's colour, the count in Galindo. WHERE it
// goes is src/lib/overlayFit.js boardPlacement, handed in as `placement`:
//
//  - 'centre' while it is the room's focus (a live list during pickup time):
//    it takes the middle of the room and the slide copy steps back behind it
//    (App's `board-up` stage class), as it does for a name. Reserving room for
//    up to sixty names would shrink every slide all evening.
//  - 'foot' the rest of the time it is on (a stale or empty board, or an
//    "always" board while the program is running): a one-line card at the
//    foot, beside the slides, which keep playing. It says the same things,
//    in the same words; a live list there is its count line, because a
//    partial list must never pass for the whole one, and the names are for
//    pickup, when the board comes back to the middle.

// The name chips' fit, in u: the card's inner width (70u less 2 x 2.2u of
// padding), and the height left in the centre region after the tab (4.7u),
// the foot (~3.9u) and the bottom padding (1.6u) (app.css).
const NAMES = { width: OVERLAY.centre.width - 4.6, height: OVERLAY.centre.bottom - OVERLAY.centre.top - 10.4, max: 2.1, min: 1.05 };

/**
 * @param {object} props
 * @param {{state: string, reason?: string, ageMin?: number}} props.decision
 * @param {{entries: {firstName: string, club: string}[], printed?: number}|null} props.checkout
 * @param {boolean} [props.calm] Panic/simplified mode — no entrance animation.
 *   OS-level reduced-motion is already handled globally by App's
 *   <MotionConfig reducedMotion="user">, so this only covers the operator's own
 *   "simplified mode" switch.
 * @param {'centre' | 'foot'} [props.placement] where it goes (boardPlacement)
 */
export default function CheckoutBoard({ decision, checkout, calm, placement = 'centre' }) {
  useFontsReady();
  const state = decision?.state;
  if (state !== BOARD_NAMES && state !== BOARD_ANONYMOUS
      && state !== BOARD_EMPTY && state !== BOARD_STALE) {
    return null;
  }

  const foot = placement === 'foot';
  const entries = checkout?.entries || [];
  const listed = state === BOARD_NAMES && !foot;
  const groups = listed ? groupByClub(entries) : [];
  const count = entries.length;
  const fit = listed ? fitBoard(groups, NAMES) : null;

  const anim = calm
    ? {}
    : {
        initial: { opacity: 0, y: '6%', scale: 0.96 },
        animate: { opacity: 1, y: '0%', scale: 1 },
        transition: { duration: DUR.settle, ease: EASE.settle },
      };

  return (
    // Keyed on the placement, so moving between the foot and the middle
    // lands the card afresh rather than sliding it across the slide.
    <div key={placement} className={`checkout-region${foot ? ' checkout-region--foot' : ''}`}>
      <M.section
        className={`checkout-board ${state}${foot ? ' checkout-board--foot' : ''}`}
        aria-live="polite"
        style={fit ? { '--name-size': `calc(${fit.size} * var(--u))` } : undefined}
        {...anim}
      >
        <div className="checkout-tab">
          <svg viewBox={SHAPES.tab.viewBox} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d={SHAPES.tab.d} fill="currentColor" />
          </svg>
          <h2 className="checkout-title">Still to be picked up</h2>
        </div>

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

        {listed && (
          <ul className="checkout-clubs">
            {/* One run of chips per club, each name in its club's colour so
                the board speaks the same colour-coding as the banners; the
                rows ease in a beat apart. Quiet, no springs: this is a
                reference list a volunteer scans, not a celebration. */}
            {groups.map((g, i) => {
              const club = getClubPalette(g.club);
              return (
                <M.li
                  key={g.club}
                  className="checkout-club"
                  style={{ '--club': club.primary, '--club-deep': club.deep || club.primary }}
                  initial={calm ? false : { opacity: 0, y: '0.5em' }}
                  animate={{ opacity: 1, y: '0em' }}
                  transition={{ duration: DUR.settle, delay: beats(1 + i * 0.7), ease: EASE.settle }}
                >
                  <span className="checkout-club-name">{g.club}</span>
                  <span className="checkout-names">
                    {g.names.map((name, j) => (
                      // A real separator between chips, so the list still
                      // reads (and copies) as "Demo Kid · Sample Star".
                      <span key={`${name}-${j}`} className="checkout-name">
                        {j ? <span className="checkout-sep"> · </span> : null}
                        <span className="checkout-name__chip">{name}</span>
                      </span>
                    ))}
                  </span>
                </M.li>
              );
            })}
          </ul>
        )}

        {state === BOARD_NAMES && (
          <p className="checkout-foot">
            {/* "not checked out yet", never "still in the building" — the data
                cannot support the stronger claim, and the weaker one is what a
                volunteer needs to act on anyway. */}
            <span className="checkout-count">{count}</span> not checked out yet
            {typeof checkout?.printed === 'number' && ` · ${checkout.printed} labels printed tonight`}
            {decision.ageMin > 1 && ` · updated ${decision.ageMin} min ago`}
          </p>
        )}
      </M.section>
    </div>
  );
}
