import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import BackgroundIframe from './components/BackgroundIframe.jsx';
import Overlay from './components/Overlay.jsx';
import DataCycle from './components/DataCycle.jsx';
import TonightTicker from './components/TonightTicker.jsx';
import CheckoutBoard from './components/CheckoutBoard.jsx';
import NoticeBanner from './components/NoticeBanner.jsx';
import WallClock from './components/WallClock.jsx';
import WeatherChip from './components/WeatherChip.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import SlideEditorPanel from './components/SlideEditorPanel.jsx';
import DebugPanel from './components/DebugPanel.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Mark } from './components/Doodles.jsx';
import StickerChip from './components/StickerChip.jsx';
import { useConfig } from './hooks/useConfig.js';
import { useCheckInQueue, BURST_THRESHOLD } from './hooks/useCheckInQueue.js';
import { useSocket, simulateEvent } from './hooks/useSocket.js';
import { useSeenEvents } from './hooks/useSeenEvents.js';
import { useSchedule } from './hooks/useSchedule.js';
import { useWakeLock } from './hooks/useWakeLock.js';
import { useTally } from './hooks/useTally.js';
import { useTheme } from './hooks/useTheme.js';
import { useCalendar } from './hooks/useCalendar.js';
import { useWeather } from './hooks/useWeather.js';
import { buildCalendarSlides, deriveClubInfo, localDateStr } from './lib/calendarLogic.js';
import { fireMilestone, setConfettiLevel, setConfettiLoad } from './lib/confetti.js';
import { resolveSkin, sceneForSkin, SKIN_TABLE } from './lib/skins.js';
import { decideBoard } from './lib/checkoutBoard.js';
import { weatherMood } from './lib/weather.js';
import { useCelebrationQueue } from './hooks/useCelebrationQueue.js';
import { crossedMilestones, isBigMilestone, nightMilestoneCopy } from './lib/milestones.js';
import { sanitizeOverrides } from './hooks/useConfig.js';
import { getClubPalette } from './lib/clubs.js';
import { parseUrlFlags } from './lib/urlFlags.js';
import { applyPanicMode } from './lib/panic.js';
import { isLatePhase } from './lib/schedule.js';
import { useWatchdogReload } from './hooks/useWatchdogReload.js';
import { COUNTS_WITHOUT_NAMES_MS, DROPPED_GRACE_MS, GEAR_IDLE_MS, MILESTONE_TOAST_MS, OPS_FAILURES_MAX } from './lib/constants.js';

// Read once — the URL can't change without a full page load.
const FLAGS = parseUrlFlags();

export default function App() {
  // ?config=<url>: centrally-managed overrides fetched once at startup,
  // sanitized through the same validators as localStorage overrides.
  // Failures are remembered so the Settings panel can tell the operator
  // their central config isn't being applied — silently falling back
  // looks identical to working until club night.
  const [remoteDefaults, setRemoteDefaults] = useState({});
  const [remoteConfigError, setRemoteConfigError] = useState(null);
  useEffect(() => {
    if (!FLAGS.configUrl) return undefined;
    let cancelled = false;
    fetch(FLAGS.configUrl, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((raw) => {
        if (cancelled) return;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          setRemoteDefaults(sanitizeOverrides(raw));
          setRemoteConfigError(null);
        } else {
          setRemoteConfigError('remote config is not a JSON settings object');
        }
      })
      .catch((err) => {
        if (!cancelled) setRemoteConfigError(err?.message || 'fetch failed');
      });
    return () => { cancelled = true; };
  }, []);

  const { config: storedConfig, overrides, updateConfig, resetConfig } = useConfig(remoteDefaults);

  // ?key=/&cluster= let an embedded browser (OBS source, ProPresenter web
  // page) connect without localStorage access; they win over saved config.
  // ?lowPower=1 forces confetti/motion down for a specific weak-hardware
  // embed (e.g. the Journey Display kiosk's Raspberry Pi Zero) the same
  // way — winning over this device's saved Settings — WITHOUT touching
  // confettiLevel/reduceMotion's own defaults, which stay full-strength
  // for every other, more powerful device that loads this page directly.
  // Panic mode last, so it can strip whatever the flags/overrides built.
  // Memoized so `config` keeps a stable identity between renders —
  // effects and children that depend on it don't re-fire spuriously.
  const config = useMemo(() => {
    let merged = FLAGS.pusherAppKey
      ? {
          ...storedConfig,
          pusherAppKey: FLAGS.pusherAppKey,
          pusherCluster: FLAGS.pusherCluster || storedConfig.pusherCluster,
        }
      : storedConfig;
    if (FLAGS.lowPower) {
      merged = { ...merged, confettiLevel: 'off', reduceMotion: true };
    }
    return applyPanicMode(merged);
  }, [storedConfig]);
  const { currentEvent, enqueue, skipCurrent, pending } = useCheckInQueue(config);
  const { count, bump, reset: resetTally } = useTally();
  const { hasSeen, markSeen, stats: seenStats } = useSeenEvents();
  const { phase, source: scheduleSource } = useSchedule(config);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useTheme(config);

  // One celebration at a time. Three milestone paths (night thresholds,
  // per-club, every-Nth) can fire in the same instant — and cluster exactly
  // when the room is busiest, because they're all driven by the same arriving
  // children. Queueing them stops overlapping toasts and doubled confetti.
  const {
    current: celebration,
    enqueue: enqueueCelebration,
  } = useCelebrationQueue(MILESTONE_TOAST_MS);

  // Confetti fires when a celebration reaches the SCREEN, not when it is
  // queued — otherwise a burst would go off for a toast nobody can see yet.
  useEffect(() => {
    if (celebration == null) return;
    fireMilestone(isBigMilestone(celebration.count) ? { big: true } : undefined);
  }, [celebration]);

  // Club milestones (#36): the printer's live tally broadcasts carry
  // per-club counts; when one club crosses a multiple of
  // clubMilestoneEvery, the milestone toast celebrates that club.
  const clubCountsRef = useRef({});
  const handleTally = useCallback((tally) => {
    const every = config.clubMilestoneEvery;
    const prevCounts = clubCountsRef.current;
    if (every > 0) {
      for (const [club, n] of Object.entries(tally.counts)) {
        const prev = prevCounts[club] ?? n; // first sight is baseline, not a crossing
        if (n > prev && Math.floor(n / every) > Math.floor(prev / every)) {
          enqueueCelebration({ kind: 'club', club, count: Math.floor(n / every) * every });
        }
      }
    }
    clubCountsRef.current = { ...prevCounts, ...tally.counts };
  }, [config.clubMilestoneEvery, enqueueCelebration]);

  // Operator telemetry from the printer (ops events): a red count on the
  // Signal sticker + details in the panels. NEVER a public banner.
  const [opsFailures, setOpsFailures] = useState([]);
  const recordOps = useCallback((ops) => {
    setOpsFailures((prev) => [ops, ...prev].slice(0, OPS_FAILURES_MAX));
  }, []);

  // Lobby "tonight" ticker (#onTonight): aggregate counts across every
  // club, straight from the printer's broadcast. Just the latest
  // snapshot — TonightTicker itself judges staleness against `at`.
  const [tonight, setTonight] = useState(null);
  // Night milestones ride this broadcast because it is the authoritative
  // church-wide count. `prev` starts unset so the FIRST payload is a baseline,
  // never a crossing — a screen that boots at 120 kids must not replay every
  // threshold it missed. `firedRef` makes each threshold once-per-night even if
  // the count bounces (a reconnect re-delivering an older snapshot, say).
  const prevCheckedInRef = useRef(null);
  const firedNightMilestonesRef = useRef(new Set());
  const handleTonight = useCallback((payload) => {
    setTonight(payload);
    const next = payload?.checkedIn;
    if (typeof next !== 'number') return;
    const prev = prevCheckedInRef.current;
    prevCheckedInRef.current = next;
    if (prev == null) return;                       // first sight = baseline
    for (const threshold of crossedMilestones(prev, next)) {
      if (firedNightMilestonesRef.current.has(threshold)) continue;
      firedNightMilestonesRef.current.add(threshold);
      enqueueCelebration({ kind: 'night', count: threshold, ...nightMilestoneCopy(threshold) });
    }
  }, [enqueueCelebration]);

  // Church-authored announcements (#onNotice): latest one wins, same as
  // the tally/ops widgets above. NoticeBanner judges staleness and picks
  // its own presentation from `level`.
  const [notice, setNotice] = useState(null);
  const handleNotice = useCallback((payload) => setNotice(payload), []);

  // Every live check-in — real or simulated — plays a banner and bumps
  // tonight's tally. Once the ceremony starts, live banners switch to
  // the calm 'late' treatment (no confetti cannon, ducked chime).
  const handleCheckIn = useCallback((payload) => {
    if (payload.id) markSeen(payload.id, payload.at ?? Date.now());
    enqueue({
      ...payload,
      presentation: isLatePhase(phaseRef.current) ? 'late' : 'live',
    });
    bump();
  }, [enqueue, bump, markSeen]);

  // Recap replay: after a reconnect, celebrate the kids this display
  // missed — quiet variant, skipping ids already seen live and anything
  // older than the replay window.
  const handleRecap = useCallback((recap) => {
    const maxAgeMs = (config.recapMaxAgeMin ?? 20) * 60 * 1000;
    for (const entry of recap.entries) {
      if (hasSeen(entry.id)) continue;
      if (Date.now() - entry.at > maxAgeMs) continue;
      markSeen(entry.id, entry.at);
      enqueue({ ...entry, presentation: 'replay' });
      bump();
    }
  }, [config.recapMaxAgeMin, hasSeen, markSeen, enqueue, bump]);

  // Who is still waiting to be picked up. Just the latest snapshot — all of the
  // "may this be on screen, and may it name anyone" judgement lives in the pure
  // decideBoard() in src/lib/checkoutBoard.js.
  const [checkout, setCheckout] = useState(null);

  const socketHandlers = useMemo(() => ({
    onCheckin: handleCheckIn,
    onRecap: handleRecap,
    onOps: recordOps,
    onTally: handleTally,
    onTonight: handleTonight,
    onNotice: handleNotice,
    onCheckout: setCheckout,
  }), [handleCheckIn, handleRecap, recordOps, handleTally, handleTonight, handleNotice]);

  const { status, lastEventAt, lastCheckinAt, retry, nameStatus } = useSocket(socketHandlers);

  // ── Simulated events go through the SAME sanitizers as real ones ────────────
  // The debug panel used to call these handlers directly, so every fake payload
  // bypassed the privacy boundary — the one thing this app is built around.
  // Routing them through `simulateEvent` means a malformed fake is dropped
  // exactly as a malformed real event would be, which also turns the panel into
  // a live contract check: if a simulator's shape drifts from the allowlist, the
  // button visibly does nothing (and logs why) instead of rendering something
  // the wire could never deliver.
  //
  // `demoActive` drives the on-screen badge. Once set it stays set for the rest
  // of the session: a training run must never be mistakable for real check-ins,
  // and "the badge quietly disappeared" is exactly how that mistake happens.
  const [demoActive, setDemoActive] = useState(false);
  const simulate = useCallback((event, payload) => {
    setDemoActive(true);
    return simulateEvent(event, payload, socketHandlers);
  }, [socketHandlers]);

  const wakeLockStatus = useWakeLock(config.keepScreenAwake);

  // Kiosk self-heal: reload once if the pipe stays dead far longer than
  // any normal blip (rate-limited; 'off' — never configured — is exempt).
  useWatchdogReload(status, config.watchdogReloadMin);

  // ── Calendar-aware slides ─────────────────────────────────
  // The local date key ticks over at midnight so "tonight" flips
  // without a reload on a display that runs for days.
  const [todayStr, setTodayStr] = useState(localDateStr);
  useEffect(() => {
    const timer = setInterval(() => {
      const next = localDateStr();
      setTodayStr((prev) => (prev === next ? prev : next));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const calendar = useCalendar(config);
  // The corner chip works over any background source — it's an overlay
  // widget like the clock, not part of the slide rotation.
  const showWeatherChip = config.showWeatherChip !== false;
  // Fetch when EITHER the chip or weather theming needs it. Gating solely on
  // the chip meant hiding one small corner widget silently stopped the whole
  // room responding to the weather — a coupling nobody would guess.
  const weatherTheme = config.weatherTheme === true;
  const weather = useWeather(config, (showWeatherChip || weatherTheme) && !FLAGS.overlay);

  const calendarSlides = config.calendarEnabled
    ? buildCalendarSlides(deriveClubInfo(calendar.events, todayStr), config)
    : [];

  // Thin the confetti while a rush is draining so cheap signage sticks
  // hold 60fps with banners firing back-to-back.
  useEffect(() => {
    setConfettiLoad(pending > BURST_THRESHOLD);
  }, [pending]);

  // Room-wide confetti intensity (Settings → Banners).
  useEffect(() => {
    setConfettiLevel(config.confettiLevel);
  }, [config.confettiLevel]);

  // Tally milestones: every Nth check-in gets a room-wide celebration.
  // Fires only on a genuine increment, so restoring a saved tally on
  // page load can't re-celebrate. Goes through the same queue as the club and
  // night milestones so it can't overlap them.
  const prevCountRef = useRef(count);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    const every = config.milestoneEvery;
    if (!every || count <= prev || count % every !== 0) return;
    enqueueCelebration({ kind: 'tally', count });
  }, [count, config.milestoneEvery, enqueueCelebration]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slideEditorOpen, setSlideEditorOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [gearIdle, setGearIdle] = useState(true);

  // If the realtime pipe drops mid-club, surface the status dot even when
  // it's switched off in settings — a dead connection must never be
  // silent. A short grace period ignores ordinary reconnect blips.
  const [droppedLong, setDroppedLong] = useState(false);
  useEffect(() => {
    const disconnected = status === 'disconnected';
    const timer = setTimeout(() => setDroppedLong(disconnected), disconnected ? DROPPED_GRACE_MS : 0);
    return () => clearTimeout(timer);
  }, [status]);
  // The names arrive encrypted (see src/lib/envelope.js). A screen that can't
  // read them looks EXACTLY like a quiet night — connected, clock ticking,
  // weather fine, counts even climbing — which is the worst failure available:
  // nobody investigates a quiet night. So a name fault forces the sticker up
  // regardless of the setting, and says which half is broken, because the fixes
  // differ (paste the key on this screen vs. set one on the print server).
  const nameFault = nameStatus && nameStatus !== 'ok';
  const nameFaultText = {
    'no-key': 'DISPLAY KEY NOT SET',
    'bad-key': 'NAMES UNREADABLE — CHECK DISPLAY KEY',
    downgraded: 'NAMES REFUSED — SENT UNENCRYPTED',
  }[nameStatus] || null;

  // Cross-check for the other direction: if the PRINT SERVER is the side
  // missing its key, it publishes nothing on the name events, so this screen
  // sees a climbing tally and no banners. Without this, that is indistinguishable
  // from a quiet night, and the one-pager would send nobody anywhere.
  const [countsWithoutNames, setCountsWithoutNames] = useState(false);
  useEffect(() => {
    // `lastCheckinAt` only advances when a checkin actually OPENED and passed
    // its sanitizer, so it is the honest "names are reaching this screen" signal.
    const climbing = (tonight?.checkedIn || 0) > 0;
    // Always resolve through a timer, never synchronously: the clear case is
    // just a zero-delay check, which keeps this out of the render path.
    const check = () => setCountsWithoutNames(
      climbing && !nameFault
      && (!lastCheckinAt || Date.now() - lastCheckinAt > COUNTS_WITHOUT_NAMES_MS));
    const timer = setTimeout(check, climbing && !nameFault ? COUNTS_WITHOUT_NAMES_MS : 0);
    return () => clearTimeout(timer);
  }, [tonight?.checkedIn, lastCheckinAt, nameFault]);

  // Re-evaluated on a slow ticker as well as on new data, because the board's
  // most important transition — going stale when the volunteer closes the
  // TwoTimTwo tab — happens when NOTHING arrives. An effect keyed only on the
  // payload would leave a frozen list looking live all night.
  // `now` is held in state rather than read inside the memo, so the decision
  // stays a pure function of its inputs and the clock is an explicit dependency.
  const [boardNow, setBoardNow] = useState(0);
  useEffect(() => {
    const advance = () => setBoardNow(Date.now());
    advance();
    const t = setInterval(advance, 30000);
    return () => clearInterval(t);
  }, [checkout]);   // re-stamp on new data so a fresh board is never shown as aged
  const boardDecision = useMemo(() => decideBoard({
    checkout,
    mode: config.checkoutBoardMode,
    namesAbove: config.checkoutBoardNamesAbove,
    staleMin: config.checkoutBoardStaleMin,
    phase,
    now: boardNow,
  }), [checkout, config.checkoutBoardMode, config.checkoutBoardNamesAbove,
    config.checkoutBoardStaleMin, phase, boardNow]);

  // Printer trouble also forces the sticker visible — a kid at the door
  // with no label is exactly when the operator needs the red count.
  const showStatus = config.showConnectionStatus
    || (droppedLong && status === 'disconnected')
    || opsFailures.length > 0
    || Boolean(nameFault)
    || countsWithoutNames;

  // 'cycle' (default): one big animated data point at a time, bottom
  // right. 'stickers': the classic corner-chip layout. The connection
  // status dot stays a corner sticker in both modes — a dead pipe must
  // never be silent, so it can't wait its turn in a rotation.
  const stickerMode = config.widgetDisplayMode === 'stickers';

  // Themed skin — 'auto' resolves by season, and because it derives
  // from todayStr it rolls over at midnight without a reload, like
  // everything else date-derived. Noon avoids TZ edge cases.
  // Tonight's calendar title lets 'auto' pick Easter / VBS / Thanksgiving,
  // none of which a month table can express (floating, lunar, or
  // church-scheduled). Falls back to the month when nothing matches.
  const tonightTitle = useMemo(
    () => deriveClubInfo(calendar.events, todayStr)?.today?.title ?? null,
    [calendar.events, todayStr],
  );
  const skin = resolveSkin(config.nightTheme, new Date(`${todayStr}T12:00:00`), tonightTitle);

  // The season picks the scene; the weather only adds atmosphere over it, so a
  // deliberately-chosen VBS skin doesn't vanish because it started raining.
  const sceneTheme = sceneForSkin(skin);
  const skinAccents = SKIN_TABLE[skin] ?? null;
  const mood = useMemo(
    () => (weatherTheme ? weatherMood(weather) : { cozy: false, dim: 1, reason: 'off' }),
    [weatherTheme, weather],
  );

  // Reveal the gear on any mouse movement, fade it after 3 seconds of stillness.
  useEffect(() => {
    let timer;
    const wake = () => {
      setGearIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setGearIdle(true), GEAR_IDLE_MS);
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

  // Keyboard shortcuts for the hidden panels. Ctrl+Shift+X is the panic
  // switch — S/E/D were taken.
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey || !e.shiftKey) return;
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDebugOpen((v) => !v);
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSettingsOpen((v) => !v);
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setSlideEditorOpen((v) => !v);
      } else if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        updateConfig({ panicMode: !storedConfig.panicMode });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [updateConfig, storedConfig.panicMode]);

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
    // "user" makes framer-motion honor the OS-level prefers-reduced-motion
    // setting for every transform animation (the CSS media query and
    // canvas-confetti already do); opacity fades remain so banners still
    // appear either way. config.reduceMotion forces "always" regardless of
    // the OS setting — needed because a kiosk Chromium rarely has that OS
    // setting exposed/set even on hardware that badly needs it reduced.
    <MotionConfig reducedMotion={config.reduceMotion ? 'always' : 'user'}>
    <div
      className={`stage ${overlay ? 'overlay' : ''}`}
      data-skin={skin !== 'none' ? skin : undefined}
      style={{
        ...(chroma ? { background: chroma } : null),
        // Accent pair straight from SKIN_TABLE — see the note in app.css.
        ...(skinAccents ? { '--skin-a': skinAccents.a, '--skin-b': skinAccents.b } : null),
      }}
      ref={stageRef}
      onDoubleClick={toggleFullscreen}
    >
      {/* Every stage layer sits behind its own crash fence: a broken
          background or corner widget disappears quietly instead of
          white-screening the whole display mid-club. */}
      {!overlay && (
        <ErrorBoundary label="background">
          <BackgroundIframe
            url={config.powerpointEmbedUrl}
            slideshowDelaySec={config.slideshowDelaySec}
            useLocalSlideshow={config.useLocalSlideshow}
            backgroundSource={config.backgroundSource}
            manualSlides={config.manualSlides}
            calendarSlides={calendarSlides}
            sceneTheme={sceneTheme ?? 'sky'}
            cozy={mood.cozy}
            dim={mood.dim}
            reduceMotion={config.reduceMotion}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary label="banner" eventKey={currentEvent?.id} onError={skipCurrent}>
        <Overlay currentEvent={currentEvent} audioEnabled={!config.audioMuted} clubPhrases={config.clubPhrases} />
      </ErrorBoundary>

      {/* Church-authored announcements. Rendered regardless of overlay
          mode — like the check-in banner above, a genuine cancellation
          notice must reach an OBS/ProPresenter feed too, not just the
          lobby TV. */}
      <ErrorBoundary label="notice-banner">
        <NoticeBanner notice={notice} />
      </ErrorBoundary>

      {!overlay && !stickerMode && (
        <ErrorBoundary label="data-cycle">
          <DataCycle
            count={count}
            weather={weather}
            showClock={config.showClock}
            showTally={config.showTally}
            showWeather={showWeatherChip}
            intervalSec={config.cycleIntervalSec}
          />
        </ErrorBoundary>
      )}

      {/* Lobby "tonight" stat strip. Independent of widgetDisplayMode
          (it's realtime print-server data, not an operator-configured
          corner widget) — only overlay mode (transparent OBS/ProPresenter
          source, banners + confetti only) hides it. Yields to an active
          check-in banner via `active`; see TonightTicker.jsx. */}
      {!overlay && (
        <ErrorBoundary label="tonight-ticker">
          <TonightTicker tonight={tonight} active={!currentEvent} />
        </ErrorBoundary>
      )}

      {/* Who is still waiting to be picked up. Off unless the operator turned it
          on, and it yields to an active check-in banner — a child arriving at the
          door outranks the pickup list. All the visibility judgement is in the
          pure decideBoard(); see src/lib/checkoutBoard.js for why it is gated. */}
      {!overlay && !currentEvent && (
        <ErrorBoundary label="checkout-board">
          <CheckoutBoard decision={boardDecision} checkout={checkout} calm={config.panicMode === true} />
        </ErrorBoundary>
      )}

      {/* Top-right corner stack: clock, weather chip, status dot flow
          under one another so nothing ever overlaps. In cycle mode the
          clock and weather live in the rotation instead, so only the
          status dot remains up here. */}
      {!overlay && ((stickerMode && (config.showClock || (showWeatherChip && weather))) || showStatus) && (
        <div className="corner-stack">
          {stickerMode && config.showClock && <WallClock />}
          {stickerMode && showWeatherChip && <WeatherChip weather={weather} />}
          {showStatus && (
            <StickerChip
              className={`status-dot ${status}`}
              label="Signal"
              tilt={-1}
              aria-live="polite"
              aria-label={`Connection status: ${status}${opsFailures.length ? `, ${opsFailures.length} printer problem(s)` : ''}`}
            >
              <span className="dot" />
              <span>
                {status === 'off' ? 'not set up' : status}
                {/* While the pipe is down, show what pusher-js is doing
                    about it — "disconnected" alone reads as dead-forever. */}
                {status !== 'connected' && retry
                  ? ` · retry ${retry.attempts}${retry.delaySec ? ` in ~${retry.delaySec}s` : '…'}`
                  : ''}
              </span>
              {opsFailures.length > 0 && (
                <span className="ops-count" title="Printer problems tonight — see Settings">
                  ⚠ {opsFailures.length}
                </span>
              )}
              {/* Name faults get WORDS, not a colour. "disconnected" at least
                  tells an operator to look at the network; a silent absence of
                  banners tells them nothing, so this says which side to fix. */}
              {nameFaultText && (
                <span className="name-fault" title="Children's names arrive encrypted — see Settings → Display key">
                  {nameFaultText}
                </span>
              )}
              {!nameFaultText && countsWithoutNames && (
                <span className="name-fault" title="The print server may be missing its display key">
                  COUNTS RISING, NO NAMES — CHECK THE PRINTER
                </span>
              )}
            </StickerChip>
          )}
        </div>
      )}

      {!overlay && stickerMode && config.showTally && count > 0 && (
        <StickerChip
          className="tally"
          label="Tonight"
          tilt={1.2}
          sparkle
          sparkleDelay={5}
          aria-live="off"
        >
          {/* Remounting on every increment gives the number a joyful
              little pop-and-twist as each kid checks in. */}
          <motion.span
            key={count}
            className="tally-count"
            initial={{ scale: 1.5, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 15 }}
          >
            {count}
          </motion.span>
          <span className="tally-label">checked in</span>
        </StickerChip>
      )}

      {/* One toast, three sources — see useCelebrationQueue. `kind` picks the
          copy and styling; the queue guarantees only one is ever on screen. */}
      <AnimatePresence>
        {celebration != null && (
          <motion.div
            key={`celebration-${celebration.kind}-${celebration.club ?? ''}-${celebration.count}`}
            className={
              celebration.kind === 'club'
                ? 'milestone-toast club-milestone'
                : celebration.kind === 'night'
                  ? 'milestone-toast night-milestone'
                  : 'milestone-toast'
            }
            style={celebration.kind === 'club'
              ? { rotate: 1.1, '--club-primary': getClubPalette(celebration.club).primary }
              : { rotate: -1.2 }}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 160, damping: 18 } }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.4 } }}
          >
            {/* Corner sparkles twinkle for the whole time the toast is up. */}
            <motion.span
              className="milestone-sparkle milestone-sparkle--left"
              aria-hidden
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8], rotate: [0, 16, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Mark kind="sparkle" size={30} />
            </motion.span>
            <div className="milestone-lines">
              <span className="milestone-label">
                {celebration.kind === 'club' ? celebration.club
                  : celebration.kind === 'night' ? celebration.label
                    : 'Checked in tonight'}
              </span>
              <span className="milestone-count">
                {celebration.kind === 'club' ? `${celebration.count} kids strong!`
                  : celebration.kind === 'night' ? celebration.headline
                    : `${celebration.count} kids!`}
              </span>
            </div>
            <motion.span
              className="milestone-sparkle milestone-sparkle--right"
              aria-hidden
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8], rotate: [0, -16, 0] }}
              transition={{ duration: 2.2, delay: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Mark kind="sparkle" size={36} />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!overlay && pending >= BURST_THRESHOLD && (
          <motion.div
            key="up-next"
            className="up-next"
            style={{ rotate: 0.6 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.3 } }}
          >
            +{pending} more coming
          </motion.div>
        )}
      </AnimatePresence>

      {!overlay && config.panicMode && (
        <div className="panic-pill" title="Simplified mode is on — toggle with Ctrl+Shift+X or in Settings → Display">
          simplified mode
        </div>
      )}

      {/* Once a simulated event has been fired, say so for the rest of the
          session. A volunteer walking past the lobby TV during training must
          never mistake a fake banner for a real child arriving — and a badge
          that timed out would defeat that at exactly the wrong moment. Cleared
          only by reloading, which is also how you leave demo mode. */}
      {demoActive && (
        <div className="demo-pill" title="A simulated event has been fired on this screen. Reload to clear.">
          demo mode — not real check-ins
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
        <ErrorBoundary label="settings-panel" onError={() => setSettingsOpen(false)}>
          <SettingsPanel
            config={config}
            overrides={overrides}
            status={status}
            lastEventAt={lastEventAt}
            calendar={calendar}
            phase={phase}
            scheduleSource={scheduleSource}
            opsFailures={opsFailures}
            remoteConfigError={FLAGS.configUrl ? remoteConfigError : null}
            wakeLockStatus={wakeLockStatus}
            onChange={updateConfig}
            onReset={resetConfig}
            onClose={() => setSettingsOpen(false)}
            onTest={(p) => simulate('checkin', p)}
            onResetTally={resetTally}
            onOpenSlideEditor={() => {
              setSettingsOpen(false);
              setSlideEditorOpen(true);
            }}
            onOpenDebug={() => { setSettingsOpen(false); setDebugOpen(true); }}
          />
        </ErrorBoundary>
      )}

      {slideEditorOpen && (
        <ErrorBoundary label="slide-editor" onError={() => setSlideEditorOpen(false)}>
          <SlideEditorPanel
            config={config}
            onChange={updateConfig}
            onClose={() => setSlideEditorOpen(false)}
          />
        </ErrorBoundary>
      )}

      {debugOpen && (
        <ErrorBoundary label="debug-panel" onError={() => setDebugOpen(false)}>
          <DebugPanel
            onSimulate={(p) => simulate('checkin', p)}
            onSimulateRecap={(p) => simulate('recap', p)}
            onSimulateOps={(p) => simulate('ops', p)}
            onSimulateTally={(p) => simulate('tally', p)}
            onSimulateCheckout={(p) => simulate('checkout', p)}
            onSimulateTonight={(p) => simulate('tonight', p)}
            onSimulateNotice={(p) => simulate('notice', p)}
            onClose={() => setDebugOpen(false)}
            status={status}
            lastEventAt={lastEventAt}
            pending={pending}
            phase={phase}
            seenStats={seenStats}
            opsFailures={opsFailures}
            wakeLockStatus={wakeLockStatus}
          />
        </ErrorBoundary>
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
