import { M } from '../lib/motion.jsx';
import PptxSlideshow from './PptxSlideshow.jsx';
import ManualSlideshow from './ManualSlideshow.jsx';
import CatalogScene from './CatalogScene.jsx';

const OFFICE_URL = /onedrive\.live\.com|1drv\.ms|sharepoint\.com|officeapps\.live\.com/i;

// SharePoint/OneDrive "view document" URLs (Doc.aspx) refuse to render
// inside third-party iframes unless `action=embedview` is present. A
// novice who pastes the plain file URL sees a blank frame with no
// error, so auto-upgrade the URL here.
//
// Personal OneDrive embed URLs need em=2 to activate slideshow mode;
// without it the viewer just shows a static document.
//
// wdSlideShowDelay (milliseconds) tells Office Online how long each
// slide stays up; 0 means "use the presentation's own timings".
// Without the parameter, OneDrive embeds sit on the first slide forever.
export function normalizeEmbedUrl(url, slideshowDelaySec = 5) {
  if (!url) return url;

  // When users copy the src from an <iframe src="..."> HTML snippet, the &
  // separators are HTML-escaped as &amp;. Decode them so they work as a real URL.
  url = url.replace(/&amp;/gi, '&');

  // Only Office Online viewers understand the parameters below.
  if (!OFFICE_URL.test(url)) return url;

  const sep = () => (url.includes('?') ? '&' : '?');

  // SharePoint Doc.aspx: must have action=embedview to load in an iframe
  if (/\/Doc\.aspx\?/i.test(url) && !/[?&]action=embedview\b/i.test(url)) {
    url += sep() + 'action=embedview';
  }

  // Personal OneDrive: em=2 activates slideshow/embed mode
  if (/onedrive\.live\.com/i.test(url) && !/[?&]em=/i.test(url)) {
    url += sep() + 'em=2';
  }

  if (!/[?&]wdSlideShowDelay=/i.test(url)) {
    const sec = Number(slideshowDelaySec);
    const delayMs = Number.isFinite(sec) && sec >= 0 ? Math.round(sec * 1000) : 5000;
    url += sep() + `wdSlideShowDelay=${delayMs}`;
  }

  return url;
}

// OneDrive URLs that point at a PowerPoint file, which the experimental
// local slideshow knows how to download and parse.
function isOneDrivePptx(url) {
  if (!url) return false;
  return /onedrive|1drv\.ms/i.test(url) && /\.pptx|\/p\/|presentation/i.test(url);
}

export default function BackgroundIframe({
  url, slideshowDelaySec, useLocalSlideshow, backgroundSource, manualSlides,
  calendarSlides,
  // The season's scene theme, and the weather's atmosphere modifier over it.
  // Both default to today's behaviour so an unthemed install looks unchanged.
  sceneTheme = 'sky', cozy = false, dim = 1,
  // Skips CatalogScene's continuous ambient animation work (orbs, twinkling
  // doodles, the SVG wave) — not just freezing their CSS transforms the way
  // config.reduceMotion's framer-motion wiring does, but avoiding the
  // ongoing JS/paint cost entirely, for weak/kiosk hardware.
  reduceMotion = false,
}) {
  // Uploaded .pptx deck rendered locally (Settings → Background →
  // "Uploaded PowerPoint"). Whole-deck failure falls back to the URL
  // embed when one is configured, else the placeholder scene.
  if (backgroundSource === 'pptx') {
    const pptxFallback = url ? (
      <iframe
        className="background-iframe"
        src={normalizeEmbedUrl(url, slideshowDelaySec)}
        title="Awana background presentation"
        allow="autoplay; fullscreen"
        allowFullScreen
        frameBorder="0"
      />
    ) : (
      <div className="background-placeholder">
        <CatalogScene theme={sceneTheme} still={reduceMotion} cozy={cozy} dim={dim}>
          <div className="placeholder-copy">
            <span className="placeholder-eyebrow">Awana Clubs</span>
            <h1>Upload a PowerPoint<br />in Settings</h1>
          </div>
        </CatalogScene>
      </div>
    );
    return <PptxSlideshow source="store" slideshowDelaySec={slideshowDelaySec} fallback={pptxFallback} />;
  }

  // Typed slides: free-typed in the on-screen editor, no PowerPoint.
  // Calendar-derived slides (welcome / next week / nights remaining)
  // lead the rotation; they are generated fresh each render and never
  // stored.
  if (backgroundSource === 'manual') {
    const deck = [...(calendarSlides || []), ...(manualSlides || [])];
    if (deck.length) {
      return (
        <ManualSlideshow slides={deck} slideshowDelaySec={slideshowDelaySec} />
      );
    }
  }

  // Manual source with nothing typed yet — or no PowerPoint URL — shows
  // the friendly setup placeholder, so the screen is never blank.
  if (backgroundSource === 'manual' || !url) {
    return (
      <div className="background-placeholder">
        <CatalogScene theme={sceneTheme} still={reduceMotion} cozy={cozy} dim={dim}>
          <div className="placeholder-copy">
            {/* Gentle shimmer + breath keep the welcome screen feeling
                alive between check-ins; both loops are subtle enough to
                read as "glow", not "blink". */}
            <M.span
              className="placeholder-eyebrow"
              animate={{ opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              Awana Clubs
            </M.span>
            <M.h1
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              Welcome<br />to Club Night!
            </M.h1>
          </div>
        </CatalogScene>
      </div>
    );
  }

  const embed = (
    <iframe
      className="background-iframe"
      src={normalizeEmbedUrl(url, slideshowDelaySec)}
      title="Awana background presentation"
      allow="autoplay; fullscreen"
      allowFullScreen
      frameBorder="0"
    />
  );

  // The local PPTX slideshow is experimental and opt-in; if it can't
  // download or parse the deck it falls back to the iframe embed so the
  // signage screen never shows an error.
  if (useLocalSlideshow && isOneDrivePptx(url)) {
    return <PptxSlideshow url={url} source="url" slideshowDelaySec={slideshowDelaySec} fallback={embed} />;
  }

  return embed;
}
