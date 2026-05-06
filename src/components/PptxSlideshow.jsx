import { useEffect, useState } from 'react';
import { downloadPptx, parsePptx } from '../lib/pptxHandler.js';

export default function PptxSlideshow({ url }) {
  const [slides, setSlides] = useState([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Download and parse PPTX on mount or when URL changes
  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Downloading PPTX from:', url);
        const blob = await downloadPptx(url);
        console.log('Downloaded, parsing...');

        const { slides: parsedSlides } = await parsePptx(blob);
        console.log('Parsed slides:', parsedSlides.length);

        setSlides(parsedSlides);
        setCurrentSlideIndex(0);
      } catch (err) {
        console.error('Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [url]);

  // Auto-advance slides
  useEffect(() => {
    if (slides.length === 0) return;

    const currentSlide = slides[currentSlideIndex];
    const duration = currentSlide.duration || 5000;

    const timer = setTimeout(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [slides, currentSlideIndex]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
        Loading presentation...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
        No slides found
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ color: 'white', fontSize: '24px', marginBottom: '20px' }}>
        Slide {currentSlideIndex + 1} of {slides.length}
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
