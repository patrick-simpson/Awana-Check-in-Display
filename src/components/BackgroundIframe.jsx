// SharePoint/OneDrive "view document" URLs (Doc.aspx) refuse to render
// inside third-party iframes unless `action=embedview` is present. A
// novice who pastes the plain file URL sees a blank frame with no
// error, so auto-upgrade the URL here.
//
// wdSlideShowDelay=5 tells Office Online to advance slides every 5 seconds.
// OneDrive's embed dialog sets wdSlideShowDelay=0 when "no auto-advance" is
// chosen, so we must replace any existing value, not merely append when absent.
//
// Personal OneDrive embed URLs also need em=2 to activate slideshow mode;
// without it the viewer just shows the static document.
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

  // Force 5-second auto-advance, replacing any existing value (including 0,
  // which OneDrive's embed dialog uses for "no auto-advance").
  if (/[?&]wdSlideShowDelay=/i.test(url)) {
    url = url.replace(/([?&]wdSlideShowDelay=)[^&]*/i, '$15');
  } else {
    url += (url.includes('?') ? '&' : '?') + 'wdSlideShowDelay=5';
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
  return (
    <iframe
      className="background-iframe"
      src={normalizeEmbedUrl(url)}
      title="Awana background presentation"
      allow="autoplay; fullscreen"
      allowFullScreen
      frameBorder="0"
    />
  );
}
