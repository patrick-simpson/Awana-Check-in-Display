import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import { DUR, EASE } from '../lib/brand.js';
import { isFresh } from '../lib/freshness.js';
import { NOTICE_MAX_AGE_MS } from '../lib/constants.js';
import { OVERLAY, fitParagraph } from '../lib/overlayFit.js';
import { useFontsReady } from '../hooks/useFontsReady.js';
import StepPlate from './brand/StepPlate.jsx';

// Same coarse cadence as TonightTicker — expiry is measured in hours,
// so a 30s re-check is more than fine-grained enough.
const FRESHNESS_CHECK_MS = 30000;

const EYEBROW = { critical: 'Attention', warn: 'Notice', info: 'FYI' };

// The fit, in u (app.css sizes the plate to match). A band notice reads in
// Figtree at up to 2.1u over at most two lines of the band; the takeover
// card shouts Figtree 800 at up to 4.6u over three lines of the centre.
const BAND = { label: 1.25, padX: 1.1, max: 2.1, compactMax: 1.7, min: 1.3, maxLines: 2 };
const TAKEOVER = { label: 2, padX: 2, max: 4.6, min: 2.2, maxLines: 3 };
const inset = (label) => label * 2.05 * 0.73;

/** The message size for a level, by measurement. Pure and exported for tests. */
export function noticeFit(level, message, compact = false) {
  if (level === 'critical') {
    const width = OVERLAY.centre.width - inset(TAKEOVER.label) - TAKEOVER.padX * 2;
    return fitParagraph(message, { width, max: TAKEOVER.max, min: TAKEOVER.min, maxLines: TAKEOVER.maxLines, face: 'read' });
  }
  const width = OVERLAY.band.width - inset(BAND.label) - BAND.padX * 2;
  return fitParagraph(message, { width, max: compact ? BAND.compactMax : BAND.max, min: BAND.min, maxLines: BAND.maxLines, face: 'body' });
}

/**
 * Church-authored announcement banner for the `onNotice` broadcast
 * ('info' | 'warn' | 'critical'). One component, three weights, so the
 * severity is always rendered consistently instead of leaving each
 * caller to reinvent "how urgent does this look". All three are the kit's
 * stepped chip (the corner chips' shape, StepPlate): a Londrina label on the
 * pill ("FYI", "NOTICE", "ATTENTION"), the message in Figtree on the block.
 *
 *   - info / warn — in the top band, between the corner tab and the
 *     top-right stack and above the highest the slide copy can rise (see
 *     src/lib/overlayFit.js OVERLAY), so it never sits on the tab, the
 *     stack or the headline at any screen shape. Info is the quiet
 *     charcoal chip; warn is sunflower. A milestone toast borrows the band
 *     while it is up (`yielding`): the notice lifts out of the way and
 *     comes back when the toast has gone, one at a time.
 *   - critical — a takeover: the hot chip, big, in the middle of the room,
 *     and the slide copy steps back behind it (App sets the stage class) the
 *     way it does for a name. At the app's highest z-index, above even an
 *     active check-in: "CLUB CANCELLED TONIGHT" must never lose the fight
 *     with a birthday banner for a parent's attention. On an OBS overlay
 *     feed (no slide behind it) it sits in the top band instead.
 *
 * `message` is bounded plain text by the sanitizer (src/lib/eventSanitizers.js)
 * before it ever reaches this component, but it is rendered here as an
 * ordinary React text child — never `dangerouslySetInnerHTML` — so the
 * render path itself can't reopen a markup-injection hole even if a
 * future change to the sanitizer slipped. Its size comes from measuring it
 * (noticeFit), so the 200-character maximum steps down instead of spilling.
 *
 * Expires on its own after NOTICE_MAX_AGE_MS so a forgotten cancellation
 * notice can't haunt the screen into next week's club night.
 *
 * @param {{ notice: any, yielding?: boolean, compact?: boolean }} props
 */
export default function NoticeBanner({ notice, yielding = false, compact = false }) {
  useFontsReady();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), FRESHNESS_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  const show = Boolean(notice?.message) && isFresh(notice?.at, NOTICE_MAX_AGE_MS, now);
  const level = show ? notice.level : null;
  const critical = level === 'critical';
  const fit = show ? noticeFit(level, notice.message, compact) : null;
  // Only a band notice ever steps aside; a critical one never yields.
  const away = yielding && !critical;

  return (
    <AnimatePresence>
      {show && (
        <M.div
          key={`${notice.at}-${notice.level}`}
          className={`notice-banner notice-banner--${level}${away ? ' is-yielding' : ''}`}
          role={critical ? 'alert' : 'status'}
          aria-live={critical ? 'assertive' : 'polite'}
          style={{ '--notice-size': `calc(${fit.size} * var(--u))` }}
          initial={{ opacity: 0, y: critical ? '8%' : '-40%', scale: critical ? 0.92 : 1 }}
          // Out of the toast's way, and back as it leaves: the two cross over
          // in the band the way the corner chips do.
          animate={away
            ? { opacity: 0, y: '-60%', scale: 1, transition: { duration: DUR.exit, ease: EASE.exit } }
            : { opacity: 1, y: '0%', scale: 1, transition: { duration: DUR.pop, ease: EASE.pop } }}
          exit={{ opacity: 0, y: '-30%', transition: { duration: DUR.exit, ease: EASE.exit } }}
        >
          <StepPlate
            label={EYEBROW[level]}
            labelClassName="notice-banner-eyebrow"
            bodyClassName="notice-banner-body"
            plate={critical ? 'var(--brand-hot)' : level === 'warn' ? 'var(--brand-sun)' : undefined}
          >
            {/* The measured lines, set unbroken so the plate hugs the longest
                (like a stepped chip built around its own text); a word too
                wide for any line hands the wrapping back to the browser.
                Each line is a text child: a space between them keeps the
                message reading as one sentence. */}
            <span className={`notice-banner-message${fit.hug ? ' is-set' : ''}`}>
              {fit.hug
                ? fit.text.map((line, i) => <span key={i} className="notice-banner-line">{i ? ' ' : ''}{line}</span>)
                : notice.message}
            </span>
          </StepPlate>
        </M.div>
      )}
    </AnimatePresence>
  );
}
