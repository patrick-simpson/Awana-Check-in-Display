import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import { DUR, EASE } from '../lib/brand.js';
import CatalogScene from './CatalogScene.jsx';
import Wave from './brand/Wave.jsx';
import PromoSlide from './PromoSlide.jsx';
import { isPromoSlide } from '../lib/promos.js';
import {
  holdsCheckIns,
  isVideoSlide,
  resolveTheme,
  resolveSizeClass,
  slideDurationMs,
  videoSlideTimerMs,
} from '../lib/slides.js';
import { getVideo } from '../lib/videoStore.js';

// If a video can't load (blob missing on this device, decode error,
// IndexedDB blocked) the show skips ahead after this long instead of
// wedging on a black screen.
export const MISSING_VIDEO_SKIP_MS = 4000;

// The stinger: when a transition involves a slide that holds check-ins (a
// promo poster or a marked slide), a full-screen house wave sweeps up over
// the lobby, the slides swap underneath it, and it sweeps on up and away
// (the mockup's "wipe"). Ordinary slide-to-slide handoffs crossfade. The
// swap happens while the wave covers the screen, so the slides' own change
// waits for it.
const STINGER_SEC = DUR.stinger * 2 + 0.08;
// Mid-cover: the wave fills the screen from 47% to 53% of its run.
const SWAP_AT = STINGER_SEC * 0.5;
// Where the stinger travels, as a share of its own height: in from below
// the screen, a hold high enough that the back wave's trough clears the top
// edge (at 0% the crest left a band of the old slide showing across the top
// of the TV while the slides swapped), and out past the top, fills and all.
// The fills run 22% below the box (app.css) so the bottom stays covered at
// the hold.
export const STINGER_Y = ['120%', '-14%', '-14%', '-126%'];
const SLIDE_VARIANTS = {
  enter: { opacity: 0 },
  show: (wipe) => ({
    opacity: 1,
    transition: wipe ? { duration: 0.01, delay: SWAP_AT } : { duration: 0.8, ease: 'easeInOut' },
  }),
  leave: (wipe) => ({
    opacity: 0,
    transition: wipe ? { duration: 0.01, delay: SWAP_AT } : { duration: 0.8, ease: 'easeInOut' },
  }),
};

function Stinger() {
  return (
    <M.div
      className="slide-stinger"
      aria-hidden="true"
      initial={{ y: STINGER_Y[0] }}
      // Ends off the top: the frame ?lowPower=1 jumps to shows nothing.
      animate={{ y: STINGER_Y }}
      transition={{ duration: STINGER_SEC, times: [0, 0.47, 0.53, 1], ease: [EASE.wipe, 'linear', EASE.wipe] }}
    >
      <Wave className="slide-stinger__wave slide-stinger__wave--back" color="var(--brand-sun)" flip />
      <div className="slide-stinger__fill slide-stinger__fill--back" />
      <Wave className="slide-stinger__wave slide-stinger__wave--front" color="var(--brand-orange)" />
      <div className="slide-stinger__fill slide-stinger__fill--front" />
    </M.div>
  );
}

/**
 * Tracks which slide is up and how the lobby got there, captured once per
 * slide (derived state, the CheckInMoment flip-tracking pattern): whether
 * this change wipes (a held slide on either side) and a counter that keys
 * the stinger.
 */
function useSlideTransition(key, special) {
  const [seen, setSeen] = useState({ key, special, wipe: false, wipes: 0 });
  if (seen.key !== key) {
    const wipe = seen.special || special;
    const next = { key, special, wipe, wipes: seen.wipes + (wipe ? 1 : 0) };
    setSeen(next);
    return next;
  }
  return seen;
}

/**
 * Plays the user's typed slides full-screen behind the check-in
 * banners — the no-PowerPoint background option. Same layering as the
 * setup placeholder (z-index 0), so banners and confetti stack above.
 *
 * Video slides play muted (kiosk reloads have no user gesture, and
 * unmuted autoplay is blocked). durationSec 0 = play to the end, then
 * advance; >0 = hold that long with the video looping underneath.
 */
/**
 * `paused`: names are on screen, so the slide on screen keeps its place and
 * its remaining time (the slideshow timer stops, it does not restart).
 * `onSlide({ key, special })`: told on every slide change; `special` is
 * whether that slide holds check-ins. A deck that could never move on to an
 * ordinary slide (one slide, or only held ones) never holds, so a child's
 * moment can never wait forever.
 */
export default function ManualSlideshow({ slides, slideshowDelaySec, clubTint = null, paused = false, onSlide }) {
  // A step counter that only ever goes UP, rather than an index that wraps:
  // the deck position is `step % length` and the LAP is `step / length`, and
  // the promo slot uses the lap to show a different promo each time round
  // (see src/lib/promos.js for why there is only one slot). Deriving both from
  // one number keeps `advance` a pure state updater — incrementing a second
  // piece of state from inside the updater would double-count under React's
  // strict-mode double invocation.
  const [step, setStep] = useState(0);

  // The deck can shrink mid-show (editor save); keep the position valid
  // without waiting for the next timer tick.
  const safe = slides.length ? step % slides.length : 0;
  const lap = slides.length ? Math.floor(step / slides.length) : 0;

  const advance = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const slide = slides[safe];
  // Which promo this lap is showing, resolved ONCE so the hold and the art
  // can never disagree about it.
  const promo = isPromoSlide(slide) && slide.promos?.length
    ? slide.promos[lap % slide.promos.length]
    : null;
  // A NUMBER, not the array: App re-renders on every event and can hand
  // down an equal-but-new deck; keying the timer on the array restarted the
  // hold each time, and the show stalled on one slide through a whole
  // check-in rush. Video slides with no explicit duration have no timer at
  // all — their <video> ended event drives the advance instead.
  //
  // The promo slot holds for THE POSTER IT IS SHOWING: each descriptor
  // carries its own hold (all four showreels run 15 seconds today, but the
  // number belongs to the poster, not the slot). slideDurationMs stays a
  // pure function of one slide; the
  // slideshow just hands it the promo rather than the slot when the promo
  // names its own hold.
  const held = promo?.durationSec != null ? promo : slide;
  const holdMs = slides.length <= 1 || !slide
    ? null
    : isVideoSlide(slide) ? videoSlideTimerMs(slide) : slideDurationMs(held, slideshowDelaySec);

  // Which slide is up, as one key: the step (so the same slide coming round
  // again is a new showing) and its id (so an editor save that swaps what is
  // at this position is too).
  const slideKey = `${step}:${slide?.id ?? ''}`;
  const canHold = slides.length > 1 && slides.some((s) => !holdsCheckIns(s));
  const special = Boolean(slide) && canHold && holdsCheckIns(slide);
  const transition = useSlideTransition(slideKey, special);

  // The hold timer, pausable: time already spent on this slide survives a
  // pause, so names on screen stop the clock instead of resetting it.
  const timing = useRef({ key: '', spent: 0, startedAt: 0 });
  useEffect(() => {
    const t = timing.current;
    if (t.key !== slideKey) {
      t.key = slideKey;
      t.spent = 0;
    }
    if (holdMs == null || paused) return undefined;
    t.startedAt = Date.now();
    const timer = setTimeout(advance, Math.max(0, holdMs - t.spent));
    return () => {
      clearTimeout(timer);
      t.spent += Date.now() - t.startedAt;
    };
  }, [holdMs, slideKey, paused, advance]);

  // A video that ends while names are up waits for them before advancing.
  const pending = useRef(false);
  const pausedNow = useRef(paused);
  useEffect(() => {
    pausedNow.current = paused;
    if (!paused && pending.current) {
      pending.current = false;
      advance();
    }
  }, [paused, advance]);
  const finishVideo = useCallback(() => {
    if (pausedNow.current) pending.current = true;
    else advance();
  }, [advance]);

  useEffect(() => {
    onSlide?.({ key: slideKey, special });
  }, [onSlide, slideKey, special]);
  // Leaving the slideshow (the background switched away) must never leave
  // the lobby holding check-ins.
  useEffect(() => () => onSlide?.({ key: 'none', special: false }), [onSlide]);

  if (!slides.length || !slide) return null;

  return (
    <div className="manual-slideshow">
      {/* mode="sync" crossfades: the outgoing slide fades while the next
          fades in. Opacity-only, so it survives reducedMotion="user". */}
      <AnimatePresence mode="sync" initial={false} custom={transition.wipe}>
        <M.div
          key={slide.id}
          className="manual-slide"
          custom={transition.wipe}
          variants={SLIDE_VARIANTS}
          initial="enter"
          animate="show"
          exit="leave"
        >
          {isVideoSlide(slide) ? (
            <VideoSlide
              slide={slide}
              // A lone video loops forever (nothing to advance to);
              // a timed video loops so it never freezes mid-hold.
              loop={slides.length <= 1 || slide.durationSec > 0}
              onFinished={slides.length > 1 ? finishVideo : undefined}
            />
          ) : isPromoSlide(slide) ? (
            /* One slot, one promo per lap. The key stays `slide.id`, so the
               slot remounts on every visit and each promo's entrance
               animation plays from the top. */
            <PromoSlide promo={promo} />
          ) : (
            <CatalogScene theme={resolveTheme(slide, safe)} clubTint={clubTint}>
              <div className="manual-slide-copy">
                {slide.eyebrow ? <span className="manual-slide-eyebrow">{slide.eyebrow}</span> : null}
                <p className={`manual-slide-text ${resolveSizeClass(slide)}`}>{slide.text}</p>
                {slide.subtext ? <p className="manual-slide-subtext">{slide.subtext}</p> : null}
              </div>
            </CatalogScene>
          )}
        </M.div>
      </AnimatePresence>
      {transition.wipes > 0 && <Stinger key={transition.wipes} />}
    </div>
  );
}

function VideoSlide({ slide, loop, onFinished }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  // Pull the blob out of IndexedDB and hand the <video> an object URL.
  // Created once per mount, revoked on cleanup — AnimatePresence keeps
  // the exiting slide mounted until its fade ends, so the URL stays
  // valid for the whole crossfade.
  useEffect(() => {
    let cancelled = false;
    let url = null;
    getVideo(slide.videoId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setFailed(true);
        return;
      }
      url = URL.createObjectURL(blob);
      setSrc(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [slide.videoId]);

  // Never wedge the rotation on a broken video — skip ahead shortly.
  useEffect(() => {
    if (!failed || !onFinished) return undefined;
    const timer = setTimeout(onFinished, MISSING_VIDEO_SKIP_MS);
    return () => clearTimeout(timer);
  }, [failed, onFinished]);

  return (
    <div className="manual-slide-video-wrap">
      {src && !failed ? (
        <video
          className="manual-slide-video"
          src={src}
          muted
          autoPlay
          playsInline
          loop={loop}
          onEnded={onFinished}
          onError={() => setFailed(true)}
          // Autoplay is allowed because the video is muted, but a
          // rejected play() promise must never surface as an error.
          ref={(el) => { el?.play?.()?.catch?.(() => {}); }}
        />
      ) : (
        <span className="manual-slide-video-missing">
          {failed ? 'Video not available on this device' : ''}
        </span>
      )}
    </div>
  );
}
