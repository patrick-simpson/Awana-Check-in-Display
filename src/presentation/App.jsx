import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AppMode } from './types.js';
import { FLAGS } from './lib/flags.js';
import { stateKey, windowsForDate } from './lib/schedule.js';
import { useEffectiveSchedule } from './hooks/useEffectiveSchedule.js';
import { advisoryTitle } from './lib/scheduleAdvisory.js';
import { DUR, EASE } from './lib/motion-tokens.js';
import { useClock } from './hooks/useClock.js';
import { useSchedule } from './hooks/useSchedule.js';
import { useRealtime } from './hooks/useRealtime.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { useBuildReload } from '../hooks/useBuildReload.js';
import { projectorIdle } from '../lib/buildReload.js';
import { ViewErrorBoundary, ErrorScreen } from './components/ViewErrorBoundary.jsx';
import { AwanaMark } from './components/AwanaMark.jsx';
import { ResumePill } from './components/ResumePill.jsx';
import { SetupChecklist } from './components/SetupChecklist.jsx';
import { CountdownView } from './views/CountdownView.jsx';
import { GameTimeView } from './views/GameTimeView.jsx';
import { SlideshowView } from './views/SlideshowView.jsx';
import { ShutdownView } from './views/ShutdownView.jsx';
import { QuickNav } from './views/QuickNav.jsx';
import { TouchMenu } from './views/TouchMenu.jsx';
import { BraceletTimeView } from './views/BraceletTimeView.jsx';
import { BraceletPanel } from './views/BraceletPanel.jsx';
import { forcedBraceletWindow, isBraceletClubWindow, isBraceletNight, isBraceletWindow } from './lib/bracelets.js';
import { braceletForced, getBraceletSettings, subscribeBraceletSettings } from './lib/braceletSettings.js';
import { unlockAudio } from './lib/chime.js';
import { unlockStingers } from './lib/stingers.js';
import { isTouch, usePortrait, useTouch } from './lib/touch.js';
import { useKeydown } from './hooks/useKeydown.js';

const OPENING_WINDOW_INDEX = 0;

export const App = () => {
  const now = useClock();

  // All realtime data (live tally + birthday sync + schedule advisory +
  // ?key= adoption) flows through the display's sanctioned sanitized
  // socket — see hooks/useRealtime.js. This replaces the original
  // repo's adoptPusherUrlFlags/useBirthdaySync startup chores. Read
  // before useSchedule() so the `schedule` broadcast can be folded in
  // as an advisory layer over shared/schedule.json (never a
  // replacement — see lib/scheduleAdvisory.js).
  const { tally, schedule: scheduleAdvisory, socketStatus } = useRealtime();
  const { state, isOverride, resumeAt, select, resume, stay } = useSchedule(now, scheduleAdvisory);

  // Advancing past the opening deck's final blackout jumps straight into
  // the first game window (T&T) — the leader ends the ceremony and starts
  // games with one more press of the same arrow key. Resolved against
  // tonight's EFFECTIVE window table (special dates can reshape it), the
  // same table select() indexes into.
  const scheduleCfg = useEffectiveSchedule();
  const effectiveWindows = windowsForDate(now, scheduleCfg) ?? scheduleCfg.windows;
  const firstGameIndex = effectiveWindows.findIndex((w) => w.kind === 'game');

  // ?vr=1 (visual-regression / screenshot mode): stamp the root so CSS
  // can kill every keyframe animation, and tell framer-motion to skip
  // transform animations — two renders of one state become identical.
  useEffect(() => {
    if (!FLAGS.vr) return undefined;
    document.documentElement.dataset.vr = '1';
    return () => { delete document.documentElement.dataset.vr; };
  }, []);

  // A phone or tablet (lib/touch.js): the root carries it, as it carries
  // ?vr=1, for the e2e suites and anything that asks the DOM. The CSS itself
  // reads the same media queries directly (index.css, the touch and portrait
  // blocks at its end), so the first paint is already the right page.
  const touch = useTouch();
  const portrait = usePortrait();
  useEffect(() => {
    const root = document.documentElement;
    if (touch) root.dataset.touch = '1';
    if (portrait) root.dataset.portrait = '1';
    return () => {
      delete root.dataset.touch;
      delete root.dataset.portrait;
    };
  }, [touch, portrait]);

  // While the tab is hidden (projector input switched away, window
  // minimized) pause every ambient keyframe loop — no reason to burn
  // GPU on animations nobody can see. Resumes on return.
  useEffect(() => {
    const sync = () => {
      if (document.hidden) document.documentElement.dataset.animPaused = '1';
      else delete document.documentElement.dataset.animPaused;
    };
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      document.removeEventListener('visibilitychange', sync);
      delete document.documentElement.dataset.animPaused;
    };
  }, []);

  // The projector must never doze off mid-countdown (same shared hook
  // as the signage page — on the presentation import allowlist).
  useWakeLock(true);

  // Self-updating (see CLAUDE.md, "Self-updating pages"): the projector picks
  // up a new deploy on its own, and only while nobody is watching it count.
  // Shutdown is always safe, and so is a countdown still more than half an
  // hour out, before 5:30 on a club night, and any other day of the week.
  // The rule itself lives in the shared pure helper; here it is just "not
  // idle means busy".
  // (A forced Bracelet Time wall, below, is busy all evening: it switches
  // itself off at midnight, and the page may update again after that.)
  const braceletSettings = useSyncExternalStore(subscribeBraceletSettings, getBraceletSettings, getBraceletSettings);
  const forced = braceletForced(braceletSettings, now);
  const buildReloadBusy = useCallback(() => forced || !projectorIdle(state), [forced, state]);
  useBuildReload(buildReloadBusy);

  // A deliberately bare wall (the opening's closing blackout, the shutdown
  // screen's idle blackout) takes the Awana Clubs mark with it. The views
  // report it; a view that goes away reports false on its way out.
  const [bare, setBare] = useState(false);

  // Bracelet Time (the two bracelet nights' T&T and Sparks windows). Its
  // controls panel opens with B (never while typing in a field) or from
  // QuickNav (on a phone or tablet, the touch menu's "Bracelet Time controls"
  // row), on a bracelet night only: on any other night B does nothing and
  // neither menu has such a button, exactly as before (B is the black-screen key
  // of every slide tool and many clickers). While it is open the panel owns
  // the keyboard (see BraceletPanel), so B and Escape close it there. Every
  // key press and click also arms the page's sound, which browsers only allow
  // after a gesture: the chime before each epic needs it.
  //
  // "Show Bracelet Time now" (the menus' switch, owner 2026-09-30) forces the
  // wall to Bracelet Time on any night and at any time, over whatever the
  // schedule is showing, until it is switched off or midnight comes. In a T&T
  // or Sparks game window it keeps that window's club, end time and
  // warnings; anywhere else it is T&T with no end time. While it is on, B and
  // the controls work on any night.
  const forcedWall = forced
    ? state.mode === AppMode.GAME_TIME && isBraceletClubWindow(state.window)
      ? { window: state.window, endsAt: state.endsAt }
      : { window: forcedBraceletWindow(/** @type {number} */ (braceletSettings.force), now), endsAt: null }
    : null;
  const bracelets = forced || (state.mode === AppMode.GAME_TIME && isBraceletWindow(state.window, now));
  const braceletNight = forced || isBraceletNight(now);
  const [braceletPanel, setBraceletPanel] = useState(false);
  // Past midnight the panel closes for good, so it can never reappear on the
  // next bracelet night a week later on a page that was never reloaded.
  if (braceletPanel && !braceletNight) setBraceletPanel(false);
  const panelOpen = braceletPanel && braceletNight;
  // The touch menu (TouchMenu): null while closed, 'menu' open, 'display'
  // open on Display Settings. A device that stops being touch-first (a mouse
  // plugged into a tablet) gets the hover menu back, closed.
  const [menu, setMenu] = useState(/** @type {null | 'menu' | 'display'} */ (null));
  if (menu !== null && !touch) setMenu(null);
  useEffect(() => {
    // On a phone the countdown chimes can only sound once a tap has woken
    // their audio too (lib/stingers.js); the PC's browser needs no help.
    const arm = () => {
      unlockAudio();
      if (isTouch()) unlockStingers();
    };
    window.addEventListener('pointerdown', arm, { capture: true, passive: true });
    window.addEventListener('keydown', arm, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', arm, { capture: true });
      window.removeEventListener('keydown', arm, { capture: true });
    };
  }, []);
  useKeydown((e) => {
    if (!braceletNight || panelOpen) return;
    const t = e.target;
    const typing = t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    if (typing) return;
    if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) setBraceletPanel(true);
  });

  return (
    <MotionConfig reducedMotion={FLAGS.vr ? 'always' : 'user'}>
    <div className="w-full h-full relative" style={{ background: '#000000' }}>
      {/* One view at a time; exits run faster than entrances (the kit's rule). */}
      <AnimatePresence mode="wait">
        <motion.div
          key={forcedWall ? `bracelets:${forcedWall.window.clubs[0]}` : stateKey(state)}
          className="absolute inset-0"
          data-mode={forcedWall ? 'game-time' : slugFor(state)}
          data-deck={!forcedWall && state.mode === AppMode.SLIDESHOW ? state.deck : undefined}
          data-activity={bracelets ? 'bracelets' : undefined}
          data-forced={forcedWall ? 'bracelets' : undefined}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: DUR.mode, ease: EASE.settle } }}
          exit={{ opacity: 0, scale: 1.01, transition: { duration: DUR.mode / 2, ease: EASE.exit } }}
        >
          <ViewErrorBoundary label={labelFor(state)}>
            <ActiveView
              state={state}
              now={now}
              tally={tally}
              meetingTheme={advisoryTitle(scheduleAdvisory, now)}
              onSelect={select}
              firstGameIndex={firstGameIndex}
              onBareChange={setBare}
              forcedWall={forcedWall}
            />
          </ViewErrorBoundary>
        </motion.div>
      </AnimatePresence>

      {/* The Awana Clubs mark, like a broadcast logo: above every view, so no
          slide change or view crossfade ever moves it. */}
      <AwanaMark placement={forcedWall || state.mode === AppMode.GAME_TIME ? 'game' : 'default'} hidden={bare && !forcedWall} />

      {touch ? (
        <TouchMenu
          now={now}
          state={state}
          isOverride={isOverride}
          onSelect={select}
          onResume={resume}
          socketStatus={socketStatus}
          onBracelets={braceletNight ? () => setBraceletPanel(true) : undefined}
          open={menu !== null}
          displayOpen={menu === 'display'}
          onOpen={() => setMenu('menu')}
          onClose={() => setMenu(null)}
        />
      ) : (
        <QuickNav now={now} state={state} isOverride={isOverride} onSelect={select} onResume={resume} socketStatus={socketStatus} onBracelets={braceletNight ? () => setBraceletPanel(true) : undefined} />
      )}
      {panelOpen && <BraceletPanel active={bracelets} onClose={() => setBraceletPanel(false)} />}
      {isOverride && <ResumePill now={now} resumeAt={resumeAt} onStay={stay} />}
      {touch ? <SetupChecklist touch onSetUp={() => setMenu('display')} /> : <SetupChecklist />}
    </div>
    </MotionConfig>
  );
};

const labelFor = (state) =>
  ({
    [AppMode.COUNTDOWN]: 'countdown',
    [AppMode.GAME_TIME]: 'game time',
    [AppMode.SLIDESHOW]: 'slideshow',
    [AppMode.SHUTDOWN]: 'shutdown',
  })[state.mode];

// Stable machine-readable id for the active view — the hook the e2e
// smoke tests assert on (e2e/countdown-modes.spec.js).
const slugFor = (state) =>
  ({
    [AppMode.COUNTDOWN]: 'countdown',
    [AppMode.GAME_TIME]: 'game-time',
    [AppMode.SLIDESHOW]: 'slideshow',
    [AppMode.SHUTDOWN]: 'shutdown',
  })[state.mode];

const ActiveView = ({ state, now, tally, meetingTheme, onSelect, firstGameIndex, onBareChange, forcedWall = null }) => {
  if (forcedWall) {
    // "Show Bracelet Time now": Bracelet Time over whatever the schedule has
    // (see App). A crash falls back to what the schedule would show.
    return (
      <BraceletBoundary
        fallback={
          <ActiveView state={state} now={now} tally={tally} meetingTheme={meetingTheme} onSelect={onSelect} firstGameIndex={firstGameIndex} onBareChange={onBareChange} />
        }
      >
        <BraceletTimeView now={now} window={forcedWall.window} endsAt={forcedWall.endsAt} tally={tally} />
      </BraceletBoundary>
    );
  }
  switch (state.mode) {
    case AppMode.COUNTDOWN:
      return (
        <CountdownView
          now={now}
          target={state.target}
          theme={meetingTheme}
          onSkip={() => onSelect({ type: 'window', index: OPENING_WINDOW_INDEX })}
        />
      );
    case AppMode.GAME_TIME:
      // Bracelet Time takes the T&T and Sparks windows on the bracelet
      // nights; if it ever fails, the wall falls back to plain game time
      // for that window rather than an error screen.
      if (isBraceletWindow(state.window, now)) {
        return (
          <BraceletBoundary fallback={<GameTimeView now={now} window={state.window} endsAt={state.endsAt} tally={tally} />}>
            <BraceletTimeView now={now} window={state.window} endsAt={state.endsAt} tally={tally} />
          </BraceletBoundary>
        );
      }
      return <GameTimeView now={now} window={state.window} endsAt={state.endsAt} tally={tally} />;
    case AppMode.SLIDESHOW:
      return (
        <SlideshowView
          deck={state.deck}
          now={now}
          onExit={() => onSelect({ type: 'countdown' })}
          onBareChange={onBareChange}
          onFinish={
            state.deck === 'opening' && firstGameIndex !== -1
              ? () => onSelect({ type: 'window', index: firstGameIndex })
              : undefined
          }
        />
      );
    case AppMode.SHUTDOWN:
      // `now` feeds the shutdown screen's idle blackout (it runs until
      // midnight, mostly to an empty room) — see lib/idleBlackout.js.
      return <ShutdownView now={now} onRestart={() => onSelect({ type: 'countdown' })} onBareChange={onBareChange} />;
  }
};

/** Bracelet Time's own boundary: a crash degrades to plain game time, never "Oops". */
class BraceletBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Bracelet Time crashed; showing game time instead:', error, errorInfo);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/** Last-resort boundary (per-view boundaries catch view crashes first). */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          message="Something went wrong — the show must go on."
          detail={this.state.error?.toString()}
          fullScreen
        />
      );
    }
    return this.props.children;
  }
}

export default App;
