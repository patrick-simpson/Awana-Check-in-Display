import PptxSlideshow from './PptxSlideshow.jsx';

// Detect if URL is a OneDrive presentation URL
function isOneDrivePptx(url) {
  if (!url) return false;
  // Match OneDrive URLs with .pptx
  return /onedrive|1drv\.ms/i.test(url) && /\.pptx|\/p\/|presentation/i.test(url);
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

  // Use local slideshow for OneDrive PPTX
  if (isOneDrivePptx(url)) {
    return (
      <div className="background-iframe">
        <PptxSlideshow url={url} />
      </div>
    );
  }

  // Fallback to iframe for other content (SharePoint, etc.)
  return (
    <iframe
      className="background-iframe"
      src={url}
      title="Awana background presentation"
      allow="autoplay; fullscreen"
      allowFullScreen
      frameBorder="0"
    />
  );
}
