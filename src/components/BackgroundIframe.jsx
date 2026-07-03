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
        {/* Catalog-style doodles drifting in the sky. */}
        <svg className="placeholder-doodles" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.75">
            <path d="M120 180 C160 120 210 120 250 170" />
            <path d="M1370 210 C1400 170 1450 170 1480 205" />
            <path d="M240 640 l0 0 M260 660" />
            <circle cx="1300" cy="520" r="14" />
            <circle cx="340" cy="120" r="6" fill="#ffffff" stroke="none" />
            <circle cx="1180" cy="130" r="7" fill="#ffffff" stroke="none" />
            <path d="M1445 420 l26 26 M1471 420 l-26 26" strokeWidth="6" />
            <path d="M180 430 l22 22 M202 430 l-22 22" strokeWidth="5" />
          </g>
          <g fill="#ffffff" opacity="0.9">
            <path d="M480 100 c3 18 13 28 31 31 c-18 3 -28 13 -31 31 c-3 -18 -13 -28 -31 -31 c18 -3 28 -13 31 -31z" />
            <path d="M1120 620 c4 22 16 34 38 38 c-22 4 -34 16 -38 38 c-4 -22 -16 -34 -38 -38 c22 -4 34 -16 38 -38z" />
            <path d="M200 760 c2.5 15 11 23.5 26 26 c-15 2.5 -23.5 11 -26 26 c-2.5 -15 -11 -23.5 -26 -26 c15 -2.5 23.5 -11 26 -26z" />
            <path d="M1490 700 c3 18 13 28 31 31 c-18 3 -28 13 -31 31 c-3 -18 -13 -28 -31 -31 c18 -3 28 -13 31 -31z" />
          </g>
        </svg>

        <div className="placeholder-copy">
          <span className="placeholder-eyebrow">Awana Clubs</span>
          <h1>Welcome<br />to Club Night!</h1>
        </div>

        {/* The big orange catalog wave along the bottom. */}
        <svg className="placeholder-wave" viewBox="0 0 1600 420" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="awanaWave" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFB81C" />
              <stop offset="1" stopColor="#F26B21" />
            </linearGradient>
          </defs>
          <path
            fill="url(#awanaWave)"
            d="M0 190 C220 80 420 80 640 160 C880 250 1120 250 1330 150 C1430 105 1530 100 1600 130 L1600 420 L0 420 Z"
          />
        </svg>

        <div className="placeholder-hint">
          Add your looping PowerPoint in <strong>Settings</strong> (gear, bottom-left) — check-in banners work either way.
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
