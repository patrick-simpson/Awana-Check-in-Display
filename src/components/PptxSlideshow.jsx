import { useEffect, useState } from 'react';
import { downloadPptx, parsePptx } from '../lib/pptxHandler.js';

/**
 * Experimental: downloads the .pptx from OneDrive and drives slide
 * timing locally. Slide rendering isn't implemented yet, so this is
 * opt-in (config.useLocalSlideshow) and renders `fallback` — normally
 * the Office Online iframe embed — whenever the deck can't be
 * downloaded or parsed, so the signage screen never shows an error.
 */
export default function PptxSlideshow({ url, fallback = null }) {
  // Keyed by URL so switching decks shows "loading" again without any
  // synchronous state resets inside the effect.
  const [result, setResult] = useState({ url: null, status: 'loading', slides: [] });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const blob = await downloadPptx(url);
        const { slides } = await parsePptx(blob);
        if (slides.length === 0) throw new Error('No slides found in presentation');
        if (!cancelled) setResult({ url, status: 'ready', slides });
      } catch (err) {
        console.error('PptxSlideshow falling back to iframe embed:', err);
        if (!cancelled) setResult({ url, status: 'failed', slides: [] });
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  const { status, slides } = result.url === url ? result : { status: 'loading', slides: [] };

  if (status === 'failed') return fallback;

  if (status === 'loading') {
    return (
      <div className="background-iframe" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        Loading presentation…
      </div>
    );
  }

  return <SlideshowView key={url} slides={slides} />;
}

function SlideshowView({ slides }) {
  const [index, setIndex] = useState(0);

  // Auto-advance slides.
  useEffect(() => {
    const duration = slides[index]?.duration || 5000;
    const timer = setTimeout(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [slides, index]);

  const currentSlide = slides[index];

  return (
    <div className="background-iframe" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ color: 'white', fontSize: '24px', marginBottom: '20px' }}>
        Slide {index + 1} of {slides.length}
      </div>
      <div style={{ color: 'white', fontSize: '16px' }}>
        Duration: {(currentSlide.duration / 1000).toFixed(1)}s
      </div>
      <div style={{ marginTop: '30px', color: '#999', fontSize: '12px' }}>
        (Rendering full slides coming soon)
      </div>
    </div>
  );
}
