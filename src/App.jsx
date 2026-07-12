import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import BackgroundIframe from './components/BackgroundIframe.jsx';
import Overlay from './components/Overlay.jsx';
import CountdownTimer from './components/CountdownTimer.jsx';
import WallClock from './components/WallClock.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import DebugPanel from './components/DebugPanel.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { useConfig } from './hooks/useConfig.js';
import { useCheckInQueue, BURST_THRESHOLD } from './hooks/useCheckInQueue.js';
import { useSocket } from './hooks/useSocket.js';
import { useWakeLock } from './hooks/useWakeLock.js';
import { useTally } from './hooks/useTally.js';
import { fireMilestone, setConfettiLoad } from './lib/confetti.js';
import { parseUrlFlags } from './lib/urlFlags.js';

// Read once — the URL can't change without a full page load.
const FLAGS = parseUrlFlags();

export default function App() {
  const { config: storedConfig, updateConfig, resetConfig } = useConfig();

  // ?key=/&cluster= let an embedded browser (OBS source, ProPresenter web
  // page) connect without localStorage access; they win over saved config.
  const config = FLAGS.pusherAppKey
    ? {
        ...storedConfig,
        pusherAppKey: FLAGS.pusherAppKey,
        pusherCluster: FLAGS.pusherCluster || storedConfig.pusherCluster,
      }
    : storedConfig;
  const { currentEvent, enqueue, skipCurrent, pending } = useCheckInQueue(config);
  const { count, bump, reset: resetTally } = useTally();

  // Every check-in — real or simulated — plays a banner and bumps
  // tonight's tally.
  const handleCheckIn = useCallback((payload) => {
    enqueue(payload);
    bump();
  }, [enqueue, bump]);

  const { status, lastEventAt } = useSocket(handleCheckIn);

  useWakeLock(config.keepScreenAwake);

  // Thin the confetti while a rush is draining so cheap signage sticks
  // hold 60fps with banners firing back-to-back.
  useEffect(() => {
    setConfettiLoad(pending > BURST_THRESHOLD);
  }, [pending]);

  // Tally milestones: every Nth check-in gets a room-wide celebration.
  // Fires only on a genuine increment, so restoring a saved tally on
  // page load can't re-celebrate.
  const [milestone, setMilestone] = useState(null);
  const prevCountRef = useRef(count);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    const every = config.milestoneEvery;
    if (!every || count <= prev || count % every !== 0) return;
    setMilestone(count);
    fireMilestone();
  }, [count, config.milestoneEvery]);
  useEffect(() => {
    if (milestone == null) return undefined;
    const timer = setTimeout(() => setMilestone(null), 6000);
    return () => clearTimeout(timer);
  }, [milestone]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [gearIdle, setGearIdle] = useState(true);

  // If the realtime pipe drops mid-club, surface the status dot even when
  // it's switched off in settings — a dead connection must never be
  // silent. A short grace period ignores ordinary reconnect blips.
  const [droppedLong, setDroppedLong] = useState(false);
  useEffect(() => {
    const disconnected = status === 'disconnected';
    const timer = setTimeout(() => setDroppedLong(disconnected), disconnected ? 8000 : 0);
    return () => clearTimeout(timer);
  }, [status]);
  const showStatus = config.showConnectionStatus || (droppedLong && status === 'disconnected');

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

  // Double-click anywhere on the stage toggles fullscreen — easier than
  // hunting for F11 on a TV keyboard or remote-desktop session. Panels
  // stop the event so double-clicking inside a text field stays normal.
  const stageRef = useRef(null);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      stageRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // Overlay mode (?overlay=1): transparent stage with banners + confetti
  // only, for use as an OBS browser source / ProPresenter web overlay.
  // The html element also needs the class so nothing paints behind the
  // stage; ?chroma=RRGGBB swaps transparency for a solid key color.
  const { overlay, chroma } = FLAGS;
  useEffect(() => {
    if (!overlay) return undefined;
    document.documentElement.classList.add('overlay-mode');
    return () => document.documentElement.classList.remove('overlay-mode');
  }, [overlay]);

  return (
    // reducedMotion="user" makes framer-motion honor the OS setting for
    // every transform animation (the CSS media query and canvas-confetti
    // already do); opacity fades remain so banners still appear.
    <MotionConfig reducedMotion="user">
    <div
      className={`stage ${overlay ? 'overlay' : ''}`}
      style={chroma ? { background: chroma } : undefined}
      ref={stageRef}
      onDoubleClick={toggleFullscreen}
    >
      {!overlay && (
        <BackgroundIframe
          url={config.powerpointEmbedUrl}
          slideshowDelaySec={config.slideshowDelaySec}
          useLocalSlideshow={config.useLocalSlideshow}
        />
      )}

      <ErrorBoundary eventKey={currentEvent?.id} onError={skipCurrent}>
        <Overlay currentEvent={currentEvent} audioEnabled={!config.audioMuted} />
      </ErrorBoundary>

      {!overlay && <CountdownTimer targetTime={config.countdownTargetTime} />}

      {!overlay && config.showClock && <WallClock />}

      {!overlay && config.showTally && count > 0 && (
        <div className="tally" aria-live="off">
          <span className="tally-count">{count}</span>
          <span className="tally-label">checked in tonight</span>
        </div>
      )}

      <AnimatePresence>
        {milestone != null && (
          <motion.div
            key="milestone"
            className="milestone-toast"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 160, damping: 18 } }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.4 } }}
          >
            <span className="milestone-count">{milestone}</span>
            <span className="milestone-label">kids checked in tonight!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!overlay && pending >= BURST_THRESHOLD && (
          <motion.div
            key="up-next"
            className="up-next"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.3 } }}
          >
            +{pending} more coming
          </motion.div>
        )}
      </AnimatePresence>

      {!overlay && showStatus && (
        <div
          className={`status-dot ${status} ${config.showClock ? 'below-clock' : ''}`}
          aria-live="polite"
          aria-label={`Connection status: ${status}`}
        >
          <span className="dot" />
          <span>{status === 'off' ? 'not set up' : status}</span>
        </div>
      )}

      {!overlay && (
        <button
          className={`settings-gear ${gearIdle ? 'idle' : ''}`}
          onClick={() => setSettingsOpen(true)}
          title="Settings (Ctrl+Shift+S)"
          aria-label="Open settings"
        >
          <Gear />
        </button>
      )}

      {settingsOpen && (
        <SettingsPanel
          config={config}
          status={status}
          lastEventAt={lastEventAt}
          onChange={updateConfig}
          onReset={resetConfig}
          onClose={() => setSettingsOpen(false)}
          onTest={handleCheckIn}
          onResetTally={resetTally}
        />
      )}

      {debugOpen && (
        <DebugPanel
          onSimulate={handleCheckIn}
          onClose={() => setDebugOpen(false)}
          status={status}
          lastEventAt={lastEventAt}
          pending={pending}
        />
      )}
    </div>
    </MotionConfig>
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
