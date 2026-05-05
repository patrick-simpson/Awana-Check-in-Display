import { useEffect, useState } from 'react';
import BackgroundIframe from './components/BackgroundIframe.jsx';
import Overlay from './components/Overlay.jsx';
import CountdownTimer from './components/CountdownTimer.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import DebugPanel from './components/DebugPanel.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { useConfig } from './hooks/useConfig.js';
import { useCheckInQueue } from './hooks/useCheckInQueue.js';
import { useSocket } from './hooks/useSocket.js';

export default function App() {
  const { config, updateConfig, resetConfig } = useConfig();
  const { currentEvent, enqueue, skipCurrent } = useCheckInQueue(config);
  const { status } = useSocket(config.websocketUrl, enqueue);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [gearIdle, setGearIdle] = useState(true);

  // Reveal the gear on any mouse movement, fade it after 3 seconds of stillness.
  useEffect(() => {
    let timer;
    const wake = () => {
      setGearIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setGearIdle(true), 3000);
    };
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake);
    wake();
    return () => {
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
      clearTimeout(timer);
    };
  }, []);

  // Keyboard shortcuts for the hidden panels.
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDebugOpen((v) => !v);
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSettingsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="stage">
      <BackgroundIframe url={config.powerpointEmbedUrl} delaySec={config.slideshowDelaySec} />

      <ErrorBoundary eventKey={currentEvent?.id} onError={skipCurrent}>
        <Overlay currentEvent={currentEvent} audioEnabled={!config.audioMuted} />
      </ErrorBoundary>

      <CountdownTimer targetTime={config.countdownTargetTime} />

      {config.showConnectionStatus && (
        <div
          className={`status-dot ${status}`}
          aria-live="polite"
          aria-label={`Connection status: ${status}`}
        >
          <span className="dot" />
          <span>{status}</span>
        </div>
      )}

      <button
        className={`settings-gear ${gearIdle ? 'idle' : ''}`}
        onClick={() => setSettingsOpen(true)}
        title="Settings (Ctrl+Shift+S)"
        aria-label="Open settings"
      >
        <Gear />
      </button>

      {settingsOpen && (
        <SettingsPanel
          config={config}
          onChange={updateConfig}
          onReset={resetConfig}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {debugOpen && (
        <DebugPanel
          onSimulate={enqueue}
          onClose={() => setDebugOpen(false)}
        />
      )}
    </div>
  );
}

function Gear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
