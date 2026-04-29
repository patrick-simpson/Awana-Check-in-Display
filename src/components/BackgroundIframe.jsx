// SharePoint/OneDrive "view document" URLs (Doc.aspx) refuse to render
// inside third-party iframes unless `action=embedview` is present. A
// novice who pastes the plain file URL sees a blank frame with no
// error, so auto-upgrade the URL here.
//
// wdSlideShowDelay=0 tells Office Online to advance slides using the
// presentation's own built-in timings. Without it the viewer sits on
// slide 1 forever even when the .pptx has timings set.
function normalizeEmbedUrl(url) {
  if (!url) return url;

  // SharePoint Doc.aspx: must have action=embedview to load in an iframe
  if (/\/Doc\.aspx\?/i.test(url) && !/[?&]action=embedview\b/i.test(url)) {
    url = url + (url.includes('?') ? '&' : '?') + 'action=embedview';
  }

  // All Office Online embed URLs: add wdSlideShowDelay=0 so the deck
  // auto-advances with its built-in per-slide timings.
  if (!/[?&]wdSlideShowDelay=/i.test(url)) {
    url = url + '&wdSlideShowDelay=0';
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
