import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { M } from '../lib/motion.jsx';
import CatalogScene from './CatalogScene.jsx';
import {
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

/**
 * Plays the user's typed slides full-screen behind the check-in
 * banners — the no-PowerPoint background option. Same layering as the
 * setup placeholder (z-index 0), so banners and confetti stack above.
 *
 * Video slides play muted (kiosk reloads have no user gesture, and
 * unmuted autoplay is blocked). durationSec 0 = play to the end, then
 * advance; >0 = hold that long with the video looping underneath.
 */
export default function ManualSlideshow({ slides, slideshowDelaySec }) {
  const [index, setIndex] = useState(0);

  // The deck can shrink mid-show (editor save); keep the index valid
  // without waiting for the next timer tick.
  const safe = slides.length ? index % slides.length : 0;

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % (slides.length || 1));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const slide = slides[safe];
    // Video slides with no explicit duration have no timer at all —
    // their <video> ended event drives the advance instead.
    const ms = isVideoSlide(slide)
      ? videoSlideTimerMs(slide)
      : slideDurationMs(slide, slideshowDelaySec);
    if (ms == null) return undefined;
    const timer = setTimeout(advance, ms);
    return () => clearTimeout(timer);
  }, [slides, safe, slideshowDelaySec, advance]);

  if (!slides.length) return null;
  const slide = slides[safe];

  return (
    <div className="manual-slideshow">
      {/* mode="sync" crossfades: the outgoing slide fades while the next
          fades in. Opacity-only, so it survives reducedMotion="user". */}
      <AnimatePresence mode="sync" initial={false}>
        <M.div
          key={slide.id}
          className="manual-slide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        >
          {isVideoSlide(slide) ? (
            <VideoSlide
              slide={slide}
              // A lone video loops forever (nothing to advance to);
              // a timed video loops so it never freezes mid-hold.
              loop={slides.length <= 1 || slide.durationSec > 0}
              onFinished={slides.length > 1 ? advance : undefined}
            />
          ) : (
            <CatalogScene theme={resolveTheme(slide, safe)}>
              <div className="manual-slide-copy">
                {slide.eyebrow ? <span className="manual-slide-eyebrow">{slide.eyebrow}</span> : null}
                <p className={`manual-slide-text ${resolveSizeClass(slide)}`}>{slide.text}</p>
                {slide.subtext ? <p className="manual-slide-subtext">{slide.subtext}</p> : null}
              </div>
            </CatalogScene>
          )}
        </M.div>
      </AnimatePresence>
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
