import PptxSlideshow from './PptxSlideshow.jsx';

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

export default function BackgroundIframe({ url, slideshowDelaySec, useLocalSlideshow }) {
  if (!url) {
    return (
      <div className="background-placeholder">
        <div className="placeholder-card">
          <h1>Awana Welcome Screen</h1>
          <p>
            Your PowerPoint will appear here once you paste a OneDrive embed URL.
            <br />
            Open <code>Settings</code> (gear, bottom-left) or edit <code>src/config.js</code>.
          </p>
        </div>
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
    return <PptxSlideshow url={url} fallback={embed} />;
  }

  return embed;
}
