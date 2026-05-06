// SharePoint/OneDrive "view document" URLs (Doc.aspx) refuse to render
// inside third-party iframes unless `action=embedview` is present. A
// novice who pastes the plain file URL sees a blank frame with no
// error, so auto-upgrade the URL here.
//
// Personal OneDrive embed URLs need em=2 to activate slideshow mode;
// without it the viewer just shows a static document.
//
// wdSlideShowDelay=0 tells Office Online to advance slides using the
// presentation's own built-in timings. Without this parameter, Office
// Online sits on the first slide indefinitely.
function normalizeEmbedUrl(url) {
  if (!url) return url;

  // When users copy the src from an <iframe src="..."> HTML snippet, the &
  // separators are HTML-escaped as &amp;. Decode them so they work as a real URL.
  url = url.replace(/&amp;/gi, '&');

  // SharePoint Doc.aspx: must have action=embedview to load in an iframe
  if (/\/Doc\.aspx\?/i.test(url) && !/[?&]action=embedview\b/i.test(url)) {
    url += (url.includes('?') ? '&' : '?') + 'action=embedview';
  }

  // Personal OneDrive: em=2 activates slideshow/embed mode
  if (/onedrive\.live\.com/i.test(url) && !/[?&]em=/i.test(url)) {
    url += '&em=2';
  }

  // Enable auto-advance using presentation's own timing
  if (!/[?&]wdSlideShowDelay=/i.test(url)) {
    url += (url.includes('?') ? '&' : '?') + 'wdSlideShowDelay=0';
  }

  return url;
}

export default function BackgroundIframe({ url }) {
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
  const normalizedUrl = normalizeEmbedUrl(url);
  console.log('BackgroundIframe normalized URL:', normalizedUrl);
  return (
    <iframe
      className="background-iframe"
      src={normalizedUrl}
      title="Awana background presentation"
      allow="autoplay; fullscreen"
      allowFullScreen
      frameBorder="0"
    />
  );
}
