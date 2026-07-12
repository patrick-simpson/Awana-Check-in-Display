import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CatalogScene from './CatalogScene.jsx';
import { resolveTheme, slideSizeClass, slideDurationMs } from '../lib/slides.js';

/**
 * Plays the user's typed slides full-screen behind the check-in
 * banners — the no-PowerPoint background option. Same layering as the
 * setup placeholder (z-index 0), so banners and confetti stack above.
 */
export default function ManualSlideshow({ slides, slideshowDelaySec }) {
  const [index, setIndex] = useState(0);

  // The deck can shrink mid-show (editor save); keep the index valid
  // without waiting for the next timer tick.
  const safe = slides.length ? index % slides.length : 0;

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = setTimeout(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, slideDurationMs(slides[safe], slideshowDelaySec));
    return () => clearTimeout(timer);
  }, [slides, safe, slideshowDelaySec]);

  if (!slides.length) return null;
  const slide = slides[safe];

  return (
    <div className="manual-slideshow">
      {/* mode="sync" crossfades: the outgoing slide fades while the next
          fades in. Opacity-only, so it survives reducedMotion="user". */}
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={slide.id}
          className="manual-slide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        >
          <CatalogScene theme={resolveTheme(slide, safe)}>
            <div className="manual-slide-copy">
              {slide.eyebrow ? <span className="manual-slide-eyebrow">{slide.eyebrow}</span> : null}
              <p className={`manual-slide-text ${slideSizeClass(slide.text)}`}>{slide.text}</p>
            </div>
          </CatalogScene>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
