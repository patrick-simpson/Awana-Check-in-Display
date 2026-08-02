import React, { useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AppMode } from './types.js';
import { FLAGS } from './lib/flags.js';
import { stateKey } from './lib/schedule.js';
import { advisoryTitle } from './lib/scheduleAdvisory.js';
import { DUR, EASE } from './lib/motion-tokens.js';
import { useClock } from './hooks/useClock.js';
import { useSchedule } from './hooks/useSchedule.js';
import { useRealtime } from './hooks/useRealtime.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { ViewErrorBoundary } from './components/ViewErrorBoundary.jsx';
import { ResumePill } from './components/ResumePill.jsx';
import { SetupChecklist } from './components/SetupChecklist.jsx';
import { CountdownView } from './views/CountdownView.jsx';
import { GameTimeView } from './views/GameTimeView.jsx';
import { SlideshowView } from './views/SlideshowView.jsx';
import { ShutdownView } from './views/ShutdownView.jsx';
import { QuickNav } from './views/QuickNav.jsx';

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
  const { tally, schedule: scheduleAdvisory } = useRealtime();
  const { state, isOverride, resumeAt, select, resume, stay } = useSchedule(now, scheduleAdvisory);

  // ?vr=1 (visual-regression / screenshot mode): stamp the root so CSS
  // can kill every keyframe animation, and tell framer-motion to skip
  // transform animations — two renders of one state become identical.
  useEffect(() => {
    if (!FLAGS.vr) return undefined;
    document.documentElement.dataset.vr = '1';
    return () => { delete document.documentElement.dataset.vr; };
  }, []);

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

  return (
    <MotionConfig reducedMotion={FLAGS.vr ? 'always' : 'user'}>
    <div className="w-full h-full relative" style={{ background: '#000000' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={stateKey(state)}
          className="absolute inset-0"
          data-mode={slugFor(state)}
          data-deck={state.mode === AppMode.SLIDESHOW ? state.deck : undefined}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: DUR.mode, ease: EASE.smooth }}
        >
          <ViewErrorBoundary label={labelFor(state)}>
            <ActiveView
              state={state}
              now={now}
              tally={tally}
              meetingTheme={advisoryTitle(scheduleAdvisory, now)}
              onSelect={select}
            />
          </ViewErrorBoundary>
        </motion.div>
      </AnimatePresence>

      <QuickNav now={now} state={state} isOverride={isOverride} onSelect={select} onResume={resume} />
      {isOverride && <ResumePill now={now} resumeAt={resumeAt} onStay={stay} />}
      <SetupChecklist />
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

const ActiveView = ({ state, now, tally, meetingTheme, onSelect }) => {
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
      return <GameTimeView now={now} window={state.window} endsAt={state.endsAt} tally={tally} />;
    case AppMode.SLIDESHOW:
      return (
        <SlideshowView
          deck={state.deck}
          now={now}
          onExit={() => onSelect({ type: 'countdown' })}
        />
      );
    case AppMode.SHUTDOWN:
      return <ShutdownView onRestart={() => onSelect({ type: 'countdown' })} />;
  }
};

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
        <div
          className="flex flex-col items-center justify-center h-screen w-screen p-8 gap-6"
          style={{ background: '#000000' }}
        >
          <h1
            className="gradient-text-amber"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h1)', lineHeight: 1 }}
          >
            OOPS!
          </h1>
          <p
            className="text-white/70 text-center"
            style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-lg)' }}
          >
            Something went wrong — the show must go on.
          </p>
          <p
            className="text-white/30 text-sm max-w-2xl overflow-auto text-center"
            style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, letterSpacing: '0.05em' }}
          >
            {this.state.error?.toString()}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 rounded-full border-2 text-white uppercase transition-transform hover:scale-105"
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              letterSpacing: '0.15em',
              borderColor: '#FFC107',
              boxShadow: '0 0 18px rgba(255,193,7,0.45)',
              background: 'rgba(10,10,10,0.72)',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default App;
