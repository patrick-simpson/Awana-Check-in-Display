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
      src={url}
      title="Awana background presentation"
      allow="autoplay; fullscreen"
      allowFullScreen
      frameBorder="0"
    />
  );
}
