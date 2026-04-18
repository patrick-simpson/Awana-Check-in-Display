// SharePoint/OneDrive "view document" URLs (Doc.aspx) refuse to render
// inside third-party iframes unless `action=embedview` is present. A
// novice who pastes the plain file URL sees a blank frame with no
// error, so auto-upgrade the URL here.
function normalizeEmbedUrl(url) {
  if (!/\/Doc\.aspx\?/i.test(url)) return url;
  if (/[?&]action=embedview\b/i.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'action=embedview';
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
